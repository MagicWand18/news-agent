/**
 * Worker para analizar menciones de redes sociales.
 *
 * Procesa SocialMention con análisis de sentimiento adaptado
 * a contenido corto (tweets, captions, etc).
 */

import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { prisma, config } from "@mediabot/shared";
import { analyzeSocialMention } from "./ai.js";
import type { Sentiment, Urgency } from "@prisma/client";

// Influencers con alto alcance (umbral de seguidores)
const HIGH_REACH_THRESHOLD = 10000;
const VERIFIED_THRESHOLD = 50000;

export function startSocialAnalysisWorker() {
  const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_ALERT);

  const worker = new Worker(
    QUEUE_NAMES.ANALYZE_SOCIAL,
    async (job) => {
      const { mentionId } = job.data as { mentionId: string };

      const mention = await prisma.socialMention.findUnique({
        where: { id: mentionId },
        include: {
          client: true,
        },
      });

      if (!mention || mention.analyzed) return;

      console.log(`[SocialAnalysis] Analyzing mention ${mentionId} (${mention.platform})`);

      // Ejecutar análisis con IA
      const analysis = await analyzeSocialMention({
        platform: mention.platform,
        content: mention.content || "",
        authorHandle: mention.authorHandle,
        authorFollowers: mention.authorFollowers || undefined,
        engagement: {
          likes: mention.likes,
          comments: mention.comments,
          shares: mention.shares,
          views: mention.views || undefined,
        },
        clientName: mention.client.name,
        clientDescription: mention.client.description || undefined,
        sourceType: mention.sourceType,
        sourceValue: mention.sourceValue,
      });

      // Calcular urgencia basada en engagement y seguidores
      const urgency = classifySocialUrgency(
        analysis.relevance,
        analysis.sentiment,
        analysis.engagementLevel,
        mention.authorFollowers
      );

      // Actualizar mención con resultados del análisis
      await prisma.socialMention.update({
        where: { id: mentionId },
        data: {
          aiSummary: analysis.summary,
          sentiment: analysis.sentiment as Sentiment,
          relevance: analysis.relevance,
          analyzed: true,
        },
      });

      console.log(`[SocialAnalysis] Mention ${mentionId}: ${analysis.sentiment}, relevance ${analysis.relevance}, urgency ${urgency}`);

      // Encolar notificación si es urgente
      // Para redes sociales, notificamos en HIGH y CRITICAL
      if (urgency === "CRITICAL" || (urgency === "HIGH" && analysis.relevance >= 7)) {
        await notifyQueue.add("social-alert", {
          type: "social",
          socialMentionId: mentionId,
          platform: mention.platform,
          urgency,
        }, {
          priority: urgency === "CRITICAL" ? 1 : 2,
        });
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
    console.error(`Social analysis job ${job?.id} failed:`, err);
  });

  worker.on("completed", (job) => {
    console.log(`[SocialAnalysis] Job ${job?.id} completed`);
  });

  console.log(`📱 Social analysis worker started`);
}

/**
 * Clasifica la urgencia de una mención social basándose en
 * relevancia, sentimiento, engagement y alcance del autor.
 */
function classifySocialUrgency(
  relevance: number,
  sentiment: string,
  engagementLevel: string,
  authorFollowers: number | null
): Urgency {
  const followers = authorFollowers || 0;
  const isHighReach = followers >= HIGH_REACH_THRESHOLD;
  const isVerifiedLevel = followers >= VERIFIED_THRESHOLD;
  const isHighEngagement = engagementLevel === "HIGH";

  // CRITICAL: Mención negativa de alto impacto
  if (
    sentiment === "NEGATIVE" &&
    relevance >= 8 &&
    (isVerifiedLevel || isHighEngagement)
  ) {
    return "CRITICAL";
  }

  // HIGH: Mención relevante con alcance o engagement alto
  if (
    relevance >= 7 &&
    (isHighReach || isHighEngagement || sentiment === "NEGATIVE")
  ) {
    return "HIGH";
  }

  // MEDIUM: Mención moderadamente relevante
  if (relevance >= 5 || isHighReach) {
    return "MEDIUM";
  }

  return "LOW";
}

/**
 * Encola menciones sociales pendientes de análisis.
 * Se ejecuta después de la recolección.
 */
export async function enqueuePendingSocialAnalysis(): Promise<number> {
  const analyzeQueue = getQueue(QUEUE_NAMES.ANALYZE_SOCIAL);

  // Obtener menciones no analizadas de las últimas 24 horas
  const pendingMentions = await prisma.socialMention.findMany({
    where: {
      analyzed: false,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true },
    take: 100, // Procesar en lotes
  });

  for (const mention of pendingMentions) {
    await analyzeQueue.add(
      "analyze",
      { mentionId: mention.id },
      {
        jobId: `social-analyze-${mention.id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }
    );
  }

  console.log(`[SocialAnalysis] Enqueued ${pendingMentions.length} mentions for analysis`);
  return pendingMentions.length;
}
