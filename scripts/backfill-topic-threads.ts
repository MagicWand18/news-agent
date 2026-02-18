/**
 * Script de backfill para TopicThreads.
 *
 * Modo fast (default): Agrupa menciones que ya tienen topic pero no thread.
 *   Sin IA, sin notificaciones. Solo crea/actualiza threads y vincula.
 *
 * Modo full: Encola menciones sin topic para extracción con IA.
 *   Usa el pipeline existente (EXTRACT_TOPIC → assignMentionToThread → NOTIFY_TOPIC).
 *
 * Uso:
 *   BACKFILL_MODE=fast DAYS_BACK=30 npx tsx scripts/backfill-topic-threads.ts
 *   BACKFILL_MODE=full DAYS_BACK=14 npx tsx scripts/backfill-topic-threads.ts
 */

import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const BACKFILL_MODE = (process.env.BACKFILL_MODE || "fast") as "fast" | "full";
const DAYS_BACK = parseInt(process.env.DAYS_BACK || "30", 10);
const DELAY_BETWEEN_ITEMS_MS = 200;
const DELAY_BETWEEN_JOBS_MS = 3000;
const PROGRESS_EVERY = 50;

interface ThreadCache {
  id: string;
  mentionCount: number;
  socialMentionCount: number;
}

async function main() {
  const prisma = new PrismaClient();
  const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);
  console.log(`[Backfill] Mode: ${BACKFILL_MODE}, Days back: ${DAYS_BACK}, Since: ${since.toISOString()}`);

  if (BACKFILL_MODE === "fast") {
    await runFastMode(prisma, since);
  } else {
    await runFullMode(prisma, redis, since);
  }

  await redis.quit();
  await prisma.$disconnect();
  console.log("[Backfill] Done!");
}

/**
 * Modo fast: Menciones con topic pero sin thread → crear/vincular threads directamente.
 * No dispara notificaciones NOTIFY_TOPIC.
 */
