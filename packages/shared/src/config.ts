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
    model: "claude-3-5-haiku-20241022",
  },
  google: {
    cseApiKey: optionalEnv("GOOGLE_CSE_API_KEY", ""),
    cseCx: optionalEnv("GOOGLE_CSE_CX", ""),
  },
  newsdata: {
    apiKey: optionalEnv("NEWSDATA_API_KEY", ""),
  },
  collectors: {
    gdeltIntervalMs: 15 * 60 * 1000,
    newsdataIntervalMs: 30 * 60 * 1000,
    rssIntervalMs: 10 * 60 * 1000,
    googleIntervalMs: 2 * 60 * 60 * 1000,
  },
  rssFeeds: [
    { name: "EFE", url: "https://efe.com/feed/" },
    { name: "Europa Press", url: "https://www.europapress.es/rss/rss.aspx" },
    { name: "El Pais", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
    { name: "El Mundo", url: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml" },
    { name: "La Vanguardia", url: "https://www.lavanguardia.com/rss/home.xml" },
    { name: "20 Minutos", url: "https://www.20minutos.es/rss/" },
    { name: "ABC", url: "https://www.abc.es/rss/feeds/abc_ultima.xml" },
    { name: "Infobae", url: "https://www.infobae.com/feeds/rss/" },
    { name: "CNN Espanol", url: "https://cnnespanol.cnn.com/feed/" },
    { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
  ],
} as const;
