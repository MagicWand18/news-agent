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

        // Group mentions by cluster
        const clusters = new Map<string, typeof mentions>();
        for (const mention of mentions) {
          const clusterId = mention.parentMentionId || mention.id;
          if (!clusters.has(clusterId)) {
            clusters.set(clusterId, []);
          }
          clusters.get(clusterId)!.push(mention);
        }

        // Sort clusters by total relevance
        const sortedClusters = [...clusters.entries()].sort((a, b) => {
          const maxRelA = Math.max(...a[1].map(m => m.relevance));
          const maxRelB = Math.max(...b[1].map(m => m.relevance));
          return maxRelB - maxRelA;
        });

        if (sortedClusters.length > 0) {
          message += `🏆 Top noticias:\n`;
          for (const [, clusterMentions] of sortedClusters.slice(0, 5)) {
            const primary = clusterMentions.reduce((a, b) => a.relevance > b.relevance ? a : b);
            const sources = [...new Set(clusterMentions.map(m => m.article.source))];
            const sentIcon =
              primary.sentiment === "POSITIVE" ? "🟢" :
              primary.sentiment === "NEGATIVE" ? "🔴" : "⚪";

            message += `${sentIcon} ${primary.article.title.slice(0, 70)}...\n`;
            if (sources.length > 1) {
              message += `   📰 ${sources.length} fuentes: ${sources.slice(0, 3).join(", ")}${sources.length > 3 ? "..." : ""}\n`;
            } else {
              message += `   ${primary.article.source} | Relevancia: ${primary.relevance}/10\n`;
            }
          }
        }

        await bot.api.sendMessage(client.telegramGroupId, message);

        // Send condensed digest to client group (if linked)
        if (client.clientGroupId) {
          let clientMessage =
            `📊 Resumen diario de menciones\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📈 ${mentions.length} menciones detectadas\n` +
            `${sentimentBar}\n\n`;

          if (aiSummary) {
            clientMessage += `💬 ${aiSummary}\n\n`;
          }

          if (sortedClusters.length > 0) {
            clientMessage += `📰 Menciones destacadas:\n`;
            for (const [, clusterMentions] of sortedClusters.slice(0, 3)) {
              const primary = clusterMentions.reduce((a, b) => a.relevance > b.relevance ? a : b);
              const sources = [...new Set(clusterMentions.map(m => m.article.source))];
              const sentIcon =
                primary.sentiment === "POSITIVE" ? "🟢" :
                primary.sentiment === "NEGATIVE" ? "🔴" : "⚪";

              if (sources.length > 1) {
                clientMessage += `${sentIcon} ${primary.article.title.slice(0, 60)}... (${sources.length} fuentes)\n`;
              } else {
                clientMessage += `${sentIcon} ${primary.article.title.slice(0, 70)}...\n`;
              }
            }
          }

          try {
            await bot.api.sendMessage(client.clientGroupId, clientMessage);
          } catch (err) {
            console.error(`Failed to send client digest to ${client.name}:`, err);
          }
        }

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
