/**
 * Módulo centralizado para resolución de destinatarios Telegram.
 * Consolida 3 niveles: cliente, organización y SuperAdmin.
 */
import { prisma, isNotifTypeEnabled } from "@mediabot/shared";
import type { TelegramNotifType } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";
import { bot } from "./bot-instance.js";

export interface ResolvedRecipient {
  chatId: string;
  label: string | null;
  source: "client" | "org" | "orgadmin" | "superadmin";
}

/**
 * Obtiene los destinatarios de Telegram para un cliente a nivel de cliente.
 * Primero busca en TelegramRecipient, luego fallback a campos legacy.
 */
export async function getClientLevelRecipients(
  clientId: string,
  types: ("AGENCY_INTERNAL" | "CLIENT_GROUP" | "CLIENT_INDIVIDUAL")[],
  legacyGroupId?: string | null,
  legacyClientGroupId?: string | null
): Promise<Array<{ chatId: string; label: string | null; type: string }>> {
  const recipients = await prisma.telegramRecipient.findMany({
    where: {
      clientId,
      active: true,
      type: { in: types },
    },
    select: {
      chatId: true,
      label: true,
      type: true,
    },
  });

  if (recipients.length > 0) {
    return recipients;
  }

  // Fallback a campos legacy
  const fallbackRecipients: Array<{ chatId: string; label: string | null; type: string }> = [];

  if (types.includes("AGENCY_INTERNAL") && legacyGroupId) {
    fallbackRecipients.push({
      chatId: legacyGroupId,
      label: "Grupo Interno (legacy)",
      type: "AGENCY_INTERNAL",
    });
  }

  if (types.includes("CLIENT_GROUP") && legacyClientGroupId) {
    fallbackRecipients.push({
      chatId: legacyClientGroupId,
      label: "Grupo Cliente (legacy)",
      type: "CLIENT_GROUP",
    });
  }

  return fallbackRecipients;
}

/**
 * Consolida los 3 niveles de destinatarios, deduplica y filtra por preferencias.
 *
 * Niveles:
 * 1. Cliente: TelegramRecipient (sin filtro de preferencias)
 * 2. Organización: OrgTelegramRecipient (filtra por preferences[notifType])
 * 3. SuperAdmin: User con isSuperAdmin + telegramUserId (filtra por telegramNotifPrefs[notifType])
 */
export async function getAllRecipientsForClient(
  clientId: string,
  notifType: TelegramNotifType,
  options?: {
    recipientTypes?: ("AGENCY_INTERNAL" | "CLIENT_GROUP" | "CLIENT_INDIVIDUAL")[];
    legacyGroupId?: string | null;
    legacyClientGroupId?: string | null;
  }
): Promise<ResolvedRecipient[]> {
  const seen = new Set<string>();
  const result: ResolvedRecipient[] = [];

  // 1. Nivel cliente
  const clientRecipients = await getClientLevelRecipients(
    clientId,
    options?.recipientTypes || ["AGENCY_INTERNAL"],
    options?.legacyGroupId,
    options?.legacyClientGroupId
  );

  for (const r of clientRecipients) {
    if (!seen.has(r.chatId)) {
      seen.add(r.chatId);
      result.push({ chatId: r.chatId, label: r.label, source: "client" });
    }
  }

  // 2. Nivel organización
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { orgId: true },
  });

  if (client?.orgId) {
    const orgRecipients = await prisma.orgTelegramRecipient.findMany({
      where: { orgId: client.orgId, active: true },
      select: { chatId: true, label: true, preferences: true },
    });

    for (const r of orgRecipients) {
      if (seen.has(r.chatId)) continue;
      const prefs = r.preferences as Record<string, boolean> | null;
      if (!isNotifTypeEnabled(prefs, notifType)) continue;
      seen.add(r.chatId);
      result.push({ chatId: r.chatId, label: r.label, source: "org" });
    }
  }

  // 2.5 Nivel Admin de organización (User ADMIN con telegramUserId)
  if (client?.orgId) {
    const orgAdmins = await prisma.user.findMany({
      where: {
        orgId: client.orgId,
        role: "ADMIN",
        isSuperAdmin: false,
        telegramUserId: { not: null },
      },
      select: { telegramUserId: true, name: true, telegramNotifPrefs: true },
    });

    for (const admin of orgAdmins) {
      if (!admin.telegramUserId || seen.has(admin.telegramUserId)) continue;
      const prefs = admin.telegramNotifPrefs as Record<string, boolean> | null;
      if (!isNotifTypeEnabled(prefs, notifType)) continue;
      seen.add(admin.telegramUserId);
      result.push({
        chatId: admin.telegramUserId,
        label: `${admin.name} (Admin)`,
        source: "orgadmin",
      });
    }
  }

  // 3. Nivel SuperAdmin
  const superAdmins = await prisma.user.findMany({
    where: {
      isSuperAdmin: true,
      telegramUserId: { not: null },
    },
    select: {
      telegramUserId: true,
      name: true,
      telegramNotifPrefs: true,
    },
  });

  for (const sa of superAdmins) {
    if (!sa.telegramUserId || seen.has(sa.telegramUserId)) continue;
    const prefs = sa.telegramNotifPrefs as Record<string, boolean> | null;
    if (!isNotifTypeEnabled(prefs, notifType)) continue;
    seen.add(sa.telegramUserId);
    result.push({
      chatId: sa.telegramUserId,
      label: `${sa.name} (SuperAdmin)`,
      source: "superadmin",
    });
  }

  return result;
}

