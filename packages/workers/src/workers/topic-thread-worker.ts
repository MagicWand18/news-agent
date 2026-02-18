/**
 * Workers para Topic Threads (Sprint 19).
 * - Cierre automático de threads inactivos (cron cada 6h)
 * - Extracción de topics para SocialMentions
 */
import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";

/**
 * Worker cron que cierra threads inactivos (sin menciones en 72h).
 */
export function startCloseInactiveThreadsWorker() {
  const worker = new Worker(
    QUEUE_NAMES.CLOSE_INACTIVE_THREADS,
    async () => {
      console.log("[TopicThreadWorker] Checking for inactive threads...");
      const { closeInactiveThreads } = await import("../analysis/topic-thread-manager.js");
      const closed = await closeInactiveThreads();
      console.log(`[TopicThreadWorker] Closed ${closed} inactive threads`);
      return { closed };
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[TopicThreadWorker] Close inactive threads job ${job?.id} failed:`, err);
  });

  console.log("🏷️ Close inactive threads worker started (cron: every 6h)");
  return worker;
}

/**
 * Worker que extrae topics de SocialMentions.
 */
export function startSocialTopicWorker() {
  const worker = new Worker(
    QUEUE_NAMES.ANALYZE_SOCIAL_TOPIC,
    async (job) => {
      const { socialMentionId } = job.data as { socialMentionId: string };

      if (!socialMentionId) {
        throw new Error("socialMentionId is required");
      }

      console.log(`[SocialTopicWorker] Extracting topic for social mention: ${socialMentionId}`);

      const { processSocialMentionTopic } = await import("../analysis/topic-extractor.js");
      const topic = await processSocialMentionTopic(socialMentionId);

      return { socialMentionId, topic };
    },
    {
      connection,
      concurrency: 3,
    }
  );

  worker.on("completed", (job, result) => {
    if (result?.topic) {
      console.log(`[SocialTopicWorker] Extracted topic "${result.topic}" for social ${result.socialMentionId}`);
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[SocialTopicWorker] Job ${job?.id} failed:`, err);
  });

  console.log("🏷️ Social topic extraction worker started");
  return worker;
}
