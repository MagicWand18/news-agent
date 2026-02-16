import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma, config } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";
import {
  createMentionNotification,
  createCrisisNotification,
  createEmergingTopicNotification,
} from "./inapp-creator.js";
import {
  getAllRecipientsForClient,
  sendToMultipleRecipients,
  sendNotification,
} from "./recipients.js";

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

      // No notificar artículos con más de 30 días de antigüedad
      const publishedAt = mention.publishedAt || mention.article.publishedAt;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (publishedAt && new Date(publishedAt) < thirtyDaysAgo) {
        console.log(`[Notification] Skipping old article for ${mention.client.name} (published ${new Date(publishedAt).toISOString().split("T")[0]})`);
        await prisma.mention.update({ where: { id: mentionId }, data: { notified: true } });
        return;
      }

      // Obtener destinatarios (nivel cliente + org + superadmin)
      const recipients = await getAllRecipientsForClient(
        mention.clientId,
        "MENTION_ALERT",
        {
          recipientTypes: ["AGENCY_INTERNAL"],
          legacyGroupId: mention.client.telegramGroupId,
          legacyClientGroupId: mention.client.clientGroupId,
        }
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

      // Crear notificación in-app para menciones críticas y altas
      if (mention.urgency === "CRITICAL" || mention.urgency === "HIGH") {
        try {
          await createMentionNotification({
            clientId: mention.clientId,
            clientName: mention.client.name,
            mentionId: mention.id,
            articleTitle: mention.article.title,
            urgency: mention.urgency as "CRITICAL" | "HIGH",
            sentiment: mention.sentiment,
          });
        } catch (error) {
          console.error(`Failed to create in-app notification for mention ${mentionId}:`, error);
        }
      }

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

      // Obtener destinatarios (nivel cliente + org + superadmin)
      const recipients = await getAllRecipientsForClient(
        crisisAlert.clientId,
        "CRISIS_ALERT",
        {
          recipientTypes: ["AGENCY_INTERNAL"],
          legacyGroupId: crisisAlert.client.telegramGroupId,
          legacyClientGroupId: crisisAlert.client.clientGroupId,
        }
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

      // Crear notificación in-app para alertas de crisis
      try {
        await createCrisisNotification({
          clientId: crisisAlert.clientId,
          clientName: crisisAlert.client.name,
          crisisAlertId: crisisAlert.id,
          severity: crisisAlert.severity,
          mentionCount: crisisAlert.mentionCount,
          triggerType: crisisAlert.triggerType,
        });
      } catch (error) {
        console.error(`Failed to create in-app notification for crisis ${crisisAlertId}:`, error);
      }

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

      // Obtener destinatarios (nivel cliente + org + superadmin)
      const recipients = await getAllRecipientsForClient(
        clientId,
        "EMERGING_TOPIC",
        {
          recipientTypes: ["AGENCY_INTERNAL"],
          legacyGroupId: telegramGroupId,
        }
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

      // Crear notificación in-app para tema emergente
      try {
        await createEmergingTopicNotification({
          clientId,
          clientName,
          topic,
          count,
          clientMentionCount,
        });
      } catch (error) {
        console.error(`Failed to create in-app notification for emerging topic:`, error);
      }

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

  // Worker genérico de notificaciones Telegram
  const genericTelegramWorker = new Worker(
    QUEUE_NAMES.NOTIFY_TELEGRAM,
    async (job) => {
      const { clientId, type, message, parseMode } = job.data as {
        clientId: string;
        type: string;
        message: string;
        parseMode?: "Markdown";
      };

      const { sent, failed } = await sendNotification(
        clientId,
        type as import("@mediabot/shared").TelegramNotifType,
        message,
        { parseMode }
      );

      console.log(`📨 Generic telegram notification (${type}): ${sent} delivered, ${failed} failed`);
    },
    { connection, concurrency: 3 }
  );

  genericTelegramWorker.on("failed", (job, err) => {
    console.error(`Generic telegram notification job ${job?.id} failed:`, err);
  });

  console.log(`🔔 Notification workers started (alerts: ${config.workers.notification.concurrency}, crisis: 2, emerging: 2, generic: 3)`);
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
