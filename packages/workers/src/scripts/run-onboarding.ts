/**
 * Script to run onboarding for existing clients.
 *
 * Usage:
 *   npx tsx packages/workers/src/scripts/run-onboarding.ts [clientId]
 *   npx tsx packages/workers/src/scripts/run-onboarding.ts --all
 *   npx tsx packages/workers/src/scripts/run-onboarding.ts --no-keywords
 *
 * Options:
 *   [clientId]      Run onboarding for a specific client by ID
 *   --all           Run onboarding for ALL clients
 *   --no-keywords   Only process clients that have 0-1 keywords (name only)
 */
import "dotenv/config";
import { prisma } from "@mediabot/shared";
import { getQueue, QUEUE_NAMES } from "../queues.js";

async function main() {
  const args = process.argv.slice(2);
  const onboardingQueue = getQueue(QUEUE_NAMES.ONBOARDING);

  // Parse flags
  const runAll = args.includes("--all");
  const noKeywords = args.includes("--no-keywords");
  const clientId = args.find((arg) => !arg.startsWith("--"));

  if (!runAll && !noKeywords && !clientId) {
    console.log(`
Usage:
  npx tsx packages/workers/src/scripts/run-onboarding.ts [clientId]
  npx tsx packages/workers/src/scripts/run-onboarding.ts --all
  npx tsx packages/workers/src/scripts/run-onboarding.ts --no-keywords

Options:
  [clientId]      Run onboarding for a specific client by ID
  --all           Run onboarding for ALL clients
  --no-keywords   Only process clients that have 0-1 keywords (name only)
`);
    process.exit(0);
  }

  // Get clients based on args
  let clients;

  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { _count: { select: { keywords: { where: { active: true } } } } },
    });
    if (!client) {
      console.error(`Client not found: ${clientId}`);
      process.exit(1);
    }
    clients = [client];
  } else {
    clients = await prisma.client.findMany({
      where: { active: true },
      include: { _count: { select: { keywords: { where: { active: true } } } } },
    });

    if (noKeywords) {
      // Filter to only clients with 0-1 keywords (just the auto-added name)
      clients = clients.filter((c) => c._count.keywords <= 1);
    }
  }

  console.log(`Found ${clients.length} client(s) to process`);

  if (clients.length === 0) {
    console.log("No clients to process");
    await onboardingQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  // List clients
  console.log("\nClients to onboard:");
  for (const client of clients) {
    console.log(`  - ${client.name} (${client.id}) - ${client._count.keywords} keywords`);
  }
  console.log("");

  // Enqueue onboarding jobs
  let enqueued = 0;
  for (const client of clients) {
    await onboardingQueue.add(
      "onboard",
      { clientId: client.id },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }
    );
    console.log(`Queued onboarding for: ${client.name}`);
    enqueued++;
  }

  console.log(`\nEnqueued ${enqueued} onboarding job(s)`);
  console.log("Jobs will be processed by the workers service.");

  await onboardingQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Run-onboarding script failed:", err);
  process.exit(1);
});
