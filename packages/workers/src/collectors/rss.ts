import Parser from "rss-parser";
import type { NormalizedArticle } from "@mediabot/shared";
import { config, prisma } from "@mediabot/shared";

// Configuración del collector RSS (puede sobrescribirse con env vars)
const RSS_CONFIG = {
  timeout: parseInt(process.env.RSS_TIMEOUT || "15000", 10),
  maxRedirects: parseInt(process.env.RSS_MAX_REDIRECTS || "3", 10),
  errorThreshold: parseInt(process.env.RSS_ERROR_THRESHOLD || "10", 10),
  retryAttempts: parseInt(process.env.RSS_RETRY_ATTEMPTS || "2", 10),
  retryDelayMs: parseInt(process.env.RSS_RETRY_DELAY_MS || "2000", 10),
  userAgent: "Mozilla/5.0 (compatible; MediaBot/1.0)",
};

// Tipos de errores para logging detallado
type RssErrorType =
  | "TIMEOUT"
  | "DNS_ERROR"
  | "CONNECTION_ERROR"
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "REDIRECT_LOOP"
  | "HTML_RESPONSE"
  | "UNKNOWN";

interface RssError {
  type: RssErrorType;
  message: string;
  httpCode?: number;
}

const parser = new Parser({
  timeout: RSS_CONFIG.timeout,
  headers: {
    "User-Agent": RSS_CONFIG.userAgent,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

/**
 * Clasifica un error en un tipo específico para mejor logging
 */
function classifyError(error: unknown): RssError {
  if (!(error instanceof Error)) {
    return { type: "UNKNOWN", message: String(error) };
  }

  const msg = error.message.toLowerCase();

  if (msg.includes("timeout") || msg.includes("timedout") || msg.includes("aborted")) {
    return { type: "TIMEOUT", message: "Request timeout" };
  }

  if (msg.includes("getaddrinfo") || msg.includes("enotfound") || msg.includes("dns")) {
    return { type: "DNS_ERROR", message: "DNS resolution failed" };
  }

  if (msg.includes("econnrefused") || msg.includes("econnreset") || msg.includes("socket")) {
    return { type: "CONNECTION_ERROR", message: error.message };
  }

  if (msg.includes("status code") || msg.includes("response")) {
    const codeMatch = msg.match(/(\d{3})/);
    return {
      type: "HTTP_ERROR",
      message: error.message,
      httpCode: codeMatch ? parseInt(codeMatch[1], 10) : undefined,
    };
  }

  if (msg.includes("non-whitespace") || msg.includes("not valid") || msg.includes("parse")) {
    return { type: "PARSE_ERROR", message: "Invalid XML/RSS content" };
  }

  return { type: "UNKNOWN", message: error.message };
}

/**
 * Sigue redirects manualmente y devuelve la URL final
 */
async function resolveRedirects(url: string): Promise<{ finalUrl: string; redirected: boolean }> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < RSS_CONFIG.maxRedirects) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RSS_CONFIG.timeout);

      const response = await fetch(currentUrl, {
        method: "HEAD",
        headers: { "User-Agent": RSS_CONFIG.userAgent },
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (location) {
          // Resolver URL relativa
          if (location.startsWith("/")) {
            const base = new URL(currentUrl);
            currentUrl = `${base.protocol}//${base.host}${location}`;
          } else {
            currentUrl = location;
          }
          redirectCount++;
          continue;
        }
      }

      // No hay más redirects
      return { finalUrl: currentUrl, redirected: redirectCount > 0 };
    } catch {
      // Si falla el HEAD, devolver la URL actual
      return { finalUrl: currentUrl, redirected: redirectCount > 0 };
    }
  }

  return { finalUrl: currentUrl, redirected: true };
}

/**
 * Verifica si la respuesta es HTML en lugar de RSS
 */
