/**
 * Worker para analizar menciones de redes sociales.
 *
 * Procesa SocialMention con análisis de sentimiento adaptado
 * a contenido corto (tweets, captions, etc).
 */

import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { prisma, config } from "@mediabot/shared";
import { analyzeSocialMention, analyzeCommentsSentiment } from "./ai.js";
import type { SocialComment } from "@mediabot/shared";
import type { Sentiment, Urgency } from "@prisma/client";

// Influencers con alto alcance (umbral de seguidores)
const HIGH_REACH_THRESHOLD = 10000;
const VERIFIED_THRESHOLD = 50000;

export function startSocialAnalysisWorker() {
  const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_ALERT);

  const worker = new Worker(
    QUEUE_NAMES.ANALYZE_SOCIAL,
    async (job) => {
      const { mentionId, hasComments } = job.data as { mentionId: string; hasComments?: boolean };

      const mention = await prisma.socialMention.findUnique({
        where: { id: mentionId },
        include: {
          client: true,
        },
      });

      if (!mention) return;

      // Si es análisis de comentarios, procesar diferente
      if (hasComments && mention.commentsData && !mention.commentsAnalyzed) {
        return await analyzeCommentsJob(mention, notifyQueue);
      }

      // Análisis normal del post (si ya está analizado, omitir)
      if (mention.analyzed) return;

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

      // No notificar posts con más de 30 días de antigüedad
      const postedAt = mention.postedAt;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const isOldPost = postedAt && new Date(postedAt) < thirtyDaysAgo;

      // Encolar notificación si es urgente y no es un post viejo
      if (!isOldPost && (urgency === "CRITICAL" || (urgency === "HIGH" && analysis.relevance >= 7))) {
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
      postedAt: {
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

/**
 * Analiza los comentarios extraídos de una mención.
 * Se ejecuta después de la extracción de comentarios.
 */
async function analyzeCommentsJob(
  mention: {
    id: string;
    platform: string;
    content: string | null;
    commentsData: unknown;
    analyzed: boolean;
    sourceType: string;
    sourceValue: string;
    client: { name: string; description: string | null; industry: string | null };
    authorHandle: string;
    authorFollowers: number | null;
    likes: number;
    comments: number;
    shares: number;
    views: number | null;
  },
  notifyQueue: ReturnType<typeof getQueue>
) {
  console.log(`[SocialAnalysis] Analyzing comments for mention ${mention.id}`);

  // Parsear comentarios del JSON
  const comments = mention.commentsData as SocialComment[];
  if (!comments || comments.length === 0) {
    console.log(`[SocialAnalysis] No comments to analyze for mention ${mention.id}`);
    return;
  }

  // Ejecutar análisis de sentimiento de comentarios con contexto completo
  const analysis = await analyzeCommentsSentiment({
    platform: mention.platform,
    postContent: mention.content,
    comments: comments.map((c) => ({
      text: c.text,
      likes: c.likes,
      authorHandle: c.authorHandle,
    })),
    clientName: mention.client.name,
    clientDescription: mention.client.description || undefined,
    clientIndustry: mention.client.industry || undefined,
    authorHandle: mention.authorHandle,
    authorFollowers: mention.authorFollowers || undefined,
    engagement: {
      likes: mention.likes,
      comments: mention.comments,
      shares: mention.shares,
      views: mention.views || undefined,
    },
  });

  // Si el post no ha sido analizado aún, también ejecutar análisis del post
  let postAnalysisData: Record<string, unknown> = {};
  if (!mention.analyzed) {
    console.log(`[SocialAnalysis] Post ${mention.id} not yet analyzed, running post analysis too`);
    const postAnalysis = await analyzeSocialMention({
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
    postAnalysisData = {
      sentiment: postAnalysis.sentiment as Sentiment,
      relevance: postAnalysis.relevance,
      analyzed: true,
    };
  }

  // Combinar resumen: percepción pública de comentarios + resumen del post si existe
  const updatedSummary = analysis.publicPerception;

  await prisma.socialMention.update({
    where: { id: mention.id },
    data: {
      commentsSentiment: analysis.overallSentiment as Sentiment,
      commentsAnalyzed: true,
      aiSummary: updatedSummary,
      ...postAnalysisData,
    },
  });

  console.log(
    `[SocialAnalysis] Comments analyzed for ${mention.id}: ${analysis.overallSentiment}, risk: ${analysis.riskLevel}`
  );

  // Si el riesgo es HIGH, enviar notificación de alerta
  if (analysis.riskLevel === "HIGH") {
    await notifyQueue.add(
      "social-comments-alert",
      {
        type: "social-comments",
        socialMentionId: mention.id,
        platform: mention.platform,
        riskLevel: analysis.riskLevel,
        publicPerception: analysis.publicPerception,
        topConcerns: analysis.topConcerns,
      },
      {
        priority: 1, // Alta prioridad para alertas de riesgo
      }
    );
    console.log(`[SocialAnalysis] HIGH risk alert enqueued for mention ${mention.id}`);
  }

  return {
    sentiment: analysis.overallSentiment,
    riskLevel: analysis.riskLevel,
    commentsAnalyzed: comments.length,
  };
}
