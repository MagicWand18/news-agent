import { createHash } from "crypto";
import { prisma, config, getSettingNumber } from "@mediabot/shared";
import type { NormalizedArticle } from "@mediabot/shared";
import { publishRealtimeEvent } from "@mediabot/shared/src/realtime-publisher.js";
import { REALTIME_CHANNELS } from "@mediabot/shared/src/realtime-types.js";
import { getQueue, QUEUE_NAMES } from "../queues.js";
import { preFilterArticle } from "../analysis/ai.js";

/** Patrones de URLs que no son artículos reales */
const NON_ARTICLE_PATTERNS = [
  /\/tags?\//i,
  /\/categoria\//i,
  /\/author\//i,
  /\/(feed|rss)\/?$/i,
  /\/search\?/i,
  /^https?:\/\/[^/]+\/?$/i,
];

/**
 * Extrae fecha de la URL con patrón /YYYY/MM/DD/.
 * Retorna null si no encuentra, si es futura o si tiene >10 años.
 */
function extractDateFromUrl(url: string): Date | null {
  const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);

  if (isNaN(date.getTime())) return null;
  if (date > new Date(Date.now() + 24 * 60 * 60 * 1000)) return null;
  if (date < new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000)) return null;

  return date;
}

export async function ingestArticle(article: NormalizedArticle) {
  // Dedup by URL
  const existing = await prisma.article.findUnique({
    where: { url: article.url },
  });

  if (existing) {
    console.log(`⏭️ Skip (dup URL): ${article.title.slice(0, 50)}`);
    return;
  }

  // Content hash for secondary dedup
  const contentHash = article.content
    ? createHash("sha256").update(article.content).digest("hex")
    : null;

  if (contentHash) {
    const hashMatch = await prisma.article.findFirst({
      where: { contentHash },
    });
    if (hashMatch) {
      console.log(`⏭️ Skip (dup hash): ${article.title.slice(0, 50)}`);
      return;
    }
  }

  // A1: Filtrar URLs que no son artículos reales
  if (NON_ARTICLE_PATTERNS.some((p) => p.test(article.url))) {
    console.log(`⏭️ Skip (non-article URL): ${article.url.slice(0, 80)}`);
    return;
  }

  // A2: Fallback — extraer fecha de la URL si no tiene publishedAt
  if (!article.publishedAt) {
    const urlDate = extractDateFromUrl(article.url);
    if (urlDate) {
      article.publishedAt = urlDate;
      console.log(`📅 Date from URL: ${urlDate.toISOString().split("T")[0]} - ${article.url.slice(0, 80)}`);
    }
  }

  // A3: Rechazar artículos sin fecha (excepto YouTube)
  if (!article.publishedAt) {
    const isVideoSource = article.url.includes("youtube.com") || article.url.includes("youtu.be");
    if (!isVideoSource) {
      console.log(`⏭️ Skip (no date): ${article.title.slice(0, 50)} - ${article.source}`);
      return;
    }
  }

  // A4: Validar fechas razonables
  if (article.publishedAt) {
    const pubDate = new Date(article.publishedAt);
    if (pubDate > new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      console.log(`⏭️ Skip (future date): ${article.title.slice(0, 50)} (${pubDate.toISOString().split("T")[0]})`);
      return;
    }
    if (pubDate < new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000)) {
      console.log(`⏭️ Skip (too old >5y): ${article.title.slice(0, 50)} (${pubDate.toISOString().split("T")[0]})`);
      return;
    }
  }

  // Filtrar artículos con publishedAt > 48h (evita ingestar artículos viejos)
  if (article.publishedAt) {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    if (new Date(article.publishedAt) < fortyEightHoursAgo) {
      console.log(`⏭️ Skip (>48h old): ${article.title.slice(0, 50)} (published ${new Date(article.publishedAt).toISOString().split("T")[0]})`);
      return;
    }
  }

  // Save article
  const saved = await prisma.article.create({
    data: {
      url: article.url,
      title: article.title,
      source: article.source,
      content: article.content || null,
      contentHash,
      publishedAt: article.publishedAt || null,
    },
  });

  console.log(`💾 Saved article: ${saved.id} - ${article.title.slice(0, 60)}`);

  // Run matching against all active keywords
  await matchArticle(saved.id, article);
}

