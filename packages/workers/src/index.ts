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
import { startWatchdogWorker } from "./workers/watchdog.js";
import { startArchiveWorker } from "./workers/archive-worker.js";
import { startAlertRulesWorker } from "./workers/alert-rules-worker.js";
import { startHealthServer, stopHealthServer } from "./health.js";
import { config } from "@mediabot/shared";

async function main() {
  console.log("🔄 Starting MediaBot workers...");

  // Health server para Docker healthcheck (antes de queues para detectar fallos de inicio)
  await startHealthServer();

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

  // Watchdog de menciones (solo si está habilitado)
  if (config.watchdog.enabled) {
    startWatchdogWorker();
  }

  // Auto-archivado de menciones viejas (diario)
  startArchiveWorker();

  // Evaluación de reglas de alerta (cada 30 minutos)
  startAlertRulesWorker();

  console.log("✅ All workers started");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("⏹️ Shutting down workers...");
    await stopHealthServer();
    await queues.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(console.error);
