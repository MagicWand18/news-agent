import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { generateDigestSummary } from "../analysis/ai.js";
import { bot } from "./bot-instance.js";

export function startDigestWorker() {
  const worker = new Worker(
    QUEUE_NAMES.DIGEST,
    async () => {
      console.log("📊 Running daily digest...");

      const clients = await prisma.client.findMany({
        where: { active: true, telegramGroupId: { not: null } },
      });

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const client of clients) {
        if (!client.telegramGroupId) continue;

        const mentions = await prisma.mention.findMany({
          where: {
            clientId: client.id,
            createdAt: { gte: since },
          },
          include: { article: true },
          orderBy: { relevance: "desc" },
        });

        if (mentions.length === 0) continue;

        // Calculate sentiment breakdown
        const sentimentBreakdown = {
          positive: mentions.filter((m) => m.sentiment === "POSITIVE").length,
          negative: mentions.filter((m) => m.sentiment === "NEGATIVE").length,
          neutral: mentions.filter((m) => m.sentiment === "NEUTRAL").length,
          mixed: mentions.filter((m) => m.sentiment === "MIXED").length,
        };

        // Top 5 most relevant mentions
        const topMentions = mentions.slice(0, 5).map((m) => ({
          title: m.article.title,
          source: m.article.source,
          sentiment: m.sentiment,
          relevance: m.relevance,
          summary: m.aiSummary || "",
        }));

        // Generate AI summary
        let aiSummary = "";
        try {
          aiSummary = await generateDigestSummary({
            clientName: client.name,
            totalMentions: mentions.length,
            sentimentBreakdown,
            topMentions,
          });
        } catch (error) {
          console.error(`Digest AI summary error for ${client.name}:`, error);
          aiSummary = "Resumen automatico no disponible.";
        }

        // Format digest message
        const sentimentBar = makeSentimentBar(sentimentBreakdown, mentions.length);

        let message =
          `📊 RESUMEN DIARIO | ${client.name}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📈 Total menciones: ${mentions.length}\n` +
          `${sentimentBar}\n\n`;

        if (aiSummary) {
          message += `💬 Resumen ejecutivo:\n"${aiSummary}"\n\n`;
        }

        if (topMentions.length > 0) {
          message += `🏆 Top menciones:\n`;
          for (const m of topMentions) {
            const sentIcon =
              m.sentiment === "POSITIVE" ? "🟢" :
              m.sentiment === "NEGATIVE" ? "🔴" : "⚪";
            message += `${sentIcon} ${m.title.slice(0, 70)}...\n`;
            message += `   ${m.source} | Relevancia: ${m.relevance}/10\n`;
          }
        }

        await bot.api.sendMessage(client.telegramGroupId, message);

        // Log digest
        await prisma.digestLog.create({
          data: {
            clientId: client.id,
            type: "daily",
            articleCount: mentions.length,
          },
        });
      }

      console.log("✅ Daily digest complete");
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Digest job failed:`, err);
  });

  console.log("📊 Digest worker started");
}

function makeSentimentBar(
  breakdown: { positive: number; negative: number; neutral: number; mixed: number },
  total: number
): string {
  if (total === 0) return "Sin menciones";

  const pos = Math.round((breakdown.positive / total) * 100);
  const neg = Math.round((breakdown.negative / total) * 100);
  const neu = Math.round((breakdown.neutral / total) * 100);

  return (
    `🟢 Positivo: ${breakdown.positive} (${pos}%)\n` +
    `🔴 Negativo: ${breakdown.negative} (${neg}%)\n` +
    `⚪ Neutral: ${breakdown.neutral} (${neu}%)\n` +
    `🟡 Mixto: ${breakdown.mixed}`
  );
}