async function runFastMode(prisma: PrismaClient, since: Date) {
  // Menciones con topic pero sin topicThreadId
  const mentions = await prisma.mention.findMany({
    where: {
      topic: { not: null },
      topicThreadId: null,
      publishedAt: { gte: since },
    },
    select: {
      id: true,
      topic: true,
      clientId: true,
      sentiment: true,
      publishedAt: true,
      createdAt: true,
      article: { select: { source: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  const socialMentions = await prisma.socialMention.findMany({
    where: {
      topic: { not: null },
      topicThreadId: null,
      postedAt: { gte: since },
    },
    select: {
      id: true,
      topic: true,
      clientId: true,
      sentiment: true,
      authorHandle: true,
      postedAt: true,
      createdAt: true,
    },
    orderBy: { postedAt: "desc" },
  });

  console.log(`[Backfill/Fast] Found ${mentions.length} mentions + ${socialMentions.length} social mentions to assign`);

  // Cache de threads para evitar queries repetitivas
  const threadCache = new Map<string, ThreadCache>();
  const touchedThreadIds = new Set<string>();
  let processed = 0;

  // Procesar menciones
  for (const mention of mentions) {
    if (!mention.topic || !mention.clientId) continue;
    const normalizedName = mention.topic.toLowerCase().trim();
    const cacheKey = `${mention.clientId}:${normalizedName}`;

    let thread = threadCache.get(cacheKey);

    if (!thread) {
      // Buscar thread ACTIVE existente
      const existing = await prisma.topicThread.findFirst({
        where: {
          clientId: mention.clientId,
          normalizedName,
          status: "ACTIVE",
        },
        select: { id: true, mentionCount: true, socialMentionCount: true },
      });

      if (existing) {
        thread = { id: existing.id, mentionCount: existing.mentionCount, socialMentionCount: existing.socialMentionCount };
      } else {
        // Crear nuevo thread con fecha de la mención (no now())
        const created = await prisma.topicThread.create({
          data: {
            clientId: mention.clientId,
            name: mention.topic,
            normalizedName,
            mentionCount: 0,
            socialMentionCount: 0,
            dominantSentiment: mention.sentiment,
            sentimentBreakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
            topSources: mention.article.source ? [mention.article.source] : [],
            firstSeenAt: (mention as any).publishedAt || new Date(),
            lastMentionAt: (mention as any).publishedAt || new Date(),
          },
        });
        thread = { id: created.id, mentionCount: 0, socialMentionCount: 0 };
      }

      threadCache.set(cacheKey, thread);
    }

    // Vincular mención
    await prisma.mention.update({
      where: { id: mention.id },
      data: { topicThreadId: thread.id },
    });

    thread.mentionCount++;
    touchedThreadIds.add(thread.id);
    processed++;

    if (processed % PROGRESS_EVERY === 0) {
      console.log(`[Backfill/Fast] Processed ${processed}/${mentions.length + socialMentions.length}...`);
    }

    await sleep(DELAY_BETWEEN_ITEMS_MS);
  }

  // Procesar social mentions
  for (const sm of socialMentions) {
    if (!sm.topic || !sm.clientId) continue;
    const normalizedName = sm.topic.toLowerCase().trim();
    const cacheKey = `${sm.clientId}:${normalizedName}`;

    let thread = threadCache.get(cacheKey);

    if (!thread) {
      const existing = await prisma.topicThread.findFirst({
        where: {
          clientId: sm.clientId,
          normalizedName,
          status: "ACTIVE",
        },
        select: { id: true, mentionCount: true, socialMentionCount: true },
      });

      if (existing) {
        thread = { id: existing.id, mentionCount: existing.mentionCount, socialMentionCount: existing.socialMentionCount };
      } else {
        const created = await prisma.topicThread.create({
          data: {
            clientId: sm.clientId,
            name: sm.topic,
            normalizedName,
            mentionCount: 0,
            socialMentionCount: 0,
            dominantSentiment: sm.sentiment,
            sentimentBreakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
            topSources: [],
            firstSeenAt: sm.postedAt || sm.createdAt || new Date(),
            lastMentionAt: sm.postedAt || sm.createdAt || new Date(),
          },
        });
        thread = { id: created.id, mentionCount: 0, socialMentionCount: 0 };
      }

      threadCache.set(cacheKey, thread);
    }

    await prisma.socialMention.update({
      where: { id: sm.id },
      data: { topicThreadId: thread.id },
    });

    thread.socialMentionCount++;
    touchedThreadIds.add(thread.id);
    processed++;

    if (processed % PROGRESS_EVERY === 0) {
      console.log(`[Backfill/Fast] Processed ${processed}/${mentions.length + socialMentions.length}...`);
    }

    await sleep(DELAY_BETWEEN_ITEMS_MS);
  }

  // Actualizar counts y recalcular stats de cada thread tocado
  console.log(`[Backfill/Fast] Recalculating stats for ${touchedThreadIds.size} threads...`);

  for (const threadId of touchedThreadIds) {
    // Recalcular contadores reales y stats
    const thread = await prisma.topicThread.findUnique({
      where: { id: threadId },
      include: {
        mentions: {
          select: { sentiment: true, publishedAt: true, createdAt: true, article: { select: { source: true } } },
        },
        socialMentions: {
          select: { sentiment: true, postedAt: true, createdAt: true },
        },
      },
    });

    if (!thread) continue;

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

    const total = breakdown.positive + breakdown.negative + breakdown.neutral + breakdown.mixed;
    let dominantSentiment = "NEUTRAL";
    if (total > 0) {
      const max = Math.max(breakdown.positive, breakdown.negative, breakdown.neutral, breakdown.mixed);
      if (max === breakdown.positive) dominantSentiment = "POSITIVE";
      else if (max === breakdown.negative) dominantSentiment = "NEGATIVE";
      else if (max === breakdown.mixed) dominantSentiment = "MIXED";
    }

    // Calcular firstSeenAt y lastMentionAt reales
    const allDates: Date[] = [];
    for (const m of thread.mentions) {
      const d = (m as any).publishedAt || (m as any).createdAt;
      if (d) allDates.push(new Date(d));
    }
    for (const sm of thread.socialMentions) {
      const d = (sm as any).postedAt || (sm as any).createdAt;
      if (d) allDates.push(new Date(d));
    }
    allDates.sort((a, b) => a.getTime() - b.getTime());

    const firstSeenAt = allDates.length > 0 ? allDates[0] : undefined;
    const lastMentionAt = allDates.length > 0 ? allDates[allDates.length - 1] : undefined;

    // Establecer thresholdsReached según mentionCount total
    const totalCount = thread.mentions.length + thread.socialMentions.length;
    const thresholds = [5, 10, 20, 50];
    const thresholdsReached = thresholds.filter((t) => totalCount >= t);

    await prisma.topicThread.update({
      where: { id: threadId },
      data: {
        mentionCount: thread.mentions.length,
        socialMentionCount: thread.socialMentions.length,
        sentimentBreakdown: JSON.parse(JSON.stringify(breakdown)),
        dominantSentiment,
        topSources: JSON.parse(JSON.stringify([...sources].slice(0, 10))),
        ...(firstSeenAt ? { firstSeenAt } : {}),
        ...(lastMentionAt ? { lastMentionAt } : {}),
        thresholdsReached: JSON.parse(JSON.stringify(thresholdsReached)),
      },
    });
  }

  console.log(`[Backfill/Fast] Assigned ${processed} items to ${touchedThreadIds.size} threads`);
}

/**
 * Modo full: Menciones sin topic → encolar en EXTRACT_TOPIC para IA.
 * El pipeline existente extrae topic, asigna a thread y notifica.
 */
async function runFullMode(prisma: PrismaClient, redis: IORedis, since: Date) {
  const queue = new Queue("extract-topic", { connection: redis });

  const mentions = await prisma.mention.findMany({
    where: {
      topic: null,
      topicThreadId: null,
      publishedAt: { gte: since },
    },
    select: { id: true },
    orderBy: { publishedAt: "desc" },
  });

  console.log(`[Backfill/Full] Found ${mentions.length} mentions without topic to enqueue`);

  let queued = 0;
  for (const mention of mentions) {
    await queue.add(
      "extract",
      { mentionId: mention.id },
      {
        delay: queued * DELAY_BETWEEN_JOBS_MS,
        attempts: 2,
        backoff: { type: "exponential", delay: 10000 },
      }
    );
    queued++;

    if (queued % PROGRESS_EVERY === 0) {
      console.log(`[Backfill/Full] Queued ${queued}/${mentions.length}...`);
    }
  }

  console.log(`[Backfill/Full] Queued ${queued} jobs with ${DELAY_BETWEEN_JOBS_MS}ms delay between each`);
  console.log(`[Backfill/Full] Estimated completion: ~${Math.round((queued * DELAY_BETWEEN_JOBS_MS) / 60000)} minutes`);

  await queue.close();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("[Backfill] Error:", err);
  process.exit(1);
});
