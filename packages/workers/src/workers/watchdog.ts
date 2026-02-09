import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma, config } from "@mediabot/shared";
import { bot } from "../notifications/bot-instance.js";
import IORedis from "ioredis";

const REDIS_KEY = "watchdog:alert:sent";

/**
 * Worker que vigila la creación de menciones.
 * Si no se crean menciones en las últimas N horas, envía alerta por Telegram al admin.
 * Usa Redis para anti-spam (cooldown configurable).
 */
export function startWatchdogWorker() {
  const redis = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(
    QUEUE_NAMES.WATCHDOG_MENTIONS,
    async (job) => {
      const { thresholdHours, adminChatId, alertCooldownHours } =
        config.watchdog;

      if (!adminChatId) {
        console.log(
          "[Watchdog] WATCHDOG_ADMIN_CHAT_ID no configurado, omitiendo check"
        );
        return { skipped: true, reason: "no adminChatId" };
      }

      // Buscar la mención más reciente
      const latestMention = await prisma.mention.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      if (!latestMention) {
        console.log("[Watchdog] No hay menciones en la base de datos");
        // Alertar si no hay ninguna mención
        await sendAlertIfNeeded(redis, adminChatId, alertCooldownHours, null);
        return { status: "alert", hoursWithoutMentions: "never" };
      }

      const hoursSinceLastMention =
        (Date.now() - latestMention.createdAt.getTime()) / (1000 * 60 * 60);

      console.log(
        `[Watchdog] Última mención hace ${hoursSinceLastMention.toFixed(1)}h (threshold: ${thresholdHours}h)`
      );

      if (hoursSinceLastMention < thresholdHours) {
        // Sistema sano: limpiar flag de alerta
        await redis.del(REDIS_KEY);
        return { status: "healthy", hoursSinceLastMention };
      }

      // Threshold superado: alertar si no hay cooldown activo
      await sendAlertIfNeeded(
        redis,
        adminChatId,
        alertCooldownHours,
        hoursSinceLastMention
      );
      return { status: "alert", hoursSinceLastMention };
    },
    { connection, concurrency: 1 }
  );

  worker.on("completed", (job, result) => {
    console.log(`[Watchdog] Job ${job.id} completado:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Watchdog] Job ${job?.id} fallido:`, err);
  });

  console.log(`🐕 Watchdog worker started`);
  return worker;
}

async function sendAlertIfNeeded(
  redis: IORedis,
  chatId: string,
  cooldownHours: number,
  hoursSinceLastMention: number | null
) {
  // Verificar si ya se envió alerta (anti-spam)
  const alreadySent = await redis.get(REDIS_KEY);
  if (alreadySent) {
    console.log("[Watchdog] Alerta ya enviada (cooldown activo), omitiendo");
    return;
  }

  const hoursText =
    hoursSinceLastMention !== null
      ? `${hoursSinceLastMention.toFixed(1)} horas`
      : "nunca (0 menciones en DB)";

  const message =
    `⚠️ *WATCHDOG: Sin menciones nuevas*\n\n` +
    `No se han creado menciones en las últimas *${hoursText}*.\n\n` +
    `Esto puede indicar que los workers están congelados o que los collectors no están funcionando.\n\n` +
    `🔧 Acciones sugeridas:\n` +
    `• Verificar logs de workers\n` +
    `• Revisar estado de los contenedores\n` +
    `• Verificar conectividad con APIs externas`;

  try {
    await bot.api.sendMessage(chatId, message, { parse_mode: "Markdown" });
    // Setear flag con TTL para cooldown
    await redis.set(REDIS_KEY, "1", "EX", cooldownHours * 3600);
    console.log(`[Watchdog] Alerta enviada a chat ${chatId}`);
  } catch (error) {
    console.error("[Watchdog] Error enviando alerta Telegram:", error);
  }
}
