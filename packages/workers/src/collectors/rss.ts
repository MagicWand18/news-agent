import Parser from "rss-parser";
import type { NormalizedArticle } from "@mediabot/shared";
import { config, prisma } from "@mediabot/shared";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "MediaBot/1.0",
  },
});

export async function collectRss(): Promise<NormalizedArticle[]> {
  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    select: { word: true },
  });

  const keywordSet = new Set(keywords.map((k) => k.word.toLowerCase()));
  if (keywordSet.size === 0) return [];

  const articles: NormalizedArticle[] = [];

  for (const feed of config.rssFeeds) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of parsed.items || []) {
        if (!item.link || !item.title) continue;

        // Check if any keyword matches in title or content snippet
        const text = `${item.title} ${item.contentSnippet || ""}`.toLowerCase();
        const matches = [...keywordSet].some((kw) => text.includes(kw.toLowerCase()));

        if (matches) {
          articles.push({
            url: item.link,
            title: item.title,
            source: feed.name,
            content: item.contentSnippet || item.content || undefined,
            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
          });
        }
      }
    } catch (error) {
      console.error(`RSS collector error for ${feed.name}:`, error);
    }
  }

  return articles;
}
