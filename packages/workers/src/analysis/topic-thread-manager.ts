/**
 * Motor de Topic Threads (Sprint 19).
 * Agrupa menciones del mismo tema por cliente en hilos temáticos.
 */
import { prisma } from "@mediabot/shared";
import { getQueue, QUEUE_NAMES } from "../queues.js";
import type { Sentiment } from "@prisma/client";

// Umbrales de notificación por cantidad de menciones
const NOTIFICATION_THRESHOLDS = [5, 10, 20, 50];

// Máximo de notificaciones TOPIC_NEW por cliente por día
const MAX_DAILY_NEW_TOPIC_NOTIFS = 10;

// Cooldown de sentiment_shift por thread (4 horas)
const SENTIMENT_SHIFT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

// Ventana para reabrir thread cerrado (72 horas)
const REOPEN_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Asigna una mención a un TopicThread existente o crea uno nuevo.
 * Se llama DESPUÉS de que topic-extractor asigna el topic.
 */
export async function assignMentionToThread(
  mentionId: string,
  type: "mention" | "social"
): Promise<{ threadId: string } | null> {
  try {
    // Cargar mención con datos necesarios
    let topic: string | null = null;
    let clientId: string | null = null;
    let sentiment: string | null = null;
    let source: string | null = null;

    if (type === "mention") {
      const mention = await prisma.mention.findUnique({
        where: { id: mentionId },
        include: { article: { select: { source: true } } },
      });
      if (!mention) return null;
      topic = mention.topic;
      clientId = mention.clientId;
      sentiment = mention.sentiment;
      source = mention.article.source;
    } else {
      const socialMention = await prisma.socialMention.findUnique({
        where: { id: mentionId },
      });
      if (!socialMention) return null;
      topic = socialMention.topic;
      clientId = socialMention.clientId;
      sentiment = socialMention.sentiment;
      source = socialMention.authorHandle;
    }

    // Si no hay topic, no asignar
    if (!topic || !clientId) return null;

    const normalizedName = topic.toLowerCase().trim();

    // Buscar thread ACTIVE para este client + normalizedName
    let thread = await prisma.topicThread.findFirst({
      where: {
        clientId,
        normalizedName,
        status: "ACTIVE",
      },
    });

    const previousSentiment = thread?.dominantSentiment ?? null;

    if (thread) {
      // Thread existente: actualizar stats y vincular
      const updateData =
        type === "mention"
          ? { mentionCount: { increment: 1 } }
          : { socialMentionCount: { increment: 1 } };

      await prisma.topicThread.update({
        where: { id: thread.id },
        data: {
          ...updateData,
          lastMentionAt: new Date(),
        },
      });

      // Vincular mención al thread
      if (type === "mention") {
        await prisma.mention.update({
          where: { id: mentionId },
          data: { topicThreadId: thread.id },
        });
      } else {
        await prisma.socialMention.update({
          where: { id: mentionId },
          data: { topicThreadId: thread.id },
        });
      }

      // Crear evento MENTION_ADDED
      await prisma.topicThreadEvent.create({
        data: {
          topicThreadId: thread.id,
          type: "MENTION_ADDED",
          data: { mentionId, mentionType: type, sentiment, source },
        },
      });
    } else {
      // Buscar thread CLOSED reciente para posible reapertura
      const closedThread = await prisma.topicThread.findFirst({
        where: {
          clientId,
          normalizedName,
          status: "CLOSED",
          lastMentionAt: { gte: new Date(Date.now() - REOPEN_WINDOW_MS) },
        },
        orderBy: { lastMentionAt: "desc" },
      });

      if (closedThread) {
        // Reabrir thread cerrado
        const updateData =
          type === "mention"
            ? { mentionCount: { increment: 1 } }
            : { socialMentionCount: { increment: 1 } };

        thread = await prisma.topicThread.update({
          where: { id: closedThread.id },
          data: {
            status: "ACTIVE",
            closedAt: null,
            lastMentionAt: new Date(),
            ...updateData,
          },
        });

        await prisma.topicThreadEvent.create({
          data: {
            topicThreadId: thread.id,
            type: "REOPENED",
            data: { mentionId, mentionType: type },
          },
        });
      } else {
        // Crear nuevo thread
        const initCount =
          type === "mention"
            ? { mentionCount: 1, socialMentionCount: 0 }
            : { mentionCount: 0, socialMentionCount: 1 };

        thread = await prisma.topicThread.create({
          data: {
            clientId,
            name: topic,
            normalizedName,
            ...initCount,
            dominantSentiment: sentiment,
            sentimentBreakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
            topSources: source ? [source] : [],
          },
        });

        await prisma.topicThreadEvent.create({
          data: {
            topicThreadId: thread.id,
            type: "CREATED",
            data: { mentionId, mentionType: type, topic },
          },
        });
      }

      // Vincular mención al thread
      if (type === "mention") {
        await prisma.mention.update({
          where: { id: mentionId },
          data: { topicThreadId: thread.id },
        });
      } else {
        await prisma.socialMention.update({
          where: { id: mentionId },
          data: { topicThreadId: thread.id },
        });
      }
    }

    // Recalcular stats del thread
    await recalculateThreadStats(thread.id);

    // Recargar thread con stats actualizadas para verificar eventos de notificación
    const updatedThread = await prisma.topicThread.findUnique({
      where: { id: thread.id },
    });

    if (updatedThread) {
      await checkThreadNotificationEvents(updatedThread, previousSentiment, mentionId, type);
    }

    return { threadId: thread.id };
  } catch (error) {
    console.error(`[TopicThreadManager] Error assigning ${type} ${mentionId} to thread:`, error);
    return null;
  }
}

