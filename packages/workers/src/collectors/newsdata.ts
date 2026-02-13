import type { NormalizedArticle } from "@mediabot/shared";
import { config, prisma } from "@mediabot/shared";

const NEWSDATA_API = "https://newsdata.io/api/1/news";

export async function collectNewsdata(): Promise<NormalizedArticle[]> {
  if (!config.newsdata.apiKey) {
    console.warn("NewsData API key not configured, skipping");
    return [];
  }

  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    select: { word: true },
  });

  if (keywords.length === 0) return [];

  const uniqueWords = [...new Set(keywords.map((k) => k.word))];
  // NewsData allows combining with OR, max 5 keywords per request
  const batches: string[][] = [];
  for (let i = 0; i < uniqueWords.length; i += 5) {
    batches.push(uniqueWords.slice(i, i + 5));
  }

  const articles: NormalizedArticle[] = [];

  for (const batch of batches) {
    const query = batch.join(" OR ");

    const params = new URLSearchParams({
      apikey: config.newsdata.apiKey,
      q: query,
      language: "es",
      size: "10",
      timeframe: `${config.articles.maxAgeDays}`,
    });

    try {
      const response = await fetch(`${NEWSDATA_API}?${params}`);
      if (!response.ok) {
        console.error(`NewsData API error: ${response.status}`);
        continue;
      }

      const data = await response.json() as {
        results?: Array<{
          link: string;
          title: string;
          source_id: string;
          description?: string;
          pubDate?: string;
          content?: string;
        }>;
      };

      if (!data.results) continue;

      for (const item of data.results) {
        articles.push({
          url: item.link,
          title: item.title || "Sin titulo",
          source: item.source_id || "NewsData",
          content: item.description || item.content || undefined,
          publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        });
      }
    } catch (error) {
      console.error("NewsData collector error:", error);
    }
  }

  return articles;
}