async function matchArticle(
  articleId: string,
  article: NormalizedArticle
) {
  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    include: { client: { select: { id: true, name: true, active: true, description: true, industry: true, createdAt: true, orgId: true } } },
  });

  const text = `${article.title} ${article.content || ""}`.toLowerCase();
  const analyzeQueue = getQueue(QUEUE_NAMES.ANALYZE_MENTION);

  // Group matches by client to avoid duplicate mentions per client
  const matchesByClient = new Map<
    string,
    { clientId: string; keyword: string; client: typeof keywords[0]["client"] }
  >();

  for (const kw of keywords) {
    if (!kw.client.active) continue;

    const kwLower = kw.word.toLowerCase();
    // Fuzzy-ish matching: check if keyword appears in text
    // Also check common variations (with/without accents for Spanish)
    const variations = [kwLower, removeAccents(kwLower)];
    const textNorm = removeAccents(text);

    const matched = variations.some(
      (v) => text.includes(v) || textNorm.includes(v)
    );

    if (matched && !matchesByClient.has(kw.clientId)) {
      matchesByClient.set(kw.clientId, {
        clientId: kw.clientId,
        keyword: kw.word,
        client: kw.client,
      });
    }
  }

  // Create mentions and enqueue analysis (with pre-filtering)
  for (const [, match] of matchesByClient) {
    // Pre-filter: Use AI to validate if this is a real mention
    try {
      const preFilterThreshold = await getSettingNumber("prefilter.confidence_threshold", 0.6);

      const preFilterResult = await preFilterArticle({
        articleTitle: article.title,
        articleContent: article.content || "",
        clientName: match.client.name,
        clientDescription: match.client.description || "",
        keyword: match.keyword,
      });

      if (!preFilterResult.relevant || preFilterResult.confidence < preFilterThreshold) {
        console.log(
          `⏭️ Pre-filter skip: client="${match.client.name}" keyword="${match.keyword}" ` +
          `reason="${preFilterResult.reason}" confidence=${preFilterResult.confidence.toFixed(2)} (threshold: ${preFilterThreshold})`
        );
        continue;
      }

      console.log(
        `✅ Pre-filter pass: client="${match.client.name}" keyword="${match.keyword}" ` +
        `confidence=${preFilterResult.confidence.toFixed(2)}`
      );
    } catch (error) {
      // If pre-filter fails, proceed with mention creation (don't lose potential mentions)
      console.error(`⚠️ Pre-filter error for client="${match.client.name}":`, error);
    }

    // Extract snippet around keyword
    const kwIndex = text.indexOf(match.keyword.toLowerCase());
    const snippetStart = Math.max(0, kwIndex - 100);
    const snippetEnd = Math.min(text.length, kwIndex + match.keyword.length + 200);
    const snippet = (article.content || article.title).slice(snippetStart, snippetEnd);

    // Marcar como historial si el artículo es más viejo que maxAgeDays
    const articleDate = article.publishedAt ? new Date(article.publishedAt) : null;
    const maxAgeCutoff = new Date(Date.now() - config.articles.maxAgeDays * 24 * 60 * 60 * 1000);
    const isLegacy = articleDate ? articleDate < maxAgeCutoff : false;

    const mention = await prisma.mention.create({
      data: {
        articleId,
        clientId: match.clientId,
        keywordMatched: match.keyword,
        snippet,
        isLegacy,
        publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
      },
    });

    console.log(`🔔 Mention created: client=${match.clientId} keyword="${match.keyword}"`);

    // Publicar evento realtime
    publishRealtimeEvent(REALTIME_CHANNELS.MENTION_NEW, {
      id: mention.id,
      clientId: match.clientId,
      orgId: match.client.orgId ?? null,
      title: article.title,
      source: article.source,
      timestamp: new Date().toISOString(),
    });

    // Enqueue for AI analysis
    await analyzeQueue.add("analyze", { mentionId: mention.id }, {
      attempts: config.jobs.retryAttempts,
      backoff: { type: "exponential", delay: config.jobs.backoffDelayMs },
    });
  }
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
