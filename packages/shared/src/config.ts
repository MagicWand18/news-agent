function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function optionalEnvInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export const config = {
  database: {
    url: requireEnv("DATABASE_URL", process.env.NODE_ENV === "test" ? "postgresql://test:test@localhost:5432/test" : undefined),
  },
  redis: {
    url: optionalEnv("REDIS_URL", "redis://localhost:6379"),
  },
  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN", process.env.NODE_ENV === "test" ? "test-token" : undefined),
  },
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY", process.env.NODE_ENV === "test" ? "test-key" : undefined),
    model: optionalEnv("CLAUDE_MODEL", "claude-3-5-haiku-20241022"),
  },
  google: {
    cseApiKey: optionalEnv("GOOGLE_CSE_API_KEY", ""),
    cseCx: optionalEnv("GOOGLE_CSE_CX", ""),
    apiKey: optionalEnv("GOOGLE_API_KEY", ""), // Gemini API key for search grounding
  },
  newsdata: {
    apiKey: optionalEnv("NEWSDATA_API_KEY", ""),
  },
  ensembledata: {
    token: optionalEnv("ENSEMBLEDATA_TOKEN", ""),
    baseUrl: "https://ensembledata.com/apis",
  },
  // Cron patterns for collectors (use env vars for flexibility without code changes)
  crons: {
    gdelt: optionalEnv("COLLECTOR_GDELT_CRON", "*/15 * * * *"),
    newsdata: optionalEnv("COLLECTOR_NEWSDATA_CRON", "*/30 * * * *"),
    rss: optionalEnv("COLLECTOR_RSS_CRON", "*/10 * * * *"),
    google: optionalEnv("COLLECTOR_GOOGLE_CRON", "0 */2 * * *"),
    social: optionalEnv("COLLECTOR_SOCIAL_CRON", "0 */4 * * *"), // Cada 4 horas
    digest: optionalEnv("DIGEST_CRON", "0 8 * * *"),
  },
  // Worker configuration
  workers: {
    analysis: {
      concurrency: optionalEnvInt("ANALYSIS_WORKER_CONCURRENCY", 3),
      rateLimitMax: optionalEnvInt("ANALYSIS_RATE_LIMIT_MAX", 20),
      rateLimitWindowMs: optionalEnvInt("ANALYSIS_RATE_LIMIT_WINDOW_MS", 60000),
    },
    notification: {
      concurrency: optionalEnvInt("NOTIFICATION_WORKER_CONCURRENCY", 5),
    },
  },
  // Job retry configuration
  jobs: {
    retryAttempts: optionalEnvInt("JOB_RETRY_ATTEMPTS", 3),
    backoffDelayMs: optionalEnvInt("JOB_BACKOFF_DELAY_MS", 5000),
  },
  // Crisis detection settings
  crisis: {
    negativeMentionThreshold: optionalEnvInt("CRISIS_NEGATIVE_MENTION_THRESHOLD", 3),
    windowMinutes: optionalEnvInt("CRISIS_WINDOW_MINUTES", 60),
  },
  // Legacy intervals (kept for backwards compatibility)
  collectors: {
    gdeltIntervalMs: 15 * 60 * 1000,
    newsdataIntervalMs: 30 * 60 * 1000,
    rssIntervalMs: 10 * 60 * 1000,
    googleIntervalMs: 2 * 60 * 60 * 1000,
  },
  rssFeeds: [
    // Mexico
    { name: "Milenio", url: "https://www.milenio.com/rss" },
    { name: "Reforma", url: "https://www.reforma.com/rss/portada.xml" },
    { name: "Expansion", url: "https://expansion.mx/rss" },
    { name: "La Jornada", url: "https://www.jornada.com.mx/rss/edicion.xml" },
    { name: "Lopez Doriga", url: "https://lopezdoriga.com/feed/" },
    { name: "Sin Embargo", url: "https://www.sinembargo.mx/feed/" },
    { name: "Forbes MX", url: "https://www.forbes.com.mx/feed/" },
    // International in Spanish
    { name: "CNN Espanol", url: "https://cnnespanol.cnn.com/feed/" },
    { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
  ],
} as const;
