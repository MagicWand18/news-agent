/**
 * Servicio de búsqueda de noticias via Google News RSS + Bing News RSS.
 * Combina múltiples fuentes RSS gratuitas para máxima cobertura.
 */
import {
  prisma,
  config,
  normalizeUrl,
} from "@mediabot/shared";
import { getQueue, QUEUE_NAMES } from "../queues.js";
import { preFilterArticle } from "../analysis/ai.js";
import {
  gnewsParser,
  getRealArticleUrl,
  extractRealUrl,
} from "../collectors/gnews.js";

const GNEWS_BASE_URL = "https://news.google.com/rss/search";
const BING_NEWS_BASE_URL = "https://www.bing.com/news/search";
const RATE_LIMIT_MS = 500;

export type GroundingTrigger = "manual" | "auto_low_mentions" | "weekly" | "onboarding";

export interface GroundingParams {
  clientId: string;
  clientName: string;
  industry?: string | null;
  days: number;
  articleCount: number;
  trigger: GroundingTrigger;
}

export interface GroundingArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  snippet?: string;
  publishedAt?: Date;
  /** true si el artículo está fuera del período solicitado (contexto histórico) */
  isHistorical?: boolean;
}

export interface GroundingResult {
  success: boolean;
  articles: GroundingArticle[];
  articlesFound: number;
  mentionsCreated: number;
  trigger: GroundingTrigger;
  error?: string;
  executedAt: Date;
}

/**
 * Resta días a una fecha.
 */
function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Extrae el nombre de la fuente del título de Google News RSS.
 * Google News agrega " - Fuente" al final del título.
 */
function extractSourceFromTitle(title: string): string {
  const parts = title.split(" - ");
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return "Google News";
}

/**
 * Limpia el título removiendo el sufijo " - Fuente" de Google News RSS.
 */
function cleanTitle(title: string): string {
  const parts = title.split(" - ");
  if (parts.length > 1) {
    return parts.slice(0, -1).join(" - ").trim();
  }
  return title;
}

/**
 * Busca artículos en Google News RSS para un término dado.
 */
export async function searchGoogleNewsRss(
  searchTerm: string
): Promise<Array<{ title: string; source: string; url: string; snippet?: string; publishedAt?: Date }>> {
  const query = encodeURIComponent(`"${searchTerm}"`);
  const url = `${GNEWS_BASE_URL}?q=${query}&hl=es-419&gl=MX&ceid=MX:es-419`;

  const feed = await gnewsParser.parseURL(url);
  const items = feed.items || [];

  const results: Array<{ title: string; source: string; url: string; snippet?: string; publishedAt?: Date }> = [];

  for (const item of items) {
    if (!item.link || !item.title) continue;

    // Extraer URL real del redirect de Google News
    const realUrl = await getRealArticleUrl(item.link);
    const source = item.creator || extractSourceFromTitle(item.title);
    const title = cleanTitle(item.title);

    results.push({
      title,
      source,
      url: realUrl,
      snippet: item.contentSnippet || undefined,
      publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
    });
  }

  return results;
}

/**
 * Extrae la URL real del wrapper de redirect de Bing News.
 * Bing envuelve URLs en: http://www.bing.com/news/apiclick.aspx?...&url=https%3a%2f%2f...
 */
function extractBingRealUrl(bingUrl: string): string {
  try {
    const url = new URL(bingUrl);
    const realUrl = url.searchParams.get("url");
    if (realUrl) return realUrl;
  } catch {
    // Ignorar errores de parsing
  }
  return bingUrl;
}

/**
 * Extrae un nombre legible del dominio de una URL.
 * Ej: "https://www.sdpnoticias.com/opinion/..." → "sdpnoticias.com"
 */
function extractSourceFromUrl(articleUrl: string): string {
  try {
    const hostname = new URL(articleUrl).hostname.replace(/^www\./, "");
    return hostname;
  } catch {
    return "Bing News";
  }
}

/**
 * Busca artículos en Bing News RSS para un término dado.
 */
export async function searchBingNewsRss(
  searchTerm: string
): Promise<Array<{ title: string; source: string; url: string; snippet?: string; publishedAt?: Date }>> {
  const query = encodeURIComponent(`"${searchTerm}"`);
  const url = `${BING_NEWS_BASE_URL}?q=${query}&format=rss`;

  const feed = await gnewsParser.parseURL(url);
  const items = feed.items || [];

  const results: Array<{ title: string; source: string; url: string; snippet?: string; publishedAt?: Date }> = [];

  for (const item of items) {
    if (!item.link || !item.title) continue;

    const realUrl = extractBingRealUrl(item.link);
    const source = extractSourceFromUrl(realUrl);

    results.push({
      title: item.title,
      source,
      url: realUrl,
      snippet: item.contentSnippet || undefined,
      publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
    });
  }

  return results;
}

