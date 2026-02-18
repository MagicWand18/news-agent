/**
 * Script one-off: Re-analiza menciones NEUTRAL de los últimos 7 días.
 * Encola jobs de analyze-mention con delay incremental para no saturar Gemini.
 *
 * Uso: npx tsx scripts/reanalyze-neutral.ts
 */

import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const BATCH_SIZE = 50;
const DELAY_BETWEEN_JOBS_MS = 3000; // 3s entre cada job

async function main() {
  const prisma = new PrismaClient();
  const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue("analyze-mention", { connection: redis });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const neutralMentions = await prisma.mention.findMany({
    where: {
      sentiment: "NEUTRAL",
      createdAt: { gte: sevenDaysAgo },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`[Reanalyze] Found ${neutralMentions.length} NEUTRAL mentions from last 7 days`);

  let queued = 0;
  for (const mention of neutralMentions) {
    await queue.add(
      "reanalyze",
      { mentionId: mention.id },
      {
        delay: queued * DELAY_BETWEEN_JOBS_MS,
        attempts: 2,
        backoff: { type: "exponential", delay: 10000 },
      }
    );
    queued++;

    if (queued % BATCH_SIZE === 0) {
      console.log(`[Reanalyze] Queued ${queued}/${neutralMentions.length}...`);
    }
  }

  console.log(`[Reanalyze] Done! Queued ${queued} jobs with ${DELAY_BETWEEN_JOBS_MS}ms delay between each.`);
  console.log(`[Reanalyze] Estimated completion: ~${Math.round((queued * DELAY_BETWEEN_JOBS_MS) / 60000)} minutes`);

  await queue.close();
  await redis.quit();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Reanalyze] Error:", err);
  process.exit(1);
});
