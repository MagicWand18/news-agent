import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { config } from "@mediabot/shared";

export const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
  reconnectOnError(err) {
    // Reconectar automáticamente si Redis entra en modo READONLY
    return err.message.includes("READONLY");
  },
  retryStrategy(times) {
    // Backoff exponencial: 500ms, 1s, 2s, 4s... máximo 30s
    return Math.min(times * 500, 30000);
  },
});

/**
 * Intervalo en ms para re-registrar los schedulers de cron.
 * Los scheduler keys de BullMQ pueden desaparecer de Redis por
 * diversos motivos (restart sin persistencia, eviction, etc.).
 * Re-registrarlos periódicamente garantiza auto-recuperación.
 * Default: 30 minutos.
 */
const SCHEDULER_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

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
  // Social comments extraction
  EXTRACT_COMMENTS: "extract-social-comments",
  // Google News RSS para fuentes sin feed propio
  COLLECT_GNEWS: "collect-gnews",
  // Google News RSS búsqueda por nombre de cliente
  COLLECT_GNEWS_CLIENT: "collect-gnews-client",
  // Watchdog de menciones
  WATCHDOG_MENTIONS: "watchdog-mentions",
  // Auto-archivado de menciones viejas
  ARCHIVE_OLD_MENTIONS: "archive-old-mentions",
  // Evaluación de reglas de alerta
  CHECK_ALERT_RULES: "check-alert-rules",
  // Cola genérica de notificaciones Telegram
  NOTIFY_TELEGRAM: "notify-telegram",
  // Topic Threads (Sprint 19)
  NOTIFY_TOPIC: "notify-topic",
  CLOSE_INACTIVE_THREADS: "close-inactive-threads",
  ANALYZE_SOCIAL_TOPIC: "analyze-social-topic",
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
    // Social comments extraction
    extractComments: new Queue(QUEUE_NAMES.EXTRACT_COMMENTS, { connection }),
    // Google News RSS para fuentes sin feed propio
    collectGnews: new Queue(QUEUE_NAMES.COLLECT_GNEWS, { connection }),
    // Google News RSS búsqueda por nombre de cliente
    collectGnewsClient: new Queue(QUEUE_NAMES.COLLECT_GNEWS_CLIENT, { connection }),
    // Watchdog de menciones
    watchdogMentions: new Queue(QUEUE_NAMES.WATCHDOG_MENTIONS, { connection }),
    // Auto-archivado de menciones viejas
    archiveOldMentions: new Queue(QUEUE_NAMES.ARCHIVE_OLD_MENTIONS, { connection }),
    // Evaluación de reglas de alerta
    checkAlertRules: new Queue(QUEUE_NAMES.CHECK_ALERT_RULES, { connection }),
    notifyTelegram: new Queue(QUEUE_NAMES.NOTIFY_TELEGRAM, { connection }),
    // Topic Threads (Sprint 19)
    notifyTopic: new Queue(QUEUE_NAMES.NOTIFY_TOPIC, { connection }),
    closeInactiveThreads: new Queue(QUEUE_NAMES.CLOSE_INACTIVE_THREADS, { connection }),
    analyzeSocialTopic: new Queue(QUEUE_NAMES.ANALYZE_SOCIAL_TOPIC, { connection }),
  };

  // Registrar todos los schedulers de cron (idempotente via upsertJobScheduler)
  registerAllSchedulers(queues);

  // Re-registrar schedulers periódicamente para auto-recuperación.
  // Si los scheduler keys desaparecen de Redis (por restart, flush, etc.),
  // este intervalo los recrea automáticamente sin necesidad de reiniciar workers.
  const refreshInterval = setInterval(async () => {
    try {
      await registerAllSchedulers(queues, true);
    } catch (err) {
      console.error("[Scheduler] Error re-registrando schedulers:", err);
    }
  }, SCHEDULER_REFRESH_INTERVAL_MS);

  // No bloquear el shutdown del proceso
  refreshInterval.unref();

  return {
    ...queues,
    close: async () => {
      clearInterval(refreshInterval);
      await Promise.all(Object.values(queues).map((q) => q.close()));
      await connection.quit();
    },
  };
}

