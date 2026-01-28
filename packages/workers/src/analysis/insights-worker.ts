import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { generateWeeklyInsights } from "./ai.js";
import { calculateSOV } from "./sov-calculator.js";
import { getTopicStats } from "./topic-extractor.js";

/**
 * Worker que genera insights semanales para todos los clientes activos.
 * Se ejecuta los lunes a las 6:00 AM por defecto.
 */
export function startInsightsWorker() {
  const worker = new Worker(
    QUEUE_NAMES.WEEKLY_INSIGHTS,
    async () => {
      console.log("[InsightsWorker] Starting weekly insights generation...");

      // Obtener todos los clientes activos
      const clients = await prisma.client.findMany({
        where: { active: true },
        include: {
          keywords: true,
        },
      });

      console.log(`[InsightsWorker] Found ${clients.length} active clients`);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);

      for (const client of clients) {
        try {
          console.log(`[InsightsWorker] Generating insights for: ${client.name}`);

          // Obtener menciones de la semana
          const mentions = await prisma.mention.findMany({
            where: {
              clientId: client.id,
              createdAt: { gte: weekStart },
            },
            include: { article: true },
            orderBy: { relevance: "desc" },
          });

          // Obtener menciones de la semana anterior para comparación
          const previousWeekMentions = await prisma.mention.count({
            where: {
              clientId: client.id,
              createdAt: {
                gte: previousWeekStart,
                lt: weekStart,
              },
            },
          });

          if (mentions.length === 0) {
            console.log(`[InsightsWorker] No mentions for ${client.name}, skipping`);
            continue;
          }

          // Calcular sentimiento
          const sentimentBreakdown = {
            positive: 0,
            negative: 0,
            neutral: 0,
            mixed: 0,
          };

          for (const m of mentions) {
            const key = m.sentiment.toLowerCase() as keyof typeof sentimentBreakdown;
            if (key in sentimentBreakdown) {
              sentimentBreakdown[key]++;
            }
          }

          // Calcular SOV
          let sovData: { sov: number; trend: "up" | "down" | "stable" } = { sov: 0, trend: "stable" };
          try {
            const sovResult = await calculateSOV(client.id, 7, true);
            const previousSov = await calculateSOV(client.id, 14, true);
            const previousSovValue = previousSov.client.sov;

            let trend: "up" | "down" | "stable" = "stable";
            if (sovResult.client.sov > previousSovValue * 1.1) trend = "up";
            else if (sovResult.client.sov < previousSovValue * 0.9) trend = "down";

            sovData = {
              sov: sovResult.client.sov,
              trend,
            };
          } catch (err) {
            console.error(`[InsightsWorker] SOV calculation failed for ${client.name}:`, err);
          }

          // Obtener temas principales
          let topTopics: { name: string; count: number }[] = [];
          try {
            const topicStats = await getTopicStats(client.id, 7);
            topTopics = topicStats.topics.slice(0, 5).map((t) => ({
              name: t.name,
              count: t.count,
            }));
          } catch (err) {
            console.error(`[InsightsWorker] Topic stats failed for ${client.name}:`, err);
          }

          // Obtener competidores
          const competitorKeywords = client.keywords.filter(
            (k) => k.type === "COMPETITOR" && k.active
          );
          const competitors: { name: string; sov: number }[] = [];

          if (competitorKeywords.length > 0) {
            const competitorClients = await prisma.client.findMany({
              where: {
                orgId: client.orgId,
                OR: competitorKeywords.map((k) => ({
                  name: { contains: k.word, mode: "insensitive" as const },
                })),
                active: true,
                id: { not: client.id },
              },
            });

            for (const comp of competitorClients) {
              try {
                const compSov = await calculateSOV(comp.id, 7, false);
                competitors.push({
                  name: comp.name,
                  sov: compSov.client.sov,
                });
              } catch {
                // Skip competitor if SOV fails
              }
            }
          }

          // Generar insights con IA
          const topMentions = mentions.slice(0, 5).map((m) => ({
            title: m.article.title,
            source: m.article.source,
            sentiment: m.sentiment,
          }));

          const insightsResult = await generateWeeklyInsights({
            clientName: client.name,
            clientIndustry: client.industry || "",
            weeklyStats: {
              totalMentions: mentions.length,
              previousWeekMentions,
              sentimentBreakdown,
              sovPercentage: sovData.sov,
              sovTrend: sovData.trend,
            },
            topMentions,
            topTopics,
            competitors,
          });

          // Guardar en base de datos
          await prisma.weeklyInsight.upsert({
            where: {
              clientId_weekStart: {
                clientId: client.id,
                weekStart,
              },
            },
            create: {
              clientId: client.id,
              weekStart,
              insights: insightsResult.insights,
              sovData: {
                sov: sovData.sov,
                trend: sovData.trend,
                analysis: insightsResult.sovAnalysis,
              },
              topTopics: topTopics,
            },
            update: {
              insights: insightsResult.insights,
              sovData: {
                sov: sovData.sov,
                trend: sovData.trend,
                analysis: insightsResult.sovAnalysis,
              },
              topTopics: topTopics,
            },
          });

          console.log(`[InsightsWorker] Insights saved for ${client.name}`);
        } catch (err) {
          console.error(`[InsightsWorker] Error processing ${client.name}:`, err);
        }
      }

      console.log("[InsightsWorker] Weekly insights generation completed");
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[InsightsWorker] Job ${job?.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[InsightsWorker] Job ${job?.id} failed:`, err);
  });

  console.log("🧠 Insights worker started");

  return worker;
}

/**
 * Worker que extrae temas de menciones individuales.
 */
export function startTopicWorker() {
  const worker = new Worker(
    QUEUE_NAMES.EXTRACT_TOPIC,
    async (job) => {
      const { mentionId } = job.data;

      if (!mentionId) {
        throw new Error("mentionId is required");
      }

      console.log(`[TopicWorker] Extracting topic for mention: ${mentionId}`);

      const { processMentionTopic } = await import("./topic-extractor.js");
      const topic = await processMentionTopic(mentionId);

      return { mentionId, topic };
    },
    {
      connection,
      concurrency: 5, // Procesar varios en paralelo
    }
  );

  worker.on("completed", (job, result) => {
    if (result?.topic) {
      console.log(`[TopicWorker] Extracted topic "${result.topic}" for mention ${result.mentionId}`);
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[TopicWorker] Job ${job?.id} failed:`, err);
  });

  console.log("🏷️ Topic extraction worker started");

  return worker;
}
