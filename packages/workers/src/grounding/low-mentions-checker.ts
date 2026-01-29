/**
 * Worker de verificación de menciones bajas.
 * Ejecuta diariamente y dispara grounding automático para clientes con pocas menciones.
 */
import { Worker, Job } from "bullmq";
import { prisma } from "@mediabot/shared";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { checkLowMentions } from "./grounding-service.js";

const CONCURRENCY = 1;

interface CheckJobData {
  // Job vacío para cron, o específico para un cliente
  clientId?: string;
}

/**
 * Procesa la verificación de menciones bajas para todos los clientes
 * o para un cliente específico.
 */
async function processLowMentionsCheck(job: Job<CheckJobData>) {
  console.log(`[LowMentionsChecker] Starting check job ${job.id}`);

  const groundingQueue = getQueue(QUEUE_NAMES.GROUNDING_EXECUTE);

  // Si es para un cliente específico
  if (job.data.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: job.data.clientId },
      select: {
        id: true,
        name: true,
        industry: true,
        groundingEnabled: true,
        minDailyMentions: true,
        consecutiveDaysThreshold: true,
        groundingArticleCount: true,
        lastGroundingAt: true,
      },
    });

    if (!client || !client.groundingEnabled) {
      console.log(`[LowMentionsChecker] Client ${job.data.clientId} not found or grounding disabled`);
      return { checked: 0, triggered: 0 };
    }

    const hasLowMentions = await checkLowMentions(
      client.id,
      client.minDailyMentions,
      client.consecutiveDaysThreshold
    );

    if (hasLowMentions) {
      console.log(`[LowMentionsChecker] Low mentions detected for "${client.name}", triggering grounding`);
      await groundingQueue.add(
        "auto-grounding",
        {
          clientId: client.id,
          clientName: client.name,
          industry: client.industry,
          days: 14, // Buscar últimas 2 semanas
          articleCount: client.groundingArticleCount,
          trigger: "auto_low_mentions",
        },
        {
          attempts: 2,
          backoff: { type: "exponential", delay: 10000 },
        }
      );
      return { checked: 1, triggered: 1 };
    }

    return { checked: 1, triggered: 0 };
  }

  // Verificar todos los clientes con grounding habilitado
  const clients = await prisma.client.findMany({
    where: {
      active: true,
      groundingEnabled: true,
    },
    select: {
      id: true,
      name: true,
      industry: true,
      minDailyMentions: true,
      consecutiveDaysThreshold: true,
      groundingArticleCount: true,
      lastGroundingAt: true,
    },
  });

  console.log(`[LowMentionsChecker] Checking ${clients.length} clients with grounding enabled`);

  let triggered = 0;

  for (const client of clients) {
    try {
      // Evitar grounding muy frecuente (mínimo 12 horas entre búsquedas)
      if (client.lastGroundingAt) {
        const hoursSinceLastGrounding =
          (Date.now() - new Date(client.lastGroundingAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastGrounding < 12) {
          console.log(
            `[LowMentionsChecker] Skipping "${client.name}" - last grounding was ${hoursSinceLastGrounding.toFixed(1)}h ago`
          );
          continue;
        }
      }

      const hasLowMentions = await checkLowMentions(
        client.id,
        client.minDailyMentions,
        client.consecutiveDaysThreshold
      );

      if (hasLowMentions) {
        console.log(`[LowMentionsChecker] Low mentions detected for "${client.name}", triggering grounding`);
        await groundingQueue.add(
          "auto-grounding",
          {
            clientId: client.id,
            clientName: client.name,
            industry: client.industry,
            days: 14,
            articleCount: client.groundingArticleCount,
            trigger: "auto_low_mentions",
          },
          {
            attempts: 2,
            backoff: { type: "exponential", delay: 10000 },
            // Espaciar jobs para no saturar la API
            delay: triggered * 30000, // 30 segundos entre cada búsqueda
          }
        );
        triggered++;
      }
    } catch (error) {
      console.error(`[LowMentionsChecker] Error checking client "${client.name}":`, error);
    }
  }

  console.log(`[LowMentionsChecker] Check complete: ${clients.length} checked, ${triggered} triggered`);

  return {
    checked: clients.length,
    triggered,
  };
}

/**
 * Inicia el worker de verificación de menciones bajas.
 */
export function startLowMentionsWorker() {
  const worker = new Worker<CheckJobData>(
    QUEUE_NAMES.GROUNDING_CHECK,
    processLowMentionsCheck,
    {
      connection,
      concurrency: CONCURRENCY,
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[LowMentionsChecker] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, error) => {
    console.error(`[LowMentionsChecker] Job ${job?.id} failed:`, error);
  });

  console.log(`✅ Low mentions checker worker started`);

  return worker;
}
