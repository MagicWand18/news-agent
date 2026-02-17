import type { NormalizedArticle } from "@mediabot/shared";
import { prisma } from "@mediabot/shared";

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

/** Máximo de keywords por request (GDELT tiene límite no documentado de ~10-15 terms) */
const GDELT_BATCH_SIZE = 8;

/** Pausa entre requests para respetar rate limits (ms) */
const GDELT_RATE_LIMIT_MS = 6000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function collectGdelt(): Promise<NormalizedArticle[]> {
  // Get all active keywords across all clients
  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    select: { word: true },
  });

  if (keywords.length === 0) return [];

  const uniqueWords = [...new Set(keywords.map((k) => k.word))];

  // Partir keywords en batches para no exceder el límite de GDELT
  const batches: string[][] = [];
  for (let i = 0; i < uniqueWords.length; i += GDELT_BATCH_SIZE) {
    batches.push(uniqueWords.slice(i, i + GDELT_BATCH_SIZE));
  }

  console.log(`[GDELT] ${uniqueWords.length} keywords → ${batches.length} batches de ${GDELT_BATCH_SIZE}`);

  const allArticles: NormalizedArticle[] = [];
  const seenUrls = new Set<string>();

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]!;

    // Rate limit entre batches (no en el primero)
    if (batchIdx > 0) {
      await sleep(GDELT_RATE_LIMIT_MS);
    }

    const queryWithLang = `(${batch.map((w) => `"${w}"`).join(" OR ")}) sourcelang:spanish`;

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
        const errorBody = await response.text().catch(() => "");
        console.error(`[GDELT] Batch ${batchIdx + 1}/${batches.length} error: ${response.status} - ${errorBody.slice(0, 200)}`);
        continue;
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
        console.error(`[GDELT] Batch ${batchIdx + 1}/${batches.length} non-JSON: ${text.slice(0, 100)}`);
        continue;
      }

      if (!data.articles) continue;

      // Deduplicar por URL entre batches
      let added = 0;
      for (const article of data.articles) {
        if (seenUrls.has(article.url)) continue;
        seenUrls.add(article.url);
        allArticles.push({
          url: article.url,
          title: article.title || "Sin titulo",
          source: article.domain || "GDELT",
          publishedAt: article.seendate ? parseGdeltDate(article.seendate) : undefined,
        });
        added++;
      }

      console.log(`[GDELT] Batch ${batchIdx + 1}/${batches.length}: ${added} artículos (keywords: ${batch.slice(0, 3).join(", ")}...)`);
    } catch (error) {
      console.error(`[GDELT] Batch ${batchIdx + 1}/${batches.length} error:`, error);
      continue;
    }
  }

  console.log(`[GDELT] Total: ${allArticles.length} artículos únicos`);
  return allArticles;
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