/**
 * Recalcula las stats agregadas de un thread.
 */
export async function recalculateThreadStats(threadId: string): Promise<void> {
  const thread = await prisma.topicThread.findUnique({
    where: { id: threadId },
    include: {
      mentions: {
        select: { sentiment: true, article: { select: { source: true } } },
      },
      socialMentions: {
        select: { sentiment: true, authorHandle: true },
      },
    },
  });

  if (!thread) return;

  // Calcular sentiment breakdown
  const breakdown = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  const sources = new Set<string>();

  for (const m of thread.mentions) {
    const key = m.sentiment.toLowerCase() as keyof typeof breakdown;
    if (key in breakdown) breakdown[key]++;
    if (m.article.source) sources.add(m.article.source);
  }

  for (const sm of thread.socialMentions) {
    const key = sm.sentiment.toLowerCase() as keyof typeof breakdown;
    if (key in breakdown) breakdown[key]++;
  }

  // Calcular sentimiento dominante
  const total = breakdown.positive + breakdown.negative + breakdown.neutral + breakdown.mixed;
  let dominantSentiment: string = "NEUTRAL";
  if (total > 0) {
    const max = Math.max(breakdown.positive, breakdown.negative, breakdown.neutral, breakdown.mixed);
    if (max === breakdown.positive) dominantSentiment = "POSITIVE";
    else if (max === breakdown.negative) dominantSentiment = "NEGATIVE";
    else if (max === breakdown.mixed) dominantSentiment = "MIXED";
    else dominantSentiment = "NEUTRAL";
  }

  // Top sources (máximo 10)
  const topSources = [...sources].slice(0, 10);

  await prisma.topicThread.update({
    where: { id: threadId },
    data: {
      mentionCount: thread.mentions.length,
      socialMentionCount: thread.socialMentions.length,
      sentimentBreakdown: JSON.parse(JSON.stringify(breakdown)),
      dominantSentiment,
      topSources: JSON.parse(JSON.stringify(topSources)),
    },
  });
}

/**
 * Verifica si hay eventos notificables después de actualizar un thread.
 */
