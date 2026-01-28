import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";
import { bot } from "./bot-instance.js";

export function startNotificationWorker() {
  const worker = new Worker(
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

      const groupId = mention.client.telegramGroupId;
      if (!groupId) {
        console.warn(`No Telegram group for client ${mention.client.name}`);
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

      await bot.api.sendMessage(groupId, message, {
        reply_markup: keyboard,
      });

      // Mark as notified
      await prisma.mention.update({
        where: { id: mentionId },
        data: { notified: true, notifiedAt: new Date() },
      });
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
  });

  console.log("🔔 Notification worker started");
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
