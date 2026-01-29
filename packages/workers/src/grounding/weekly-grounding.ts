/**
 * Worker de grounding semanal.
 * Ejecuta búsqueda programada para clientes con grounding semanal habilitado.
 */
import { Worker, Job } from "bullmq";
import { prisma } from "@mediabot/shared";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";

const CONCURRENCY = 1;

interface WeeklyJobData {
  // Job vacío para cron
  // El worker determina qué clientes necesitan grounding basado en el día
}

/**
 * Procesa el grounding semanal para todos los clientes configurados.
 */
async function processWeeklyGrounding(job: Job<WeeklyJobData>) {
  const today = new Date().getDay(); // 0 = domingo, 6 = sábado
  console.log(`[WeeklyGrounding] Starting weekly check for day ${today} (job ${job.id})`);

  const groundingQueue = getQueue(QUEUE_NAMES.GROUNDING_EXECUTE);

  // Buscar clientes con grounding semanal habilitado para HOY
  const clients = await prisma.client.findMany({
    where: {
      active: true,
      weeklyGroundingEnabled: true,
      weeklyGroundingDay: today,
    },
    select: {
      id: true,
      name: true,
      industry: true,
      groundingArticleCount: true,
      lastGroundingAt: true,
    },
  });

  console.log(`[WeeklyGrounding] Found ${clients.length} clients scheduled for today`);

  let queued = 0;

  for (const client of clients) {
    try {
      // Evitar doble grounding en el mismo día
      if (client.lastGroundingAt) {
        const lastGroundingDate = new Date(client.lastGroundingAt);
        const todayDate = new Date();
        if (
          lastGroundingDate.getDate() === todayDate.getDate() &&
          lastGroundingDate.getMonth() === todayDate.getMonth() &&
          lastGroundingDate.getFullYear() === todayDate.getFullYear()
        ) {
          console.log(`[WeeklyGrounding] Skipping "${client.name}" - already grounded today`);
          continue;
        }
      }

      console.log(`[WeeklyGrounding] Queueing grounding for "${client.name}"`);
      await groundingQueue.add(
        "weekly-grounding",
        {
          clientId: client.id,
          clientName: client.name,
          industry: client.industry,
          days: 7, // Últimos 7 días para grounding semanal
          articleCount: client.groundingArticleCount || 10,
          trigger: "weekly",
        },
        {
          attempts: 2,
          backoff: { type: "exponential", delay: 10000 },
          // Espaciar jobs para no saturar la API
          delay: queued * 60000, // 1 minuto entre cada búsqueda
        }
      );
      queued++;
    } catch (error) {
      console.error(`[WeeklyGrounding] Error queueing client "${client.name}":`, error);
    }
  }

  console.log(`[WeeklyGrounding] Queued ${queued} grounding jobs`);

  return {
    day: today,
    clientsFound: clients.length,
    queued,
  };
}

/**
 * Inicia el worker de grounding semanal.
 */
export function startWeeklyGroundingWorker() {
  const worker = new Worker<WeeklyJobData>(
    QUEUE_NAMES.GROUNDING_WEEKLY,
    processWeeklyGrounding,
    {
      connection,
      concurrency: CONCURRENCY,
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[WeeklyGrounding] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, error) => {
    console.error(`[WeeklyGrounding] Job ${job?.id} failed:`, error);
  });

  console.log(`✅ Weekly grounding worker started`);

  return worker;
}
