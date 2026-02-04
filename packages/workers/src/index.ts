import "dotenv/config";
import { setupQueues } from "./queues.js";
import { startCollectorWorkers } from "./collectors/index.js";
import { startAnalysisWorker } from "./analysis/worker.js";
import { startSocialAnalysisWorker } from "./analysis/social-worker.js";
import { startOnboardingWorker } from "./analysis/onboarding-worker.js";
import { startNotificationWorker } from "./notifications/worker.js";
import { startDigestWorker } from "./notifications/digest.js";
import { startReportWorker } from "./reports/worker.js";
import { startInsightsWorker, startTopicWorker } from "./analysis/insights-worker.js";
import { startEmergingTopicsWorker } from "./workers/emerging-topics-worker.js";
import {
  startGroundingWorker,
  startLowMentionsWorker,
  startWeeklyGroundingWorker,
} from "./grounding/index.js";
import { startCommentsExtractionWorker } from "./collectors/comments-worker.js";

async function main() {
  console.log("🔄 Starting MediaBot workers...");

  const queues = setupQueues();

  // Start all workers
  startCollectorWorkers(queues);
  startAnalysisWorker();
  startSocialAnalysisWorker();
  startOnboardingWorker();
  startNotificationWorker();
  startDigestWorker();
  startReportWorker();
  startInsightsWorker();
  startTopicWorker();
  startEmergingTopicsWorker();

  // Grounding workers
  startGroundingWorker();
  startLowMentionsWorker();
  startWeeklyGroundingWorker();

  // Social comments extraction worker
  startCommentsExtractionWorker();

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
