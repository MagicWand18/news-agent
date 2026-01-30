import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma, config } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";
import { bot } from "./bot-instance.js";

/**
 * Obtiene los destinatarios de Telegram para un cliente.
 * Primero busca en TelegramRecipient, luego fallback a campos legacy.
 */
async function getRecipientsForClient(
  clientId: string,
  types: ("AGENCY_INTERNAL" | "CLIENT_GROUP" | "CLIENT_INDIVIDUAL")[],
  legacyGroupId?: string | null,
  legacyClientGroupId?: string | null
): Promise<Array<{ chatId: string; label: string | null; type: string }>> {
  // Buscar en la nueva tabla
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

  // Si encontramos recipients, usarlos
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
 * Envía un mensaje a múltiples destinatarios de Telegram.
 * Retorna el número de envíos exitosos.
 */
async function sendToMultipleRecipients(
  recipients: Array<{ chatId: string; label: string | null; type: string }>,
  message: string,
  options?: { reply_markup?: InlineKeyboard; parse_mode?: "Markdown" | "HTML" }
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    recipients.map((r) =>
      bot.api.sendMessage(r.chatId, message, options)
    )
  );

  let sent = 0;
  let failed = 0;

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      console.error(
        `Failed to send to ${recipients[i].label || recipients[i].chatId}: ${result.reason}`
      );
    }
  }

  return { sent, failed };
}