async function isHtmlResponse(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": RSS_CONFIG.userAgent,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return true;

    // Verificar el contenido si el content-type es ambiguo
    const text = await response.text();
    const trimmed = text.trim().substring(0, 200).toLowerCase();

    // Si empieza con <!doctype o <html, es HTML
    if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Intenta parsear un feed con reintentos y resolución de redirects
 */
async function fetchFeedWithRetry(
  url: string,
  sourceName: string,
  retries: number = RSS_CONFIG.retryAttempts
): Promise<{
  success: boolean;
  items: Parser.Item[];
  error?: RssError;
  finalUrl?: string;
}> {
  let lastError: RssError | undefined;
  let currentUrl = url;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Primer intento: resolver redirects si es necesario
      if (attempt === 0) {
        const resolved = await resolveRedirects(url);
        if (resolved.redirected) {
          currentUrl = resolved.finalUrl;
          console.log(`  ↪️ [${sourceName}] Redirect: ${url} → ${currentUrl}`);
        }
      }

      // Verificar si es HTML antes de parsear
      const isHtml = await isHtmlResponse(currentUrl);
      if (isHtml) {
        return {
          success: false,
          items: [],
          error: { type: "HTML_RESPONSE", message: "URL returns HTML, not RSS" },
        };
      }

      // Intentar parsear
      const parsed = await parser.parseURL(currentUrl);
      return {
        success: true,
        items: parsed.items || [],
        finalUrl: currentUrl !== url ? currentUrl : undefined,
      };
    } catch (error) {
      lastError = classifyError(error);

      // No reintentar ciertos tipos de errores
      if (
        lastError.type === "DNS_ERROR" ||
        lastError.type === "HTML_RESPONSE" ||
        (lastError.type === "HTTP_ERROR" && lastError.httpCode === 404)
      ) {
        break;
      }

      // Esperar antes de reintentar
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, RSS_CONFIG.retryDelayMs * (attempt + 1))
        );
      }
    }
  }

  return {
    success: false,
    items: [],
    error: lastError,
  };
}

/**
 * Obtiene las fuentes RSS de la base de datos.
 * Si no hay fuentes en DB, usa el fallback de config.
 */
async function getRssSources(): Promise<Array<{ id?: string; name: string; url: string }>> {
  try {
    // Intentar obtener fuentes de la base de datos
    const dbSources = await prisma.rssSource.findMany({
      where: { active: true },
      select: { id: true, name: true, url: true },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });

    if (dbSources.length > 0) {
      console.log(`📊 RSS: Usando ${dbSources.length} fuentes de la base de datos`);
      return dbSources;
    }
  } catch (error) {
    // Si la tabla no existe o hay error, usar fallback
    console.log(`⚠️ RSS: Error al consultar RssSource, usando config fallback`);
  }

  // Fallback a config hardcodeada
  console.log(`📊 RSS: Usando ${config.rssFeeds.length} fuentes del config (fallback)`);
  return [...config.rssFeeds];
}

/**
 * Actualiza el estado de una fuente RSS en la base de datos.
 */
async function updateSourceStatus(
  sourceId: string | undefined,
  success: boolean
): Promise<void> {
  if (!sourceId) return;

  try {
    if (success) {
      await prisma.rssSource.update({
        where: { id: sourceId },
        data: {
          lastFetch: new Date(),
          errorCount: 0,
        },
      });
    } else {
      await prisma.rssSource.update({
        where: { id: sourceId },
        data: {
          errorCount: { increment: 1 },
        },
      });
    }
  } catch (error) {
    // Ignorar errores de actualización de estado
  }
}

/**
 * Actualiza la URL de una fuente después de seguir redirects
 */
async function updateSourceUrl(sourceId: string, newUrl: string): Promise<void> {
  try {
    await prisma.rssSource.update({
      where: { id: sourceId },
      data: { url: newUrl },
    });
    console.log(`  📝 URL actualizada en DB para ${sourceId}`);
  } catch {
    // Ignorar errores de actualización
  }
}

/**
 * Desactiva fuentes con demasiados errores consecutivos.
 */
async function deactivateFailingSources(
  threshold: number = RSS_CONFIG.errorThreshold
): Promise<void> {
  try {
    const result = await prisma.rssSource.updateMany({
      where: {
        errorCount: { gte: threshold },
        active: true,
      },
      data: { active: false },
    });

    if (result.count > 0) {
      console.log(`⚠️ RSS: ${result.count} fuente(s) desactivada(s) por errores consecutivos`);
    }
  } catch (error) {
    // Ignorar
  }
}

