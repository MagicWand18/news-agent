import Parser from "rss-parser";
import type { NormalizedArticle } from "@mediabot/shared";
import { config, prisma } from "@mediabot/shared";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; MediaBot/1.0)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
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
  let totalParsed = 0;
  let feedsOk = 0;

  for (const feed of config.rssFeeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = parsed.items || [];
      totalParsed += items.length;
      feedsOk++;

      for (const item of items) {
        if (!item.link || !item.title) continue;

        // Check if any keyword matches in title or content snippet
        const text = `${item.title} ${item.contentSnippet || ""}`.toLowerCase();
        const matches = [...keywordSet].some((kw) => text.includes(kw));

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
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`RSS error [${feed.name}]: ${msg.slice(0, 100)}`);
    }
  }

  console.log(`📰 RSS: ${feedsOk}/${config.rssFeeds.length} feeds OK, ${totalParsed} items parsed, ${articles.length} matched keywords`);
  return articles;
}
