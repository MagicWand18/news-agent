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
  NOTIFY_CRISIS: "notify-crisis",
  DIGEST: "notify-digest",
  ONBOARDING: "onboarding",
  CRISIS_CHECK: "crisis-check",
  WEEKLY_REPORT: "weekly-report",
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
    notifyCrisis: new Queue(QUEUE_NAMES.NOTIFY_CRISIS, { connection }),
    digest: new Queue(QUEUE_NAMES.DIGEST, { connection }),
    onboarding: new Queue(QUEUE_NAMES.ONBOARDING, { connection }),
    crisisCheck: new Queue(QUEUE_NAMES.CRISIS_CHECK, { connection }),
    weeklyReport: new Queue(QUEUE_NAMES.WEEKLY_REPORT, { connection }),
  };

  // Schedule repeating jobs using cron patterns from config
  // Patterns can be customized via environment variables

  // GDELT collector (default: every 15 minutes)
  queues.collectGdelt.upsertJobScheduler(
    "gdelt-cron",
    { pattern: config.crons.gdelt },
    { name: "collect-gdelt" }
  );
  console.log(`📅 GDELT cron: ${config.crons.gdelt}`);

  // NewsData collector (default: every 30 minutes)
  queues.collectNewsdata.upsertJobScheduler(
    "newsdata-cron",
    { pattern: config.crons.newsdata },
    { name: "collect-newsdata" }
  );
  console.log(`📅 NewsData cron: ${config.crons.newsdata}`);

  // RSS collector (default: every 10 minutes)
  queues.collectRss.upsertJobScheduler(
    "rss-cron",
    { pattern: config.crons.rss },
    { name: "collect-rss" }
  );
  console.log(`📅 RSS cron: ${config.crons.rss}`);

  // Google CSE collector (default: every 2 hours)
  queues.collectGoogle.upsertJobScheduler(
    "google-cron",
    { pattern: config.crons.google },
    { name: "collect-google" }
  );
  console.log(`📅 Google CSE cron: ${config.crons.google}`);

  // Daily digest (default: 8:00 AM)
  queues.digest.upsertJobScheduler(
    "daily-digest",
    { pattern: config.crons.digest },
    { name: "daily-digest" }
  );
  console.log(`📅 Digest cron: ${config.crons.digest}`);

  // Weekly report (default: Sunday 8:00 PM)
  const weeklyReportCron = process.env.WEEKLY_REPORT_CRON || "0 20 * * 0";
  queues.weeklyReport.upsertJobScheduler(
    "weekly-report-cron",
    { pattern: weeklyReportCron },
    { name: "weekly-report" }
  );
  console.log(`📅 Weekly Report cron: ${weeklyReportCron}`);

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