/**
 * Desactiva un destinatario de Telegram en la BD según su nivel (source).
 * Se llama automáticamente cuando un envío falla con error permanente.
 */
async function disableRecipient(
  chatId: string,
  source: "client" | "org" | "orgadmin" | "superadmin"
): Promise<void> {
  try {
    switch (source) {
      case "client":
        await prisma.telegramRecipient.updateMany({
          where: { chatId, active: true },
          data: { active: false },
        });
        break;
      case "org":
        await prisma.orgTelegramRecipient.updateMany({
          where: { chatId, active: true },
          data: { active: false },
        });
        break;
      case "orgadmin":
        // Para Admin de org, limpiar telegramUserId
        await prisma.user.updateMany({
          where: { telegramUserId: chatId, isSuperAdmin: false, role: "ADMIN" },
          data: { telegramUserId: null },
        });
        break;
      case "superadmin":
        // Para SuperAdmin, limpiar telegramUserId en lugar de desactivar el user
        await prisma.user.updateMany({
          where: { telegramUserId: chatId, isSuperAdmin: true },
          data: { telegramUserId: null },
        });
        break;
    }
  } catch (err) {
    console.error(`Failed to disable recipient ${chatId} (${source}):`, err);
  }
}

/**
 * Envía un mensaje a múltiples destinatarios de Telegram.
 * Auto-desactiva destinatarios con errores permanentes (chat not found, bot blocked, etc).
 * Retorna el número de envíos exitosos, fallidos y desactivados.
 */
export async function sendToMultipleRecipients(
  recipients: Array<{ chatId: string; label?: string | null; source?: "client" | "org" | "orgadmin" | "superadmin" }>,
  message: string,
  options?: { reply_markup?: InlineKeyboard; parse_mode?: "Markdown" | "HTML" }
): Promise<{ sent: number; failed: number; disabled: number }> {
  const results = await Promise.allSettled(
    recipients.map((r) =>
      bot.api.sendMessage(r.chatId, message, options)
    )
  );

  let sent = 0;
  let failed = 0;
  let disabled = 0;

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      const reason = String(result.reason);
      const recipient = recipients[i];

      // Errores permanentes que justifican desactivar al destinatario
      const isPermanentError =
        /chat not found|bot was blocked|user is deactivated|PEER_ID_INVALID|bot was kicked/i.test(reason);

      if (isPermanentError && recipient.source) {
        disabled++;
        await disableRecipient(recipient.chatId, recipient.source);
        console.warn(
          `Auto-disabled ${recipient.label || recipient.chatId} (${recipient.source}): ${reason}`
        );
      } else {
        console.error(
          `Failed to send to ${recipient.label || recipient.chatId}: ${reason}`
        );
      }
    }
  }

  return { sent, failed, disabled };
}

/**
 * Helper que resuelve destinatarios + envía mensaje en una sola llamada.
 */
export async function sendNotification(
  clientId: string,
  notifType: TelegramNotifType,
  message: string,
  options?: {
    recipientTypes?: ("AGENCY_INTERNAL" | "CLIENT_GROUP" | "CLIENT_INDIVIDUAL")[];
    keyboard?: InlineKeyboard;
    parseMode?: "Markdown";
  }
): Promise<{ sent: number; failed: number; disabled: number }> {
  const recipients = await getAllRecipientsForClient(clientId, notifType, {
    recipientTypes: options?.recipientTypes,
  });

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, disabled: 0 };
  }

  return sendToMultipleRecipients(recipients, message, {
    reply_markup: options?.keyboard,
    parse_mode: options?.parseMode,
  });
}
