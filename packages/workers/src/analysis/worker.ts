import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { prisma, config, getSettingNumber } from "@mediabot/shared";
import { publishRealtimeEvent } from "@mediabot/shared/src/realtime-publisher.js";
import { REALTIME_CHANNELS } from "@mediabot/shared/src/realtime-types.js";
import { analyzeMention } from "./ai.js";
import { processMentionForCrisis } from "./crisis-detector.js";
import { findClusterParent } from "./clustering.js";
import type { Urgency, Sentiment } from "@prisma/client";

// High-reach Spanish-language media sources
const HIGH_REACH_SOURCES = new Set([
  // Spain
  "elpais.com", "elmundo.es", "lavanguardia.com", "abc.es",
  "20minutos.es", "europapress.es", "efe.com", "rtve.es",
  "elconfidencial.com",
  // Mexico
  "milenio.com", "reforma.com", "expansion.mx", "jornada.com.mx",
  "eluniversal.com.mx", "excelsior.com.mx", "proceso.com.mx",
  "sinembargo.mx", "lopezdoriga.com",
  // International
  "infobae.com", "cnn", "bbc", "reuters",
]);

export function startAnalysisWorker() {
  const worker = new Worker(
    QUEUE_NAMES.ANALYZE_MENTION,
    async (job) => {
      const { mentionId } = job.data as { mentionId: string };

      const mention = await prisma.mention.findUnique({
        where: { id: mentionId },
        include: {
          article: true,
          client: true,
        },
      });

      if (!mention) return;

      // Run AI analysis
      const analysis = await analyzeMention({
        articleTitle: mention.article.title,
        articleContent: mention.article.content || mention.snippet || "",
        source: mention.article.source,
        clientName: mention.client.name,
        clientDescription: mention.client.description || "",
        clientIndustry: mention.client.industry || "",
        keyword: mention.keywordMatched,
      });

      // Classify urgency using dynamic settings
      const urgency = await classifyUrgency(
        analysis.relevance,
        analysis.sentiment,
        mention.article.source
      );

      // Update mention with analysis results
      await prisma.mention.update({
        where: { id: mentionId },
        data: {
          aiSummary: analysis.summary,
          aiAction: analysis.suggestedAction,
          sentiment: analysis.sentiment as Sentiment,
          relevance: analysis.relevance,
          urgency: urgency as Urgency,
        },
      });

      // Publicar evento realtime con resultados del análisis
      publishRealtimeEvent(REALTIME_CHANNELS.MENTION_ANALYZED, {
        id: mentionId,
        clientId: mention.clientId,
        orgId: mention.client.orgId ?? null,
        title: mention.article.title,
        source: mention.article.source,
        sentiment: analysis.sentiment,
        urgency,
        timestamp: new Date().toISOString(),
      });

      // Run clustering for relevant mentions
      if (analysis.relevance >= 5) {
        try {
          const cluster = await findClusterParent({
            mentionId,
            clientId: mention.clientId,
            articleTitle: mention.article.title,
            aiSummary: analysis.summary,
          });

          if (cluster.parentId) {
            await prisma.mention.update({
              where: { id: mentionId },
              data: {
                parentMentionId: cluster.parentId,
                clusterScore: cluster.score,
              },
            });
            console.log(`[Analysis] Mention ${mentionId} clustered with parent ${cluster.parentId} (score: ${cluster.score.toFixed(2)})`);
          }
        } catch (error) {
          console.error(`[Analysis] Clustering failed for mention ${mentionId}:`, error);
        }
      }

      // Skip notificaciones y crisis para menciones legacy (contexto histórico)
      // o menciones con publishedAt > 30 días (artículos viejos recién descubiertos)
      const publishedAt = mention.publishedAt || mention.article.publishedAt;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const isOldArticle = publishedAt && new Date(publishedAt) < thirtyDaysAgo;

      if (mention.isLegacy || isOldArticle) {
        console.log(`[Analysis] Mention ${mentionId} is ${mention.isLegacy ? "legacy" : "old article"}, skipping notification and crisis check`);
      } else {
        // Notificaciones se manejan a nivel de tema (NOTIFY_TOPIC) via topic extraction pipeline
        if (analysis.sentiment === "NEGATIVE") {
          try {
            await processMentionForCrisis(mentionId);
          } catch (error) {
            console.error(`Crisis check failed for mention ${mentionId}:`, error);
          }
        }
      }

      // Enqueue topic extraction (Sprint 6)
      try {
        const topicQueue = getQueue(QUEUE_NAMES.EXTRACT_TOPIC);
        await topicQueue.add("extract", { mentionId }, { delay: 1000 });
      } catch (error) {
        console.error(`[Analysis] Topic extraction enqueue failed for mention ${mentionId}:`, error);
      }
    },
    {
      connection,
      concurrency: config.workers.analysis.concurrency,
      limiter: {
        max: config.workers.analysis.rateLimitMax,
        duration: config.workers.analysis.rateLimitWindowMs,
      },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`Analysis job ${job?.id} failed:`, err);
  });

  console.log(`🧠 Analysis worker started (concurrency: ${config.workers.analysis.concurrency}, rate: ${config.workers.analysis.rateLimitMax}/${config.workers.analysis.rateLimitWindowMs}ms)`);
}

async function classifyUrgency(
  relevance: number,
  sentiment: string,
  source: string
): Promise<string> {
  // Get thresholds from settings (with fallbacks)
  const criticalMinRelevance = await getSettingNumber("urgency.critical_min_relevance", 8);
  const highMinRelevance = await getSettingNumber("urgency.high_min_relevance", 7);
  const mediumMinRelevance = await getSettingNumber("urgency.medium_min_relevance", 4);

  const sourceLower = source.toLowerCase();
  const isHighReach = [...HIGH_REACH_SOURCES].some((s) =>
    sourceLower.includes(s)
  );

  if (relevance >= criticalMinRelevance && sentiment === "NEGATIVE" && isHighReach) {
    return "CRITICAL";
  }
  if (relevance >= highMinRelevance || sentiment === "NEGATIVE") {
    return "HIGH";
  }
  if (relevance >= mediumMinRelevance) {
    return "MEDIUM";
  }
  return "LOW";
}