/**
 * Ejecuta una búsqueda de noticias via Google News RSS + Bing News RSS.
 * Busca el nombre del cliente y crea artículos/menciones en la base de datos.
 */
export async function executeGroundingSearch(
  params: GroundingParams
): Promise<GroundingResult> {
  const { clientId, clientName, days, trigger } = params;
  const executedAt = new Date();
  const minAcceptableDate = subDays(new Date(), days);

  console.log(
    `[NewsSearch] Starting news RSS search for "${clientName}" (${trigger}): last ${days} days`
  );

  const foundArticles: GroundingArticle[] = [];
  const seenUrls = new Set<string>();

  try {
    // Buscar el nombre del cliente en Google News + Bing News en paralelo
    const [googleResults, bingResults] = await Promise.allSettled([
      searchGoogleNewsRss(clientName),
      searchBingNewsRss(clientName),
    ]);

    const rssResults = googleResults.status === "fulfilled" ? googleResults.value : [];
    const bingRssResults = bingResults.status === "fulfilled" ? bingResults.value : [];

    if (googleResults.status === "rejected") {
      console.warn(`[NewsSearch] Google News RSS failed: ${googleResults.reason}`);
    }
    if (bingResults.status === "rejected") {
      console.warn(`[NewsSearch] Bing News RSS failed: ${bingResults.reason}`);
    }

    console.log(`[NewsSearch] Google News: ${rssResults.length}, Bing News: ${bingRssResults.length} results for "${clientName}"`);

    // También obtener keywords del cliente para búsquedas adicionales
    const clientData = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        createdAt: true,
        description: true,
        keywords: {
          where: { active: true },
          select: { word: true },
        },
      },
    });

    // Buscar también por keywords que no sean el nombre del cliente
    const additionalTerms = (clientData?.keywords || [])
      .map((k) => k.word)
      .filter((w) => w.length > 3 && w.toLowerCase() !== clientName.toLowerCase());

    const additionalResults: typeof rssResults = [];
    for (const term of additionalTerms.slice(0, 3)) {
      try {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
        // Buscar en ambas fuentes por keyword
        const [gRes, bRes] = await Promise.allSettled([
          searchGoogleNewsRss(term),
          searchBingNewsRss(term),
        ]);
        if (gRes.status === "fulfilled") {
          additionalResults.push(...gRes.value);
          console.log(`[NewsSearch] Google News: ${gRes.value.length} results for keyword "${term}"`);
        }
        if (bRes.status === "fulfilled") {
          additionalResults.push(...bRes.value);
          console.log(`[NewsSearch] Bing News: ${bRes.value.length} results for keyword "${term}"`);
        }
      } catch (error) {
        console.warn(`[NewsSearch] Failed to search keyword "${term}":`, error);
      }
    }

    // Combinar resultados de todas las fuentes y deduplicar
    const allResults = [...rssResults, ...bingRssResults, ...additionalResults];

    for (const result of allResults) {
      const normalizedUrl = normalizeUrl(result.url);
      if (seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);

      // Filtrar por fecha si tenemos publishedAt
      const isHistorical = result.publishedAt ? result.publishedAt < minAcceptableDate : false;

      // Crear o encontrar artículo en DB
      let article = await prisma.article.findFirst({
        where: { url: result.url },
      });

      if (!article) {
        article = await prisma.article.create({
          data: {
            url: result.url,
            title: result.title,
            source: result.source,
            content: result.snippet || null,
            publishedAt: result.publishedAt || null,
          },
        });
      }

      foundArticles.push({
        id: article.id,
        title: result.title,
        source: result.source,
        url: result.url,
        snippet: result.snippet,
        publishedAt: result.publishedAt,
        isHistorical,
      });
    }

    // Complementar con artículos existentes en la DB
    const since = subDays(new Date(), days);
    const dbArticles = await prisma.article.findMany({
      where: {
        publishedAt: { gte: since },
        OR: [
          { title: { contains: clientName, mode: "insensitive" } },
          { content: { contains: clientName, mode: "insensitive" } },
        ],
        id: { notIn: foundArticles.map((a) => a.id) },
      },
      select: {
        id: true,
        title: true,
        source: true,
        url: true,
        content: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
    });

    for (const a of dbArticles) {
      foundArticles.push({
        id: a.id,
        title: a.title,
        source: a.source,
        url: a.url,
        snippet: a.content?.slice(0, 300) || undefined,
        publishedAt: a.publishedAt || undefined,
        isHistorical: false,
      });
    }

    console.log(`[NewsSearch] Total: ${foundArticles.length} articles (Google: ${rssResults.length}, Bing: ${bingRssResults.length}, DB: ${dbArticles.length})`);

    // Crear menciones con pre-filtrado
    const analyzeQueue = getQueue(QUEUE_NAMES.ANALYZE_MENTION);
    let mentionsCreated = 0;
    let skippedByFilter = 0;

    for (const article of foundArticles) {
      try {
        // Verificar si ya existe la mención
        const existing = await prisma.mention.findFirst({
          where: { articleId: article.id, clientId },
        });
        if (existing) continue;

        // Filtro rápido de texto: el título o snippet debe contener el nombre del cliente
        const textToCheck = `${article.title} ${article.snippet || ""}`.toLowerCase();
        const clientNameLower = clientName.toLowerCase();
        const clientNameNormalized = clientNameLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const textNormalized = textToCheck.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (!textToCheck.includes(clientNameLower) && !textNormalized.includes(clientNameNormalized)) {
          // Pre-filtro IA como segunda oportunidad
          try {
            const preFilter = await preFilterArticle({
              articleTitle: article.title,
              articleContent: article.snippet || "",
              clientName,
              clientDescription: clientData?.description || "",
              keyword: clientName,
            });

            if (!preFilter.relevant || preFilter.confidence < 0.5) {
              console.log(
                `[NewsSearch] Filtered out: "${article.title.slice(0, 50)}..." ` +
                `(reason: ${preFilter.reason}, confidence: ${preFilter.confidence.toFixed(2)})`
              );
              skippedByFilter++;
              continue;
            }
          } catch {
            console.warn(`[NewsSearch] Pre-filter error, skipping: ${article.title.slice(0, 50)}`);
            skippedByFilter++;
            continue;
          }
        }

        // Marcar como historial si el artículo es más viejo que maxAgeDays
        const maxAgeCutoff = new Date(Date.now() - config.articles.maxAgeDays * 24 * 60 * 60 * 1000);
        const isLegacy = article.publishedAt ? article.publishedAt < maxAgeCutoff : false;

        const mention = await prisma.mention.create({
          data: {
            articleId: article.id,
            clientId,
            keywordMatched: clientName,
            snippet: article.snippet || null,
            sentiment: "NEUTRAL",
            relevance: 6,
            isLegacy,
            publishedAt: article.publishedAt || null,
          },
        });
        mentionsCreated++;

        // Encolar para análisis IA (sentimiento, relevancia, resumen)
        await analyzeQueue.add("analyze", { mentionId: mention.id }, {
          attempts: config.jobs.retryAttempts,
          backoff: { type: "exponential", delay: config.jobs.backoffDelayMs },
        });
      } catch (err) {
        console.warn(`[NewsSearch] Error creating mention for article ${article.id}:`, err);
      }
    }

    if (skippedByFilter > 0) {
      console.log(`[NewsSearch] Filtered out ${skippedByFilter} irrelevant articles`);
    }

    // Actualizar cliente con resultado
    const groundingResult: GroundingResult = {
      success: true,
      articles: foundArticles,
      articlesFound: foundArticles.length,
      mentionsCreated,
      trigger,
      executedAt,
    };

    await prisma.client.update({
      where: { id: clientId },
      data: {
        lastGroundingAt: executedAt,
        lastGroundingResult: {
          articlesFound: groundingResult.articlesFound,
          mentionsCreated: groundingResult.mentionsCreated,
          trigger: groundingResult.trigger,
          executedAt: groundingResult.executedAt.toISOString(),
        },
      },
    });

    console.log(
      `[NewsSearch] Completed for "${clientName}": ${foundArticles.length} articles, ${mentionsCreated} new mentions`
    );

    return groundingResult;
  } catch (error) {
    console.error("[NewsSearch] Search error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";

    await prisma.client.update({
      where: { id: clientId },
      data: {
        lastGroundingAt: executedAt,
        lastGroundingResult: {
          articlesFound: 0,
          mentionsCreated: 0,
          trigger,
          error: errorMessage,
          executedAt: executedAt.toISOString(),
        },
      },
    });

    return {
      success: false,
      articles: [],
      articlesFound: 0,
      mentionsCreated: 0,
      trigger,
      error: errorMessage,
      executedAt,
    };
  }
}

/**
 * Verifica si un cliente tiene pocas menciones recientes.
 * Retorna true si el cliente tiene menos menciones que el umbral por N días consecutivos.
 */
export async function checkLowMentions(
  clientId: string,
  minDailyMentions: number,
  consecutiveDays: number
): Promise<boolean> {
  const now = new Date();

  for (let i = 0; i < consecutiveDays; i++) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const count = await prisma.mention.count({
      where: {
        clientId,
        publishedAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    if (count >= minDailyMentions) {
      return false;
    }
  }

  return true;
}
