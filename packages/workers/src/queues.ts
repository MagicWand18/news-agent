import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { config } from "@mediabot/shared";

export const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  COLLECT_GDELT: "collect-gdelt",
  COLLECT_NEWSDATA: "collect-newsdata",
  COLLECT_RSS: "collect-rss",
  COLLECT_GOOGLE: "collect-google",
  INGEST_ARTICLE: "ingest-article",
  ANALYZE_MENTION: "analyze-mention",
  NOTIFY_ALERT: "notify-alert",
  DIGEST: "notify-digest",
  ONBOARDING: "onboarding",
} as const;

export function setupQueues() {
  const queues = {
    collectGdelt: new Queue(QUEUE_NAMES.COLLECT_GDELT, { connection }),
    collectNewsdata: new Queue(QUEUE_NAMES.COLLECT_NEWSDATA, { connection }),
    collectRss: new Queue(QUEUE_NAMES.COLLECT_RSS, { connection }),
    collectGoogle: new Queue(QUEUE_NAMES.COLLECT_GOOGLE, { connection }),
    ingestArticle: new Queue(QUEUE_NAMES.INGEST_ARTICLE, { connection }),
    analyzeMention: new Queue(QUEUE_NAMES.ANALYZE_MENTION, { connection }),
    notifyAlert: new Queue(QUEUE_NAMES.NOTIFY_ALERT, { connection }),
    digest: new Queue(QUEUE_NAMES.DIGEST, { connection }),
    onboarding: new Queue(QUEUE_NAMES.ONBOARDING, { connection }),
  };

  // Schedule repeating jobs using cron patterns for reliability
  // (BullMQ v5.1.0 had bugs with `every` that caused jobs to stop repeating)

  // GDELT: every 15 minutes
  queues.collectGdelt.upsertJobScheduler(
    "gdelt-cron",
    { pattern: "*/15 * * * *" },
    { name: "collect-gdelt" }
  );

  // NewsData: every 30 minutes
  queues.collectNewsdata.upsertJobScheduler(
    "newsdata-cron",
    { pattern: "*/30 * * * *" },
    { name: "collect-newsdata" }
  );

  // RSS: every 10 minutes
  queues.collectRss.upsertJobScheduler(
    "rss-cron",
    { pattern: "*/10 * * * *" },
    { name: "collect-rss" }
  );

  // Google CSE: every 2 hours
  queues.collectGoogle.upsertJobScheduler(
    "google-cron",
    { pattern: "0 */2 * * *" },
    { name: "collect-google" }
  );

  // Daily digest at 8:00 AM
  queues.digest.upsertJobScheduler(
    "daily-digest",
    { pattern: "0 8 * * *" },
    { name: "daily-digest" }
  );

  return {
    ...queues,
    close: async () => {
      await Promise.all(Object.values(queues).map((q) => q.close()));
      await connection.quit();
    },
  };
}

// Helper to enqueue jobs from other packages
export function getQueue(name: string) {
  return new Queue(name, { connection });
}
