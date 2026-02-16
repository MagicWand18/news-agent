/**
 * Worker que evalúa reglas de alerta periódicamente (cada 30 minutos).
 * Para cada AlertRule activa, evalúa la condición y crea notificaciones si se cumple.
 */
import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { sendNotification } from "../notifications/recipients.js";

// Rastrear última evaluación por regla para evitar duplicados
const lastEvaluationMap = new Map<string, Date>();

const RULE_TYPE_LABELS: Record<string, string> = {
  NEGATIVE_SPIKE: "Pico de menciones negativas",
  VOLUME_SURGE: "Volumen inusual de menciones",
  NO_MENTIONS: "Sin menciones detectadas",
  SOV_DROP: "Caída de Share of Voice",
  COMPETITOR_SPIKE: "Aumento de competidor",
  SENTIMENT_SHIFT: "Cambio de sentimiento",
};

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

            // Enviar notificación Telegram con mensaje rico
            if (rule.channels.includes("telegram")) {
              try {
                const typeLabel = RULE_TYPE_LABELS[rule.type] || rule.type;
                const message =
                  `🔔 REGLA DE ALERTA ACTIVADA\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `📋 Regla: ${rule.name}\n` +
                  `📊 Tipo: ${typeLabel}\n` +
                  `👤 Cliente: ${rule.client.name}\n\n` +
                  `⚡ La condición configurada se ha cumplido.\n` +
                  `Revisa el dashboard para mas detalles.`;

                const { sent, failed } = await sendNotification(
                  rule.clientId,
                  "ALERT_RULE",
                  message
                );

                console.log(`[AlertRulesWorker] Telegram sent for rule "${rule.name}": ${sent} delivered, ${failed} failed`);
              } catch (err) {
                console.error(`[AlertRulesWorker] Error sending Telegram notification for rule ${rule.id}:`, err);
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
      const threshold = condition.threshold ?? 5;
      const timeWindowHours = condition.timeWindowHours ?? 24;
      const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

      const negativeCount = await prisma.mention.count({
        where: {
          clientId: rule.clientId,
          sentiment: "NEGATIVE",
          publishedAt: { gte: since },
        },
      });

      return negativeCount >= threshold;
    }

    case "VOLUME_SURGE": {
      const percentageIncrease = condition.percentageIncrease ?? 50;
      const comparisonDays = condition.comparisonDays ?? 7;

      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const comparisonStart = new Date(Date.now() - comparisonDays * 24 * 60 * 60 * 1000);

      const [currentCount, historicalCount] = await Promise.all([
        prisma.mention.count({
          where: { clientId: rule.clientId, publishedAt: { gte: last24h } },
        }),
        prisma.mention.count({
          where: { clientId: rule.clientId, publishedAt: { gte: comparisonStart, lt: last24h } },
        }),
      ]);

      const dailyAverage = historicalCount / Math.max(comparisonDays - 1, 1);
      if (dailyAverage === 0) return currentCount > 0;
      const increase = ((currentCount - dailyAverage) / dailyAverage) * 100;

      return increase >= percentageIncrease;
    }

    case "NO_MENTIONS": {
      const hours = condition.hours ?? 48;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const count = await prisma.mention.count({
        where: { clientId: rule.clientId, publishedAt: { gte: since } },
      });

      return count === 0;
    }

    case "SOV_DROP": {
      const dropThreshold = condition.dropThreshold ?? 10;
      const days = condition.days ?? 7;

      const client = await prisma.client.findFirst({
        where: { id: rule.clientId },
        select: { orgId: true },
      });
      if (!client?.orgId) return false;

      const now = new Date();
      const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

      const [currentClient, currentTotal] = await Promise.all([
        prisma.mention.count({
          where: { clientId: rule.clientId, publishedAt: { gte: currentStart } },
        }),
        prisma.mention.count({
          where: { client: { orgId: client.orgId }, publishedAt: { gte: currentStart } },
        }),
      ]);

      const [previousClient, previousTotal] = await Promise.all([
        prisma.mention.count({
          where: { clientId: rule.clientId, publishedAt: { gte: previousStart, lt: currentStart } },
        }),
        prisma.mention.count({
          where: { client: { orgId: client.orgId }, publishedAt: { gte: previousStart, lt: currentStart } },
        }),
      ]);

      const currentSOV = currentTotal > 0 ? (currentClient / currentTotal) * 100 : 0;
      const previousSOV = previousTotal > 0 ? (previousClient / previousTotal) * 100 : 0;

      if (previousSOV === 0) return false;
      const drop = previousSOV - currentSOV;
      return drop >= dropThreshold;
    }

    case "COMPETITOR_SPIKE": {
      const spikeThreshold = condition.spikeThreshold ?? 30;
      const days = condition.days ?? 7;

      const clientCompetitors = await prisma.clientCompetitor.findMany({
        where: { clientId: rule.clientId },
        include: { competitor: true },
      });

      if (clientCompetitors.length === 0) return false;

      const sovClient = await prisma.client.findFirst({
        where: { id: rule.clientId },
        select: { orgId: true },
      });
      if (!sovClient?.orgId) return false;

      const competitorClients = await prisma.client.findMany({
        where: {
          orgId: sovClient.orgId,
          OR: clientCompetitors.map((cc) => ({
            name: { contains: cc.competitor.name, mode: "insensitive" as const },
          })),
          id: { not: rule.clientId },
          active: true,
        },
        select: { id: true },
      });

      if (competitorClients.length === 0) return false;

      const now = new Date();
      const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

      for (const comp of competitorClients) {
        const [currentCount, previousCount] = await Promise.all([
          prisma.mention.count({
            where: { clientId: comp.id, publishedAt: { gte: currentStart } },
          }),
          prisma.mention.count({
            where: { clientId: comp.id, publishedAt: { gte: previousStart, lt: currentStart } },
          }),
        ]);

        if (previousCount === 0 && currentCount > 0) return true;
        if (previousCount > 0) {
          const increase = ((currentCount - previousCount) / previousCount) * 100;
          if (increase >= spikeThreshold) return true;
        }
      }

      return false;
    }

    case "SENTIMENT_SHIFT": {
      const shiftThreshold = condition.shiftThreshold ?? 15;
      const days = condition.days ?? 7;

      const now = new Date();
      const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

      const [currentTotal, currentNegative] = await Promise.all([
        prisma.mention.count({
          where: { clientId: rule.clientId, publishedAt: { gte: currentStart } },
        }),
        prisma.mention.count({
          where: { clientId: rule.clientId, sentiment: "NEGATIVE", publishedAt: { gte: currentStart } },
        }),
      ]);

      const [previousTotal, previousNegative] = await Promise.all([
        prisma.mention.count({
          where: { clientId: rule.clientId, publishedAt: { gte: previousStart, lt: currentStart } },
        }),
        prisma.mention.count({
          where: { clientId: rule.clientId, sentiment: "NEGATIVE", publishedAt: { gte: previousStart, lt: currentStart } },
        }),
      ]);

      const currentNegPct = currentTotal > 0 ? (currentNegative / currentTotal) * 100 : 0;
      const previousNegPct = previousTotal > 0 ? (previousNegative / previousTotal) * 100 : 0;

      if (previousTotal === 0) return false;
      const shift = currentNegPct - previousNegPct;
      return shift >= shiftThreshold;
    }

    default:
      return false;
  }
}
