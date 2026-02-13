import type { NormalizedArticle } from "@mediabot/shared";
import { config, prisma } from "@mediabot/shared";

const GOOGLE_CSE_API = "https://www.googleapis.com/customsearch/v1";

export async function collectGoogle(): Promise<NormalizedArticle[]> {
  if (!config.google.cseApiKey || !config.google.cseCx) {
    console.warn("Google CSE not configured, skipping");
    return [];
  }

  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    select: { word: true },
  });

  if (keywords.length === 0) return [];

  const uniqueWords = [...new Set(keywords.map((k) => k.word))];
  const articles: NormalizedArticle[] = [];

  // Limit queries to stay within free tier (100/day)
  // With 2h interval = 12 queries/day max, so ~8 keywords max per run
  const wordsToSearch = uniqueWords.slice(0, 8);

  for (const word of wordsToSearch) {
    const params = new URLSearchParams({
      key: config.google.cseApiKey,
      cx: config.google.cseCx,
      q: `"${word}" noticias`,
      lr: "lang_es",
      sort: "date",
      dateRestrict: `d${config.articles.maxAgeDays}`,
      num: "5",
    });

    try {
      const response = await fetch(`${GOOGLE_CSE_API}?${params}`);
      if (!response.ok) {
        if (response.status === 429) {
          console.warn("Google CSE rate limit reached");
          break;
        }
        const body = await response.text().catch(() => "");
        console.error(`Google CSE error ${response.status} for "${word}": ${body.slice(0, 200)}`);
        if (response.status === 403) break; // API key issue, stop all queries
        continue;
      }

      const data = await response.json() as {
        items?: Array<{
          link: string;
          title: string;
          displayLink: string;
          snippet?: string;
          pagemap?: {
            metatags?: Array<{ [key: string]: string }>;
          };
        }>;
      };

      if (!data.items) continue;

      for (const item of data.items) {
        // Intentar extraer fecha de publicación de metatags
        let publishedAt: Date | undefined;
        const metatags = item.pagemap?.metatags?.[0];
        if (metatags) {
          const dateStr = metatags["article:published_time"]
            || metatags["og:article:published_time"]
            || metatags["date"]
            || metatags["publisheddate"];
          if (dateStr) {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) publishedAt = parsed;
          }
        }

        articles.push({
          url: item.link,
          title: item.title,
          source: item.displayLink || "Google",
          content: item.snippet || undefined,
          publishedAt,
        });
      }
    } catch (error) {
      console.error("Google CSE collector error:", error);
    }
  }

  return articles;
}
