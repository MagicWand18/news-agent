import "dotenv/config";
import { setupQueues } from "./queues.js";
import { startCollectorWorkers } from "./collectors/index.js";
import { startAnalysisWorker } from "./analysis/worker.js";
import { startOnboardingWorker } from "./analysis/onboarding-worker.js";
import { startNotificationWorker } from "./notifications/worker.js";
import { startDigestWorker } from "./notifications/digest.js";

async function main() {
  console.log("🔄 Starting MediaBot workers...");

  const queues = setupQueues();

  // Start all workers
  startCollectorWorkers(queues);
  startAnalysisWorker();
  startOnboardingWorker();
  startNotificationWorker();
  startDigestWorker();

  console.log("✅ All workers started");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("⏹️ Shutting down workers...");
    await queues.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(console.error);
