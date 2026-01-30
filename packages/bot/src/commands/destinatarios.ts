import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";
import type { RecipientType } from "@prisma/client";

/**
 * Comando /destinatarios - Lista los destinatarios de Telegram de un cliente.
 *
 * Uso:
 *   /destinatarios <nombre_cliente>
 */
export async function handleDestinatarios(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const clientName = ctx.message?.text?.split(" ").slice(1).join(" ");

  if (!clientName) {
    await ctx.reply(
      "Uso: /destinatarios <nombre_cliente>\n\n" +
      "Ejemplo: /destinatarios Coca Cola"
    );
    return;
  }

  // Buscar cliente con sus recipients
  const client = await prisma.client.findFirst({
    where: {
      orgId: ctx.session.orgId,
      name: { contains: clientName, mode: "insensitive" },
    },
    include: {
      telegramRecipients: {
        where: { active: true },
        orderBy: { type: "asc" },
      },
    },
  });

  if (!client) {
    await ctx.reply(`No se encontro un cliente con el nombre "${clientName}".`);
    return;
  }

  if (client.telegramRecipients.length === 0) {
    // Verificar campos legacy
    const hasLegacy = client.telegramGroupId || client.clientGroupId;

    if (hasLegacy) {
      let msg = `📬 Destinatarios de *${client.name}* (configuracion legacy):\n\n`;
      if (client.telegramGroupId) {
        msg += `🏢 Interno: \`${client.telegramGroupId}\`\n`;
      }
      if (client.clientGroupId) {
        msg += `👥 Cliente: \`${client.clientGroupId}\`\n`;
      }
      msg += `\n⚠️ Usa /vincular para migrar a la nueva configuracion.`;
      await ctx.reply(msg, { parse_mode: "Markdown" });
      return;
    }

    await ctx.reply(
      `${client.name} no tiene destinatarios de Telegram configurados.\n\n` +
      `Para agregar uno, usa:\n` +
      `/vincular ${client.name} [interno|cliente]`
    );
    return;
  }

  // Formatear lista de recipients
  const typeLabels: Record<RecipientType, { icon: string; label: string }> = {
    AGENCY_INTERNAL: { icon: "🏢", label: "Interno" },
    CLIENT_GROUP: { icon: "👥", label: "Cliente (Grupo)" },
    CLIENT_INDIVIDUAL: { icon: "👤", label: "Cliente (Individual)" },
  };

  let msg = `📬 Destinatarios de *${client.name}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Agrupar por tipo
  const grouped = new Map<RecipientType, typeof client.telegramRecipients>();
  for (const r of client.telegramRecipients) {
    if (!grouped.has(r.type)) {
      grouped.set(r.type, []);
    }
    grouped.get(r.type)!.push(r);
  }

  const typeOrder: RecipientType[] = ["AGENCY_INTERNAL", "CLIENT_GROUP", "CLIENT_INDIVIDUAL"];

  for (const type of typeOrder) {
    const recipients = grouped.get(type);
    if (!recipients || recipients.length === 0) continue;

    const { icon, label } = typeLabels[type];
    msg += `${icon} *${label}*\n`;

    for (const r of recipients) {
      msg += `  • ${r.label || r.chatId}`;
      if (r.label) {
        msg += ` (\`${r.chatId.slice(-6)}...\`)`;
      }
      msg += `\n`;
    }
    msg += `\n`;
  }

  msg += `📊 Total: ${client.telegramRecipients.length} destinatario${client.telegramRecipients.length > 1 ? "s" : ""}`;

  await ctx.reply(msg, { parse_mode: "Markdown" });
}

/**
 * Comando /desvincular - Desvincula el chat/grupo actual de un cliente.
 *
 * Uso:
 *   /desvincular <nombre_cliente>
 */
export async function handleDesvincular(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const clientName = ctx.message?.text?.split(" ").slice(1).join(" ");

  if (!clientName) {
    await ctx.reply(
      "Uso: /desvincular <nombre_cliente>\n\n" +
      "Esto desvinculara este chat/grupo del cliente especificado."
    );
    return;
  }

  const chatId = ctx.chat!.id.toString();

  // Buscar cliente
  const client = await prisma.client.findFirst({
    where: {
      orgId: ctx.session.orgId,
      name: { contains: clientName, mode: "insensitive" },
    },
  });

  if (!client) {
    await ctx.reply(`No se encontro un cliente con el nombre "${clientName}".`);
    return;
  }

  // Buscar recipient activo
  const recipient = await prisma.telegramRecipient.findFirst({
    where: {
      clientId: client.id,
      chatId,
      active: true,
    },
  });

  if (!recipient) {
    await ctx.reply(
      `Este chat/grupo no esta vinculado a ${client.name}.\n\n` +
      `Usa /destinatarios ${client.name} para ver los destinatarios actuales.`
    );
    return;
  }

  // Desactivar recipient
  await prisma.telegramRecipient.update({
    where: { id: recipient.id },
    data: { active: false },
  });

  // Limpiar campos legacy si corresponden
  if (recipient.type === "AGENCY_INTERNAL" && client.telegramGroupId === chatId) {
    await prisma.client.update({
      where: { id: client.id },
      data: { telegramGroupId: null },
    });
  } else if (recipient.type === "CLIENT_GROUP" && client.clientGroupId === chatId) {
    await prisma.client.update({
      where: { id: client.id },
      data: { clientGroupId: null },
    });
  }

  await ctx.reply(
    `✅ Este chat/grupo ha sido desvinculado de ${client.name}.\n` +
    `Ya no recibiras alertas aqui.`
  );
}
