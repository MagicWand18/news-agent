/**
 * Worker de ejecución de grounding.
 * Procesa las búsquedas de grounding encoladas (manual, automático, semanal).
 */
import { Worker, Job } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import {
  executeGroundingSearch,
  GroundingParams,
  GroundingResult,
} from "./grounding-service.js";

// Baja concurrencia para no saturar la API de Gemini
const CONCURRENCY = 2;

/**
 * Procesa un job de grounding.
 */
async function processGrounding(job: Job<GroundingParams>): Promise<GroundingResult> {
  const { clientId, clientName, industry, days, articleCount, trigger } = job.data;

  console.log(
    `[GroundingWorker] Processing job ${job.id} for "${clientName}" (trigger: ${trigger})`
  );

  const result = await executeGroundingSearch({
    clientId,
    clientName,
    industry,
    days,
    articleCount,
    trigger,
  });

  if (result.success) {
    console.log(
      `[GroundingWorker] Job ${job.id} completed: ${result.articlesFound} articles, ${result.mentionsCreated} mentions`
    );
  } else {
    console.error(`[GroundingWorker] Job ${job.id} failed: ${result.error}`);
  }

  return result;
}

/**
 * Inicia el worker de ejecución de grounding.
 */
export function startGroundingWorker() {
  const worker = new Worker<GroundingParams, GroundingResult>(
    QUEUE_NAMES.GROUNDING_EXECUTE,
    processGrounding,
    {
      connection,
      concurrency: CONCURRENCY,
      limiter: {
        max: 5, // Máximo 5 jobs por minuto
        duration: 60000,
      },
    }
  );

  worker.on("completed", (job, result) => {
    if (result.success) {
      console.log(
        `[GroundingWorker] Job ${job.id} completed successfully: ${result.articlesFound} articles found`
      );
    } else {
      console.log(`[GroundingWorker] Job ${job.id} completed with error: ${result.error}`);
    }
  });

  worker.on("failed", (job, error) => {
    console.error(`[GroundingWorker] Job ${job?.id} failed:`, error);
  });

  console.log(`✅ Grounding execution worker started (concurrency: ${CONCURRENCY})`);

  return worker;
}