export function startNotificationWorker() {
  // Standard alert notification worker
  const alertWorker = new Worker(
    QUEUE_NAMES.NOTIFY_ALERT,
    async (job) => {
      const { mentionId } = job.data as { mentionId: string };

      const mention = await prisma.mention.findUnique({
        where: { id: mentionId },
        include: {
          article: true,
          client: true,
        },
      });

      if (!mention || mention.notified) return;

      // Obtener destinatarios (internos de agencia)
      const recipients = await getRecipientsForClient(
        mention.clientId,
        ["AGENCY_INTERNAL"],
        mention.client.telegramGroupId,
        mention.client.clientGroupId
      );

      if (recipients.length === 0) {
        console.warn(`No Telegram recipients for client ${mention.client.name}`);
        return;
      }

      // Format alert message
      const urgencyIcon =
        mention.urgency === "CRITICAL" ? "🔴" :
        mention.urgency === "HIGH" ? "🟠" :
        mention.urgency === "MEDIUM" ? "🟡" : "🟢";

      const sentimentLabel =
        mention.sentiment === "POSITIVE" ? "Positivo" :
        mention.sentiment === "NEGATIVE" ? "Negativo" :
        mention.sentiment === "MIXED" ? "Mixto" : "Neutral";

      const timeAgo = getTimeAgo(mention.article.publishedAt || mention.createdAt);

      const message =
        `${urgencyIcon} ALERTA | ${mention.client.name}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📰 ${mention.article.title}\n` +
        `📡 ${mention.article.source} · ${timeAgo}\n` +
        `📊 Sentimiento: ${sentimentLabel}\n` +
        `⚡ Relevancia: ${mention.relevance}/10\n` +
        (mention.aiSummary
          ? `\n💬 Resumen IA:\n"${mention.aiSummary}"\n`
          : "") +
        (mention.aiAction
          ? `\n🎯 Accion sugerida:\n"${mention.aiAction}"\n`
          : "");

      const keyboard = new InlineKeyboard()
        .url("📖 Leer articulo", mention.article.url)
        .text("✅ Crear tarea", `create_task:${mention.id}`)
        .row()
        .text("📢 Informar cliente", `notify_client:${mention.id}`)
        .text("🔇 Ignorar", `ignore_mention:${mention.id}`);

      // Enviar a todos los destinatarios
      const { sent, failed } = await sendToMultipleRecipients(
        recipients,
        message,
        { reply_markup: keyboard }
      );

      console.log(
        `📬 Alert sent for ${mention.client.name}: ${sent} delivered, ${failed} failed`
      );

      // Mark as notified
      await prisma.mention.update({
        where: { id: mentionId },
        data: { notified: true, notifiedAt: new Date() },
      });
    },
    { connection, concurrency: config.workers.notification.concurrency }
  );

  alertWorker.on("failed", (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
  });

  // Crisis alert notification worker
  const crisisWorker = new Worker(
    QUEUE_NAMES.NOTIFY_CRISIS,
    async (job) => {
      const { crisisAlertId } = job.data as { crisisAlertId: string };

      const crisisAlert = await prisma.crisisAlert.findUnique({
        where: { id: crisisAlertId },
        include: {
          client: true,
        },
      });

      if (!crisisAlert || crisisAlert.notified) return;

      // Obtener destinatarios (internos de agencia para alertas de crisis)
      const recipients = await getRecipientsForClient(
        crisisAlert.clientId,
        ["AGENCY_INTERNAL"],
        crisisAlert.client.telegramGroupId,
        crisisAlert.client.clientGroupId
      );

      if (recipients.length === 0) {
        console.warn(`No Telegram recipients for client ${crisisAlert.client.name}`);
        return;
      }

      // Get recent negative mentions for context
      const recentMentions = await prisma.mention.findMany({
        where: {
          clientId: crisisAlert.clientId,
          sentiment: "NEGATIVE",
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        include: { article: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      // Format crisis alert message
      const severityIcon =
        crisisAlert.severity === "CRITICAL" ? "🚨" :
        crisisAlert.severity === "HIGH" ? "⚠️" : "⚡";

      const severityLabel =
        crisisAlert.severity === "CRITICAL" ? "CRITICA" :
        crisisAlert.severity === "HIGH" ? "ALTA" : "MEDIA";

      const triggerLabel =
        crisisAlert.triggerType === "NEGATIVE_SPIKE" ? "Pico de menciones negativas" :
        crisisAlert.triggerType === "HIGH_VOLUME" ? "Alto volumen de menciones" :
        crisisAlert.triggerType === "CRITICAL_SOURCE" ? "Fuente critica" : "Manual";

      let message =
        `${severityIcon} ALERTA DE CRISIS | ${crisisAlert.client.name}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🔴 Severidad: ${severityLabel}\n` +
        `📊 Tipo: ${triggerLabel}\n` +
        `📈 Menciones negativas: ${crisisAlert.mentionCount}\n\n` +
        `📰 Menciones recientes:\n`;

      for (const mention of recentMentions.slice(0, 3)) {
        message += `• ${mention.article.title.slice(0, 60)}...\n`;
        message += `  ${mention.article.source}\n`;
      }

      if (recentMentions.length > 3) {
        message += `\n... y ${recentMentions.length - 3} mas\n`;
      }

      message += `\n🎯 Accion recomendada: Revisar menciones y preparar comunicado si es necesario.`;

      const keyboard = new InlineKeyboard()
        .text("📋 Ver menciones", `view_crisis_mentions:${crisisAlert.clientId}`)
        .text("✅ Marcar resuelta", `resolve_crisis:${crisisAlert.id}`)
        .row()
        .text("👁️ Monitorear", `monitor_crisis:${crisisAlert.id}`)
        .text("❌ Descartar", `dismiss_crisis:${crisisAlert.id}`);

      // Enviar a todos los destinatarios
      const { sent, failed } = await sendToMultipleRecipients(
        recipients,
        message,
        { reply_markup: keyboard }
      );

      // Mark crisis as notified
      await prisma.crisisAlert.update({
        where: { id: crisisAlertId },
        data: { notified: true, notifiedAt: new Date() },
      });

      console.log(`🚨 Crisis alert sent: client=${crisisAlert.client.name} severity=${crisisAlert.severity} (${sent} delivered, ${failed} failed)`);
    },
    { connection, concurrency: 2 }
  );

  crisisWorker.on("failed", (job, err) => {
    console.error(`Crisis notification job ${job?.id} failed:`, err);
  });

  // Emerging topic notification worker
  const emergingTopicWorker = new Worker(
    QUEUE_NAMES.NOTIFY_EMERGING_TOPIC,
    async (job) => {
      const {
        clientId,
        clientName,
        telegramGroupId, // Legacy, ahora usamos recipients
        topic,
        count,
        clientMentionCount,
      } = job.data as {
        clientId: string;
        clientName: string;
        telegramGroupId: string;
        topic: string;
        count: number;
        clientMentionCount: number;
      };

      // Obtener destinatarios (internos de agencia para temas emergentes)
      const recipients = await getRecipientsForClient(
        clientId,
        ["AGENCY_INTERNAL"],
        telegramGroupId, // Fallback legacy
        null
      );

      if (recipients.length === 0) {
        console.warn(`No Telegram recipients for client ${clientName} (emerging topic)`);
        return;
      }

      // Formatear mensaje de tema emergente (escapar Markdown)
      const safeTopic = escapeMarkdown(topic);
      const safeClientName = escapeMarkdown(clientName);
      const message =
        `📈 *TEMA EMERGENTE DETECTADO*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🏷️ Tema: *${safeTopic}*\n` +
        `📊 Menciones totales (24h): ${count}\n` +
        `👤 Menciones de ${safeClientName}: ${clientMentionCount}\n` +
        `🆕 Estado: *Tema nuevo*\n\n` +
        `💡 Este tema esta ganando traccion en medios.\n` +
        `Considera preparar una posicion al respecto.`;

      const keyboard = new InlineKeyboard()
        .text("📋 Ver menciones", `view_topic_mentions:${clientId}:${encodeURIComponent(topic)}`)
        .text("✅ Crear tarea", `create_topic_task:${clientId}:${encodeURIComponent(topic)}`);

      // Enviar a todos los destinatarios
      const { sent, failed } = await sendToMultipleRecipients(
        recipients,
        message,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );

      // Registrar que hemos notificado este tema
      await prisma.emergingTopicNotification.create({
        data: {
          clientId,
          topic,
          mentionCount: count,
        },
      });

      console.log(`📈 Emerging topic notification sent: client=${clientName} topic="${topic}" (${sent} delivered, ${failed} failed)`);
    },
    { connection, concurrency: 2 }
  );

  emergingTopicWorker.on("failed", (job, err) => {
    console.error(`Emerging topic notification job ${job?.id} failed:`, err);
  });

  console.log(`🔔 Notification workers started (alerts: ${config.workers.notification.concurrency}, crisis: 2, emerging: 2)`);
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

/**
 * Escapa caracteres especiales de Markdown para mensajes de Telegram
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[*_`\[\]()~>#+=|{}.!-]/g, "\\$&");
}