export async function collectRss(): Promise<NormalizedArticle[]> {
  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    select: { word: true },
  });

  const keywordSet = new Set(keywords.map((k) => k.word.toLowerCase()));
  if (keywordSet.size === 0) return [];

  // Obtener fuentes (de DB o fallback)
  const sources = await getRssSources();

  const articles: NormalizedArticle[] = [];
  let totalParsed = 0;
  let feedsOk = 0;

  // Contadores de errores por tipo para el resumen final
  const errorStats: Record<RssErrorType, number> = {
    TIMEOUT: 0,
    DNS_ERROR: 0,
    CONNECTION_ERROR: 0,
    HTTP_ERROR: 0,
    PARSE_ERROR: 0,
    REDIRECT_LOOP: 0,
    HTML_RESPONSE: 0,
    UNKNOWN: 0,
  };

  for (const source of sources) {
    const sourceId = (source as { id?: string }).id;

    // Usar el nuevo fetcher con reintentos y manejo de redirects
    const result = await fetchFeedWithRetry(source.url, source.name);

    if (result.success) {
      const items = result.items;
      totalParsed += items.length;
      feedsOk++;

      // Si la URL cambió por redirect, actualizar en DB
      if (result.finalUrl && sourceId) {
        await updateSourceUrl(sourceId, result.finalUrl);
      }

      // Actualizar estado exitoso
      await updateSourceStatus(sourceId, true);

      for (const item of items) {
        if (!item.link || !item.title) continue;

        // Verificar si algún keyword coincide en título o contenido
        const text = `${item.title} ${item.contentSnippet || ""}`.toLowerCase();
        const matches = Array.from(keywordSet).some((kw) => text.includes(kw));

        if (matches) {
          articles.push({
            url: item.link,
            title: item.title,
            source: source.name,
            content: item.contentSnippet || item.content || undefined,
            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
          });
        }
      }
    } else {
      // Logging detallado del error
      const err = result.error || { type: "UNKNOWN", message: "Unknown error" };
      errorStats[err.type]++;

      const errorIcon =
        err.type === "TIMEOUT"
          ? "⏱️"
          : err.type === "DNS_ERROR"
            ? "🌐"
            : err.type === "HTTP_ERROR"
              ? `🔴 ${err.httpCode || ""}`
              : err.type === "HTML_RESPONSE"
                ? "📄"
                : "❌";

      console.error(
        `  ${errorIcon} [${source.name}] ${err.type}: ${err.message.slice(0, 80)}`
      );

      // Actualizar estado de error
      await updateSourceStatus(sourceId, false);
    }
  }

  // Desactivar fuentes que fallan repetidamente
  await deactivateFailingSources();

  // Resumen detallado
  console.log(
    `📰 RSS: ${feedsOk}/${sources.length} feeds OK, ${totalParsed} items parsed, ${articles.length} matched keywords`
  );

  // Mostrar desglose de errores si hay varios
  const totalErrors = Object.values(errorStats).reduce((a, b) => a + b, 0);
  if (totalErrors > 0) {
    const errorSummary = Object.entries(errorStats)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${type}:${count}`)
      .join(", ");
    console.log(`  ⚠️ Errores: ${errorSummary}`);
  }

  return articles;
}

/**
 * Obtiene estadísticas de las fuentes RSS.
 */
export async function getRssStats(): Promise<{
  total: number;
  active: number;
  byType: Record<string, number>;
  byTier: Record<number, number>;
  failing: number;
}> {
  try {
    const [total, active, byType, byTier, failing] = await Promise.all([
      prisma.rssSource.count(),
      prisma.rssSource.count({ where: { active: true } }),
      prisma.rssSource.groupBy({
        by: ["type"],
        _count: { id: true },
      }),
      prisma.rssSource.groupBy({
        by: ["tier"],
        _count: { id: true },
      }),
      prisma.rssSource.count({ where: { errorCount: { gte: 3 } } }),
    ]);

    return {
      total,
      active,
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count.id])),
      byTier: Object.fromEntries(byTier.map((t) => [t.tier, t._count.id])),
      failing,
    };
  } catch (error) {
    return {
      total: config.rssFeeds.length,
      active: config.rssFeeds.length,
      byType: { NATIONAL: config.rssFeeds.length },
      byTier: { 1: config.rssFeeds.length },
      failing: 0,
    };
  }
}
