/**
 * Worker que evalúa reglas de alerta periódicamente (cada 30 minutos).
 * Para cada AlertRule activa, evalúa la condición y crea notificaciones si se cumple.
 */
import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma } from "@mediabot/shared";

// Rastrear última evaluación por regla para evitar duplicados
const lastEvaluationMap = new Map<string, Date>();

export function startAlertRulesWorker() {
  const worker = new Worker(
    QUEUE_NAMES.CHECK_ALERT_RULES,
    async () => {
      console.log("[AlertRulesWorker] Evaluating alert rules...");

      const rules = await prisma.alertRule.findMany({
        where: { active: true },
        include: { client: { select: { id: true, name: true, orgId: true } } },
      });

      console.log(`[AlertRulesWorker] Found ${rules.length} active rules`);

      for (const rule of rules) {
        try {
          const triggered = await evaluateRule(rule);

          if (triggered) {
            // Evitar duplicados: verificar si ya se evaluó recientemente
            const lastEval = lastEvaluationMap.get(rule.id);
            const cooldownMs = 60 * 60 * 1000; // 1 hora
            if (lastEval && Date.now() - lastEval.getTime() < cooldownMs) {
              continue;
            }

            // Crear notificación in-app para admins de la organización
            const orgAdmins = await prisma.user.findMany({
              where: {
                orgId: rule.client.orgId,
                role: { in: ["ADMIN", "SUPERVISOR"] },
              },
              select: { id: true },
            });

            for (const admin of orgAdmins) {
              await prisma.notification.create({
                data: {
                  userId: admin.id,
                  type: "SYSTEM",
                  title: `Alerta: ${rule.name}`,
                  message: `Se activó la regla "${rule.name}" para el cliente ${rule.client.name}. Tipo: ${rule.type}.`,
                  data: { ruleId: rule.id, clientId: rule.clientId, ruleType: rule.type },
                },
              });
            }

            // Opcionalmente encolar notificación Telegram si el canal incluye "telegram"
            if (rule.channels.includes("telegram")) {
              try {
                const { getQueue } = await import("../queues.js");
                const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_ALERT);
                await notifyQueue.add("alert-rule-triggered", {
                  clientId: rule.clientId,
                  message: `Alerta activada: ${rule.name} (${rule.type}) para ${rule.client.name}`,
                });
              } catch (err) {
                console.error(`[AlertRulesWorker] Error queuing Telegram notification for rule ${rule.id}:`, err);
              }
            }

            lastEvaluationMap.set(rule.id, new Date());
            console.log(`[AlertRulesWorker] Rule "${rule.name}" triggered for ${rule.client.name}`);
          }
        } catch (err) {
          console.error(`[AlertRulesWorker] Error evaluating rule ${rule.id}:`, err);
        }
      }

      console.log("[AlertRulesWorker] Alert rules evaluation completed");
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[AlertRulesWorker] Job ${job?.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[AlertRulesWorker] Job ${job?.id} failed:`, err);
  });

  console.log("🔔 Alert rules worker started");

  return worker;
}

/**
 * Evalúa una regla de alerta individual.
 * Retorna true si la condición se cumple (alerta debe dispararse).
 */
async function evaluateRule(rule: {
  id: string;
  type: string;
  clientId: string;
  condition: unknown;
}): Promise<boolean> {
  const condition = rule.condition as Record<string, number>;

  switch (rule.type) {
    case "NEGATIVE_SPIKE": {
      // Condición: { threshold: número, timeWindowHours: número }
      const threshold = condition.threshold ?? 5;
      const timeWindowHours = condition.timeWindowHours ?? 24;
      const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

      const negativeCount = await prisma.mention.count({
        where: {
          clientId: rule.clientId,
          sentiment: "NEGATIVE",
          createdAt: { gte: since },
        },
      });

      return negativeCount >= threshold;
    }

    case "VOLUME_SURGE": {
      // Condición: { percentageIncrease: número, comparisonDays: número }
      const percentageIncrease = condition.percentageIncrease ?? 50;
      const comparisonDays = condition.comparisonDays ?? 7;

      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const comparisonStart = new Date(Date.now() - comparisonDays * 24 * 60 * 60 * 1000);

      const [currentCount, historicalCount] = await Promise.all([
        prisma.mention.count({
          where: { clientId: rule.clientId, createdAt: { gte: last24h } },
        }),
        prisma.mention.count({
          where: { clientId: rule.clientId, createdAt: { gte: comparisonStart, lt: last24h } },
        }),
      ]);

      const dailyAverage = historicalCount / Math.max(comparisonDays - 1, 1);
      if (dailyAverage === 0) return currentCount > 0;
      const increase = ((currentCount - dailyAverage) / dailyAverage) * 100;

      return increase >= percentageIncrease;
    }

    case "NO_MENTIONS": {
      // Condición: { hours: número }
      const hours = condition.hours ?? 48;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const count = await prisma.mention.count({
        where: { clientId: rule.clientId, createdAt: { gte: since } },
      });

      return count === 0;
    }

    // Stubs para tipos futuros
    case "SOV_DROP":
    case "COMPETITOR_SPIKE":
    case "SENTIMENT_SHIFT":
      // No implementado aún
      return false;

    default:
      return false;
  }
}