/** Tipo con todas las queues para tipado de registerAllSchedulers */
interface QueueMap {
  collectGdelt: Queue;
  collectNewsdata: Queue;
  collectRss: Queue;
  collectGoogle: Queue;
  collectSocial: Queue;
  digest: Queue;
  weeklyReport: Queue;
  weeklyInsights: Queue;
  emergingTopics: Queue;
  groundingCheck: Queue;
  groundingWeekly: Queue;
  collectGnews: Queue;
  collectGnewsClient: Queue;
  watchdogMentions: Queue;
  archiveOldMentions: Queue;
  checkAlertRules: Queue;
  closeInactiveThreads: Queue;
  [key: string]: Queue;
}

/**
 * Registra todos los cron schedulers en BullMQ.
 * Usa upsertJobScheduler que es idempotente: si el scheduler ya existe
 * con el mismo patrón, no crea duplicados.
 * @param queues - Objeto con todas las colas
 * @param isRefresh - Si es true, es un re-registro periódico (log más compacto)
 */
async function registerAllSchedulers(
  queues: QueueMap,
  isRefresh = false
) {
  const label = isRefresh ? "[Scheduler refresh]" : "📅";

  // GDELT collector (default: every 15 minutes)
  await queues.collectGdelt.upsertJobScheduler(
    "gdelt-cron",
    { pattern: config.crons.gdelt },
    { name: "collect-gdelt" }
  );

  // NewsData collector (default: every 30 minutes)
  await queues.collectNewsdata.upsertJobScheduler(
    "newsdata-cron",
    { pattern: config.crons.newsdata },
    { name: "collect-newsdata" }
  );

  // RSS collector (default: every 10 minutes)
  await queues.collectRss.upsertJobScheduler(
    "rss-cron",
    { pattern: config.crons.rss },
    { name: "collect-rss" }
  );

  // Google CSE collector (default: every 2 hours)
  await queues.collectGoogle.upsertJobScheduler(
    "google-cron",
    { pattern: config.crons.google },
    { name: "collect-google" }
  );

  // Social Media: cron deshabilitado, recolección solo manual desde dashboard

  // Daily digest (default: 8:00 AM)
  await queues.digest.upsertJobScheduler(
    "daily-digest",
    { pattern: config.crons.digest },
    { name: "daily-digest" }
  );

  // Weekly report (default: Sunday 8:00 PM)
  const weeklyReportCron = process.env.WEEKLY_REPORT_CRON || "0 20 * * 0";
  await queues.weeklyReport.upsertJobScheduler(
    "weekly-report-cron",
    { pattern: weeklyReportCron },
    { name: "weekly-report" }
  );

  // Weekly insights (default: Monday 6:00 AM - antes de la jornada laboral)
  const weeklyInsightsCron = process.env.WEEKLY_INSIGHTS_CRON || "0 6 * * 1";
  await queues.weeklyInsights.upsertJobScheduler(
    "weekly-insights-cron",
    { pattern: weeklyInsightsCron },
    { name: "weekly-insights" }
  );

  // Emerging topics check (default: every 4 hours)
  const emergingTopicsCron = process.env.EMERGING_TOPICS_CRON || "0 */4 * * *";
  await queues.emergingTopics.upsertJobScheduler(
    "emerging-topics-cron",
    { pattern: emergingTopicsCron },
    { name: "check-emerging-topics" }
  );

  // Grounding: Low mentions check (default: 7:00 AM daily, before digest)
  const groundingCheckCron = process.env.GROUNDING_CHECK_CRON || "0 7 * * *";
  await queues.groundingCheck.upsertJobScheduler(
    "grounding-check-cron",
    { pattern: groundingCheckCron },
    { name: "check-low-mentions" }
  );

  // Grounding: Weekly grounding (default: 6:00 AM every day, checks if today matches client's config)
  const groundingWeeklyCron = process.env.GROUNDING_WEEKLY_CRON || "0 6 * * *";
  await queues.groundingWeekly.upsertJobScheduler(
    "grounding-weekly-cron",
    { pattern: groundingWeeklyCron },
    { name: "weekly-grounding" }
  );

  // Google News RSS collector (default: 6:00 AM daily, before digest)
  const gnewsCron = process.env.COLLECTOR_GNEWS_CRON || "0 6 * * *";
  await queues.collectGnews.upsertJobScheduler(
    "gnews-cron",
    { pattern: gnewsCron },
    { name: "collect-gnews" }
  );

  // Google News RSS client search (default: every 3 hours)
  const gnewsClientCron = process.env.COLLECTOR_GNEWS_CLIENT_CRON || "0 */3 * * *";
  await queues.collectGnewsClient.upsertJobScheduler(
    "gnews-client-cron",
    { pattern: gnewsClientCron },
    { name: "collect-gnews-client" }
  );

  // Watchdog de menciones (default: cada hora, solo si está habilitado)
  if (config.watchdog.enabled) {
    await queues.watchdogMentions.upsertJobScheduler(
      "watchdog-mentions-cron",
      { pattern: config.watchdog.checkIntervalCron },
      { name: "watchdog-mentions" }
    );
  }

  // Auto-archivado de menciones viejas (diario a las 3:00 AM)
  const archiveCron = process.env.ARCHIVE_OLD_MENTIONS_CRON || "0 3 * * *";
  await queues.archiveOldMentions.upsertJobScheduler(
    "archive-old-mentions-cron",
    { pattern: archiveCron },
    { name: "archive-old-mentions" }
  );

  // Evaluación de reglas de alerta (default: cada 30 minutos)
  const alertRulesCron = process.env.CHECK_ALERT_RULES_CRON || "*/30 * * * *";
  await queues.checkAlertRules.upsertJobScheduler(
    "check-alert-rules-cron",
    { pattern: alertRulesCron },
    { name: "check-alert-rules" }
  );

  // Cierre de topic threads inactivos (cada 6 horas)
  const closeThreadsCron = process.env.CLOSE_INACTIVE_THREADS_CRON || "0 */6 * * *";
  await queues.closeInactiveThreads.upsertJobScheduler(
    "close-inactive-threads-cron",
    { pattern: closeThreadsCron },
    { name: "close-inactive-threads" }
  );

  if (isRefresh) {
    console.log(`${label} Todos los schedulers re-registrados OK`);
  } else {
    console.log(`${label} GDELT: ${config.crons.gdelt}`);
    console.log(`${label} NewsData: ${config.crons.newsdata}`);
    console.log(`${label} RSS: ${config.crons.rss}`);
    console.log(`${label} Google CSE: ${config.crons.google}`);
    console.log(`${label} Digest: ${config.crons.digest}`);
    console.log(`${label} Weekly Report: ${weeklyReportCron}`);
    console.log(`${label} Weekly Insights: ${weeklyInsightsCron}`);
    console.log(`${label} Emerging Topics: ${emergingTopicsCron}`);
    console.log(`${label} Grounding Check: ${groundingCheckCron}`);
    console.log(`${label} Grounding Weekly: ${groundingWeeklyCron}`);
    console.log(`${label} GNews: ${gnewsCron}`);
    console.log(`${label} GNews Client Search: ${gnewsClientCron}`);
    if (config.watchdog.enabled) {
      console.log(`${label} Watchdog: ${config.watchdog.checkIntervalCron}`);
    }
    console.log(`${label} Archive Old Mentions: ${archiveCron}`);
    console.log(`${label} Alert Rules: ${alertRulesCron}`);
    console.log(`${label} Close Inactive Threads: ${closeThreadsCron}`);
    console.log(
      `[Scheduler] Auto-refresh habilitado cada ${SCHEDULER_REFRESH_INTERVAL_MS / 60000} minutos`
    );
  }
}

// Helper to enqueue jobs from other packages
export function getQueue(name: string) {
  return new Queue(name, { connection });
}
