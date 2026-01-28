/**
 * One-off script to re-enqueue all existing mentions for AI re-analysis.
 * Usage: npx tsx packages/workers/src/scripts/reanalyze.ts
 */
import "dotenv/config";
import { prisma } from "@mediabot/shared";
import { getQueue, QUEUE_NAMES } from "../queues.js";

async function main() {
  const analyzeQueue = getQueue(QUEUE_NAMES.ANALYZE_MENTION);

  // Find mentions that were analyzed as NEUTRAL with the default fallback summary
  // (indicates failed parsing), or all mentions if --all flag is passed
  const all = process.argv.includes("--all");

  const where = all
    ? {}
    : { sentiment: "NEUTRAL" as const };

  const mentions = await prisma.mention.findMany({
    where,
    select: { id: true, sentiment: true, aiSummary: true },
  });

  console.log(`Found ${mentions.length} mentions to re-analyze${all ? " (all)" : " (NEUTRAL only)"}`);

  let enqueued = 0;
  for (const mention of mentions) {
    await analyzeQueue.add(
      "reanalyze",
      { mentionId: mention.id },
      { priority: 3 } // Lower priority than real-time analysis
    );
    enqueued++;
  }

  console.log(`Enqueued ${enqueued} mentions for re-analysis`);

  await analyzeQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Re-analyze script failed:", err);
  process.exit(1);
});
