import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { detectEmergingTopics } from "../analysis/topic-extractor.js";

/**
 * Worker que detecta temas emergentes y envia notificaciones a Telegram.
 * Corre cada 4 horas por defecto (configurable via EMERGING_TOPICS_CRON).
 */
export function startEmergingTopicsWorker() {
  // Worker principal que detecta temas emergentes
  const emergingTopicsWorker = new Worker(
    QUEUE_NAMES.EMERGING_TOPICS,
    async (job) => {
      console.log(`[EmergingTopics] Iniciando deteccion de temas emergentes...`);

      // Obtener todas las organizaciones activas
      const orgs = await prisma.organization.findMany({
        include: {
          clients: {
            where: { active: true },
            select: {
              id: true,
              name: true,
              telegramGroupId: true,
            },
          },
        },
      });

      let totalNotifications = 0;

      for (const org of orgs) {
        if (org.clients.length === 0) continue;

        try {
          // Detectar temas emergentes para la organizacion
          const emergingTopics = await detectEmergingTopics(org.id, 24, 3);
          const newTopics = emergingTopics.filter((t) => t.isNew);

          if (newTopics.length === 0) {
            console.log(`[EmergingTopics] Org ${org.name}: Sin temas nuevos emergentes`);
            continue;
          }

          console.log(`[EmergingTopics] Org ${org.name}: ${newTopics.length} temas nuevos detectados`);

        // Para cada tema nuevo, verificar que clientes tienen menciones
        for (const topic of newTopics) {
          for (const client of org.clients) {
            // Verificar si el cliente tiene menciones de este tema
            const mentionCount = await prisma.mention.count({
              where: {
                clientId: client.id,
                topic: topic.topic,
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              },
            });

            if (mentionCount === 0) continue;
            if (!client.telegramGroupId) continue;

            // Verificar que no hayamos notificado este tema para este cliente en las ultimas 24h
            const recentNotification = await prisma.emergingTopicNotification.findFirst({
              where: {
                clientId: client.id,
                topic: topic.topic,
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              },
            });

            if (recentNotification) {
              console.log(`[EmergingTopics] Ya notificado: ${topic.topic} para ${client.name}`);
              continue;
            }

            // Encolar notificacion
            const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_EMERGING_TOPIC);
            await notifyQueue.add("notify-emerging-topic", {
              clientId: client.id,
              clientName: client.name,
              telegramGroupId: client.telegramGroupId,
              topic: topic.topic,
              count: topic.count,
              clientMentionCount: mentionCount,
            });

            totalNotifications++;
          }
        }
        } catch (error) {
          console.error(`[EmergingTopics] Error procesando org ${org.name}:`, error);
          continue;
        }
      }

      console.log(`[EmergingTopics] Finalizado. ${totalNotifications} notificaciones encoladas.`);
      return { notificationsQueued: totalNotifications };
    },
    { connection, concurrency: 1 }
  );

  emergingTopicsWorker.on("completed", (job, result) => {
    console.log(`[EmergingTopics] Job ${job.id} completado:`, result);
  });

  emergingTopicsWorker.on("failed", (job, err) => {
    console.error(`[EmergingTopics] Job ${job?.id} fallido:`, err);
  });

  console.log(`📊 Emerging Topics worker started`);
  return emergingTopicsWorker;
}