async function checkThreadNotificationEvents(
  thread: {
    id: string;
    clientId: string;
    mentionCount: number;
    socialMentionCount: number;
    dominantSentiment: string | null;
    lastNotifiedAt: Date | null;
    thresholdsReached: unknown;
  },
  previousSentiment: string | null,
  mentionId: string,
  mentionType: "mention" | "social"
): Promise<void> {
  const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_TOPIC);
  const totalCount = thread.mentionCount + thread.socialMentionCount;
  const reachedThresholds = (thread.thresholdsReached as number[]) || [];

  // Evento: TOPIC_NEW (thread tiene ≥2 menciones)
  if (totalCount === 2) {
    // Verificar límite diario de notifs
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await prisma.topicThreadEvent.count({
      where: {
        topicThread: { clientId: thread.clientId },
        type: "CREATED",
        createdAt: { gte: startOfDay },
      },
    });

    if (todayCount < MAX_DAILY_NEW_TOPIC_NOTIFS) {
      await notifyQueue.add("topic-new", {
        topicThreadId: thread.id,
        eventType: "new",
        clientId: thread.clientId,
      });
    }
  }

  // Evento: THRESHOLD_REACHED
  for (const threshold of NOTIFICATION_THRESHOLDS) {
    if (totalCount >= threshold && !reachedThresholds.includes(threshold)) {
      const updatedThresholds = [...reachedThresholds, threshold];
      await prisma.topicThread.update({
        where: { id: thread.id },
        data: {
          thresholdsReached: JSON.parse(JSON.stringify(updatedThresholds)),
        },
      });

      await prisma.topicThreadEvent.create({
        data: {
          topicThreadId: thread.id,
          type: "THRESHOLD_REACHED",
          data: { threshold, totalCount },
        },
      });

      await notifyQueue.add("topic-threshold", {
        topicThreadId: thread.id,
        eventType: "threshold",
        clientId: thread.clientId,
        threshold,
      });
      break; // Solo notificar un umbral a la vez
    }
  }

  // Evento: SENTIMENT_SHIFT
  if (
    previousSentiment &&
    thread.dominantSentiment &&
    previousSentiment !== thread.dominantSentiment
  ) {
    // Cooldown: no más de 1 por thread cada 4h
    const canNotify =
      !thread.lastNotifiedAt ||
      Date.now() - thread.lastNotifiedAt.getTime() > SENTIMENT_SHIFT_COOLDOWN_MS;

    if (canNotify) {
      await prisma.topicThreadEvent.create({
        data: {
          topicThreadId: thread.id,
          type: "SENTIMENT_SHIFT",
          data: {
            oldSentiment: previousSentiment,
            newSentiment: thread.dominantSentiment,
            mentionId,
            mentionType,
          },
        },
      });

      await notifyQueue.add("topic-sentiment-shift", {
        topicThreadId: thread.id,
        eventType: "sentiment_shift",
        clientId: thread.clientId,
        oldSentiment: previousSentiment,
        newSentiment: thread.dominantSentiment,
      });
    }
  }
}

/**
 * Cierra threads inactivos (sin menciones en 72h).
 */
export async function closeInactiveThreads(): Promise<number> {
  const cutoff = new Date(Date.now() - REOPEN_WINDOW_MS);

  const inactiveThreads = await prisma.topicThread.findMany({
    where: {
      status: "ACTIVE",
      lastMentionAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (inactiveThreads.length === 0) return 0;

  for (const thread of inactiveThreads) {
    await prisma.topicThread.update({
      where: { id: thread.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    await prisma.topicThreadEvent.create({
      data: {
        topicThreadId: thread.id,
        type: "CLOSED",
        data: { reason: "inactivity", cutoffHours: 72 },
      },
    });
  }

  console.log(`[TopicThreadManager] Closed ${inactiveThreads.length} inactive threads`);
  return inactiveThreads.length;
}
