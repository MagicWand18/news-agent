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
  COLLECT_SOCIAL: "collect-social",
  INGEST_ARTICLE: "ingest-article",
  ANALYZE_MENTION: "analyze-mention",
  ANALYZE_SOCIAL: "analyze-social-mention",
  NOTIFY_ALERT: "notify-alert",
  NOTIFY_CRISIS: "notify-crisis",
  NOTIFY_EMERGING_TOPIC: "notify-emerging-topic",
  DIGEST: "notify-digest",
  ONBOARDING: "onboarding",
  CRISIS_CHECK: "crisis-check",
  EMERGING_TOPICS: "emerging-topics",
  WEEKLY_REPORT: "weekly-report",
  WEEKLY_INSIGHTS: "weekly-insights",
  EXTRACT_TOPIC: "extract-topic",
  // Grounding queues
  GROUNDING_CHECK: "grounding-check",
  GROUNDING_WEEKLY: "grounding-weekly",
  GROUNDING_EXECUTE: "grounding-execute",
} as const;

export function setupQueues() {
  const queues = {
    collectGdelt: new Queue(QUEUE_NAMES.COLLECT_GDELT, { connection }),
    collectNewsdata: new Queue(QUEUE_NAMES.COLLECT_NEWSDATA, { connection }),
    collectRss: new Queue(QUEUE_NAMES.COLLECT_RSS, { connection }),
    collectGoogle: new Queue(QUEUE_NAMES.COLLECT_GOOGLE, { connection }),
    collectSocial: new Queue(QUEUE_NAMES.COLLECT_SOCIAL, { connection }),
    ingestArticle: new Queue(QUEUE_NAMES.INGEST_ARTICLE, { connection }),
    analyzeMention: new Queue(QUEUE_NAMES.ANALYZE_MENTION, { connection }),
    analyzeSocial: new Queue(QUEUE_NAMES.ANALYZE_SOCIAL, { connection }),
    notifyAlert: new Queue(QUEUE_NAMES.NOTIFY_ALERT, { connection }),
    notifyCrisis: new Queue(QUEUE_NAMES.NOTIFY_CRISIS, { connection }),
    notifyEmergingTopic: new Queue(QUEUE_NAMES.NOTIFY_EMERGING_TOPIC, { connection }),
    digest: new Queue(QUEUE_NAMES.DIGEST, { connection }),
    onboarding: new Queue(QUEUE_NAMES.ONBOARDING, { connection }),
    crisisCheck: new Queue(QUEUE_NAMES.CRISIS_CHECK, { connection }),
    emergingTopics: new Queue(QUEUE_NAMES.EMERGING_TOPICS, { connection }),
    weeklyReport: new Queue(QUEUE_NAMES.WEEKLY_REPORT, { connection }),
    weeklyInsights: new Queue(QUEUE_NAMES.WEEKLY_INSIGHTS, { connection }),
    extractTopic: new Queue(QUEUE_NAMES.EXTRACT_TOPIC, { connection }),
    // Grounding queues
    groundingCheck: new Queue(QUEUE_NAMES.GROUNDING_CHECK, { connection }),
    groundingWeekly: new Queue(QUEUE_NAMES.GROUNDING_WEEKLY, { connection }),
    groundingExecute: new Queue(QUEUE_NAMES.GROUNDING_EXECUTE, { connection }),
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

  // Social Media collector (default: every 4 hours)
  queues.collectSocial.upsertJobScheduler(
    "social-cron",
    { pattern: config.crons.social },
    { name: "collect-social" }
  );
  console.log(`📅 Social Media cron: ${config.crons.social}`);

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

  // Weekly insights (default: Monday 6:00 AM - antes de la jornada laboral)
  const weeklyInsightsCron = process.env.WEEKLY_INSIGHTS_CRON || "0 6 * * 1";
  queues.weeklyInsights.upsertJobScheduler(
    "weekly-insights-cron",
    { pattern: weeklyInsightsCron },
    { name: "weekly-insights" }
  );
  console.log(`📅 Weekly Insights cron: ${weeklyInsightsCron}`);

  // Emerging topics check (default: every 4 hours)
  const emergingTopicsCron = process.env.EMERGING_TOPICS_CRON || "0 */4 * * *";
  queues.emergingTopics.upsertJobScheduler(
    "emerging-topics-cron",
    { pattern: emergingTopicsCron },
    { name: "check-emerging-topics" }
  );
  console.log(`📅 Emerging Topics cron: ${emergingTopicsCron}`);

  // Grounding: Low mentions check (default: 7:00 AM daily, before digest)
  const groundingCheckCron = process.env.GROUNDING_CHECK_CRON || "0 7 * * *";
  queues.groundingCheck.upsertJobScheduler(
    "grounding-check-cron",
    { pattern: groundingCheckCron },
    { name: "check-low-mentions" }
  );
  console.log(`📅 Grounding Check cron: ${groundingCheckCron}`);

  // Grounding: Weekly grounding (default: 6:00 AM every day, checks if today matches client's config)
  const groundingWeeklyCron = process.env.GROUNDING_WEEKLY_CRON || "0 6 * * *";
  queues.groundingWeekly.upsertJobScheduler(
    "grounding-weekly-cron",
    { pattern: groundingWeeklyCron },
    { name: "weekly-grounding" }
  );
  console.log(`📅 Grounding Weekly cron: ${groundingWeeklyCron}`);

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
