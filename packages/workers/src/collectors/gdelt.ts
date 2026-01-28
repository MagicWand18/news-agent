import type { NormalizedArticle } from "@mediabot/shared";
import { prisma } from "@mediabot/shared";

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

export async function collectGdelt(): Promise<NormalizedArticle[]> {
  // Get all active keywords across all clients
  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    select: { word: true },
  });

  if (keywords.length === 0) return [];

  // Build query from keywords (GDELT supports OR queries)
  const uniqueWords = [...new Set(keywords.map((k) => k.word))];
  // GDELT query: combine with OR, filter by Spanish language
  // sourcelang must be inside the query parameter, not a separate URL param
  const queryWithLang = `(${uniqueWords.map((w) => `"${w}"`).join(" OR ")}) sourcelang:spanish`;

  const params = new URLSearchParams({
    query: queryWithLang,
    mode: "artlist",
    maxrecords: "50",
    format: "json",
    timespan: "60min",
  });

  try {
    const response = await fetch(`${GDELT_DOC_API}?${params}`);
    if (!response.ok) {
      console.error(`GDELT API error: ${response.status}`);
      return [];
    }

    const text = await response.text();
    let data: {
      articles?: Array<{
        url: string;
        title: string;
        domain: string;
        seendate: string;
        socialimage?: string;
      }>;
    };
    try {
      data = JSON.parse(text);
    } catch {
      // GDELT sometimes returns plain text errors even with 200 status
      console.error(`GDELT returned non-JSON: ${text.slice(0, 100)}`);
      return [];
    }

    if (!data.articles) return [];

    return data.articles.map((article) => ({
      url: article.url,
      title: article.title || "Sin titulo",
      source: article.domain || "GDELT",
      publishedAt: article.seendate ? parseGdeltDate(article.seendate) : undefined,
    }));
  } catch (error) {
    console.error("GDELT collector error:", error);
    return [];
  }
}

function parseGdeltDate(dateStr: string): Date {
  // GDELT format: YYYYMMDDHHmmss
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  const h = dateStr.slice(8, 10);
  const min = dateStr.slice(10, 12);
  const s = dateStr.slice(12, 14);
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
}
