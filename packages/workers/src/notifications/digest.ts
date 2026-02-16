import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { generateDigestSummary, generateDailyBrief } from "../analysis/ai.js";
import type { DailyBriefResult } from "../analysis/ai.js";
import { createWeeklyReportNotification } from "./inapp-creator.js";
import {
  getAllRecipientsForClient,
  getClientLevelRecipients,
  sendToMultipleRecipients,
} from "./recipients.js";

export function startDigestWorker() {
  const worker = new Worker(
    QUEUE_NAMES.DIGEST,
    async () => {
      console.log("📊 Running daily digest...");

      // Obtener clientes activos que tienen destinatarios (legacy o nuevo sistema)
      const clients = await prisma.client.findMany({
        where: {
          active: true,
          OR: [
            { telegramGroupId: { not: null } },
            { telegramRecipients: { some: { active: true } } },
          ],
        },
      });

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const client of clients) {

        const mentions = await prisma.mention.findMany({
          where: {
            clientId: client.id,
            createdAt: { gte: since },
          },
          include: { article: true },
          orderBy: { relevance: "desc" },
        });

        // Obtener menciones sociales del período
        const socialMentions = await prisma.socialMention.findMany({
          where: {
            clientId: client.id,
            createdAt: { gte: since },
          },
          orderBy: [{ likes: "desc" }],
        });

        if (mentions.length === 0 && socialMentions.length === 0) continue;

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

        // Preparar stats sociales para el resumen AI
        const socialStats = socialMentions.length > 0 ? {
          totalPosts: socialMentions.length,
          platforms: socialMentions.reduce((acc, sm) => {
            acc[sm.platform] = (acc[sm.platform] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          totalEngagement: socialMentions.reduce((sum, sm) => sum + sm.likes + sm.comments, 0),
          topPost: socialMentions[0] ? {
            author: socialMentions[0].authorHandle,
            content: (socialMentions[0].content || "").slice(0, 100),
            likes: socialMentions[0].likes,
            platform: socialMentions[0].platform,
          } : undefined,
        } : undefined;

        // Generate AI summary
        let aiSummary = "";
        try {
          aiSummary = await generateDigestSummary({
            clientName: client.name,
            totalMentions: mentions.length,
            sentimentBreakdown,
            topMentions,
            socialStats,
          });
        } catch (error) {
          console.error(`Digest AI summary error for ${client.name}:`, error);
          aiSummary = "Resumen automatico no disponible.";
        }

        // ==================== AI MEDIA BRIEF ====================
        let briefResult: DailyBriefResult | null = null;
        try {
          // Datos del día anterior para comparativa
          const yesterdayStart = new Date(since.getTime() - 24 * 60 * 60 * 1000);
          const yesterdayMentions = await prisma.mention.findMany({
            where: {
              clientId: client.id,
              createdAt: { gte: yesterdayStart, lt: since },
            },
          });

          const yesterdaySentiment = {
            positive: yesterdayMentions.filter((m) => m.sentiment === "POSITIVE").length,
            negative: yesterdayMentions.filter((m) => m.sentiment === "NEGATIVE").length,
            neutral: yesterdayMentions.filter((m) => m.sentiment === "NEUTRAL").length,
            mixed: yesterdayMentions.filter((m) => m.sentiment === "MIXED").length,
          };

          // SOV rápido: contar menciones del cliente vs total en la org
          const [clientMentionCount, totalOrgMentions] = await Promise.all([
            prisma.mention.count({
              where: { clientId: client.id, createdAt: { gte: since } },
            }),
            prisma.mention.count({
              where: { client: { orgId: client.orgId }, createdAt: { gte: since } },
            }),
          ]);
          const sovPercentage = totalOrgMentions > 0 ? (clientMentionCount / totalOrgMentions) * 100 : 0;

          // SOV de ayer
          const [clientYesterdayCount, totalYesterdayCount] = await Promise.all([
            prisma.mention.count({
              where: { clientId: client.id, createdAt: { gte: yesterdayStart, lt: since } },
            }),
            prisma.mention.count({
              where: { client: { orgId: client.orgId }, createdAt: { gte: yesterdayStart, lt: since } },
            }),
          ]);
          const yesterdaySov = totalYesterdayCount > 0 ? (clientYesterdayCount / totalYesterdayCount) * 100 : 0;

          // Crisis activas
          const activeCrises = await prisma.crisisAlert.count({
            where: { clientId: client.id, status: "ACTIVE" },
          });

          // Action items pendientes
          const pendingItems = await prisma.actionItem.findMany({
            where: { clientId: client.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
            select: { description: true },
            take: 5,
          });

          // Temas emergentes recientes (últimas 48h)
          const emergingTopics = await prisma.emergingTopicNotification.findMany({
            where: {
              clientId: client.id,
              createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
            },
            select: { topic: true },
            distinct: ["topic"],
            take: 5,
          });

          // Engagement total social
          const totalEngagement = socialMentions.reduce(
            (sum, sm) => sum + sm.likes + sm.comments + sm.shares,
            0
          );

          briefResult = await generateDailyBrief({
            clientName: client.name,
            clientIndustry: client.industry || "",
            todayStats: {
              mentions: mentions.length,
              sentimentBreakdown,
              socialPosts: socialMentions.length,
              totalEngagement,
            },
            yesterdayStats: {
              mentions: yesterdayMentions.length,
              sentimentBreakdown: yesterdaySentiment,
            },
            sovPercentage,
            yesterdaySov,
            topMentions: mentions.slice(0, 5).map((m) => ({
              title: m.article.title,
              source: m.article.source,
              sentiment: m.sentiment,
            })),
            activeCrises,
            pendingActionItems: pendingItems.map((i) => i.description),
            emergingTopicNames: emergingTopics.map((e) => e.topic),
          });

          // Persistir brief en DB
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);

          const briefContent = JSON.parse(JSON.stringify(briefResult));
          const briefStats = JSON.parse(JSON.stringify({
            mentions: mentions.length,
            sentiment: sentimentBreakdown,
            sov: sovPercentage,
            socialPosts: socialMentions.length,
            engagement: totalEngagement,
          }));

          await prisma.dailyBrief.upsert({
            where: {
              clientId_date: { clientId: client.id, date: todayDate },
            },
            update: {
              content: briefContent,
              stats: briefStats,
            },
            create: {
              clientId: client.id,
              date: todayDate,
              content: briefContent,
              stats: briefStats,
            },
          });

          console.log(`🧠 Daily brief generated and saved for ${client.name}`);
        } catch (error) {
          console.error(`Failed to generate daily brief for ${client.name}:`, error);
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

        // Sección de redes sociales
        if (socialMentions.length > 0) {
          const platformCounts = socialMentions.reduce((acc, sm) => {
            acc[sm.platform] = (acc[sm.platform] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const totalLikes = socialMentions.reduce((sum, sm) => sum + sm.likes, 0);
          const totalComments = socialMentions.reduce((sum, sm) => sum + sm.comments, 0);

          const platformLabels: Record<string, string> = {
            INSTAGRAM: "Instagram",
            TIKTOK: "TikTok",
            YOUTUBE: "YouTube",
            TWITTER: "Twitter",
          };

          const platformLine = Object.entries(platformCounts)
            .map(([p, count]) => `${platformLabels[p] || p}: ${count}`)
            .join(" | ");

          message += `\n📱 REDES SOCIALES\n`;
          message += `${platformLine}\n`;
          message += `💬 Engagement total: ${totalLikes} likes, ${totalComments} comentarios\n`;

          // Top 3 posts virales
          const topPosts = socialMentions.slice(0, 3);
          if (topPosts.length > 0) {
            message += `🔥 Top posts:\n`;
            for (const post of topPosts) {
              const contentPreview = (post.content || "Sin contenido").slice(0, 50);
              message += `  @${post.authorHandle} — ${contentPreview}... (${post.likes} likes)\n`;
            }
          }
        }

        // Sección AI Media Brief
        if (briefResult) {
          const deltaSign = briefResult.comparison.mentionsDelta > 0 ? "+" : "";
          message += `\n🧠 AI MEDIA BRIEF\n`;
          message += `━━━━━━━━━━━━━━━━\n`;
          message += `📊 vs. ayer: ${deltaSign}${briefResult.comparison.mentionsDelta} menciones, ${briefResult.comparison.sentimentShift}\n\n`;

          if (briefResult.highlights.length > 0) {
            message += `🔑 Puntos clave:\n`;
            for (const h of briefResult.highlights.slice(0, 5)) {
              message += `• ${h}\n`;
            }
          }

          if (briefResult.watchList.length > 0) {
            message += `\n👁️ Qué vigilar hoy:\n`;
            for (const w of briefResult.watchList) {
              message += `• ${w}\n`;
            }
          }

          if (briefResult.pendingActions.length > 0) {
            message += `\n⚡ Acciones sugeridas:\n`;
            for (const a of briefResult.pendingActions) {
              message += `• ${a}\n`;
            }
          }
        }

        // Obtener destinatarios internos (nivel cliente + org + superadmin)
        const internalRecipients = await getAllRecipientsForClient(
          client.id,
          "DAILY_DIGEST",
          {
            recipientTypes: ["AGENCY_INTERNAL"],
            legacyGroupId: client.telegramGroupId,
          }
        );

        if (internalRecipients.length > 0) {
          const { sent, failed } = await sendToMultipleRecipients(internalRecipients, message);
          console.log(`📊 Digest sent for ${client.name} (internal): ${sent} delivered, ${failed} failed`);
        }

        // Obtener destinatarios del cliente (solo nivel cliente, sin org/superadmin)
        const clientRecipients = await getClientLevelRecipients(
          client.id,
          ["CLIENT_GROUP", "CLIENT_INDIVIDUAL"],
          null,
          client.clientGroupId
        );

        if (clientRecipients.length > 0) {
          // Mensaje condensado para clientes
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

          // Agregar resumen social al mensaje del cliente
          if (socialMentions.length > 0) {
            clientMessage += `\n📱 ${socialMentions.length} publicaciones en redes sociales detectadas\n`;
          }

          // Brief condensado para clientes
          if (briefResult && briefResult.highlights.length > 0) {
            clientMessage += `\n🧠 Puntos clave:\n`;
            for (const h of briefResult.highlights.slice(0, 3)) {
              clientMessage += `• ${h}\n`;
            }
            if (briefResult.watchList.length > 0) {
              clientMessage += `\n👁️ A vigilar: ${briefResult.watchList.slice(0, 2).join(" | ")}\n`;
            }
          }

          const { sent, failed } = await sendToMultipleRecipients(clientRecipients, clientMessage);
          console.log(`📊 Digest sent for ${client.name} (client recipients): ${sent} delivered, ${failed} failed`);
        }

        // Disparar BRIEF_READY si se generó un brief
        if (briefResult) {
          try {
            const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_TELEGRAM);
            await notifyQueue.add("brief-ready", {
              clientId: client.id,
              type: "BRIEF_READY",
              message:
                `📋 BRIEF DIARIO LISTO | ${client.name}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `El brief de hoy para ${client.name} ya esta disponible.\n` +
                `📊 ${mentions.length} menciones | ${socialMentions.length} posts sociales\n` +
                (briefResult.highlights.length > 0
                  ? `\n🔑 ${briefResult.highlights[0]}\n`
                  : "") +
                `\nRevisa el brief completo en el dashboard.`,
            });
          } catch (err) {
            console.error(`Failed to queue BRIEF_READY for ${client.name}:`, err);
          }
        }

        // Disparar CAMPAIGN_REPORT si hay campañas activas
        try {
          const activeCampaigns = await prisma.campaign.findMany({
            where: { clientId: client.id, status: "ACTIVE" },
            select: { id: true, name: true },
          });

          if (activeCampaigns.length > 0) {
            const campaignNames = activeCampaigns.map((c) => c.name).join(", ");
            const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_TELEGRAM);
            await notifyQueue.add("campaign-report", {
              clientId: client.id,
              type: "CAMPAIGN_REPORT",
              message:
                `🎯 CAMPANAS ACTIVAS | ${client.name}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Campañas en curso: ${activeCampaigns.length}\n` +
                `📋 ${campaignNames}\n` +
                `📊 Menciones hoy: ${mentions.length} | Social: ${socialMentions.length}\n\n` +
                `Revisa el detalle de cada campaña en el dashboard.`,
            });
          }
        } catch (err) {
          console.error(`Failed to queue CAMPAIGN_REPORT for ${client.name}:`, err);
        }

        // Log digest
        await prisma.digestLog.create({
          data: {
            clientId: client.id,
            type: "daily",
            articleCount: mentions.length,
            socialMentionCount: socialMentions.length,
          },
        });

        // Crear notificación in-app para reporte diario
        try {
          await createWeeklyReportNotification({
            clientId: client.id,
            clientName: client.name,
            weekStart: since,
            mentionCount: mentions.length,
          });
        } catch (error) {
          console.error(`Failed to create in-app notification for digest:`, error);
        }
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
