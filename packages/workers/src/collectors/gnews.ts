import Parser from "rss-parser";
import type { NormalizedArticle } from "@mediabot/shared";
import { prisma } from "@mediabot/shared";

// Configuración del collector Google News RSS + Bing News RSS
const GNEWS_CONFIG = {
  baseUrl: "https://news.google.com/rss/search",
  bingBaseUrl: "https://www.bing.com/news/search",
  timeout: parseInt(process.env.GNEWS_TIMEOUT || "15000", 10),
  rateLimitMs: parseInt(process.env.GNEWS_RATE_LIMIT_MS || "500", 10),
  errorThreshold: parseInt(process.env.GNEWS_ERROR_THRESHOLD || "10", 10),
  userAgent: "Mozilla/5.0 (compatible; MediaBot/1.0)",
};

export const gnewsParser = new Parser({
  timeout: GNEWS_CONFIG.timeout,
  headers: {
    "User-Agent": GNEWS_CONFIG.userAgent,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

// Alias interno para compatibilidad
const parser = gnewsParser;

/**
 * Extrae la URL real del redirect de Google News.
 * Google News envuelve las URLs en su propio dominio.
 */
export function extractRealUrl(googleUrl: string): string {
  try {
    const url = new URL(googleUrl);

    // Formato nuevo: https://news.google.com/rss/articles/...?url=https://...
    const articleUrl = url.searchParams.get("url");
    if (articleUrl) return articleUrl;

    // Intentar decodificar base64 del path si existe
    // Formato: /rss/articles/CBMi...
    const pathMatch = googleUrl.match(/\/articles\/([^?]+)/);
    if (pathMatch) {
      try {
        // Google usa base64url encoding
        const encoded = pathMatch[1];
        // El contenido base64 puede tener un prefijo que indica el tipo
        // Intentamos extraer la URL directamente
        const decoded = Buffer.from(encoded, "base64url").toString("utf-8");
        // Buscar URL en el contenido decodificado
        const urlMatch = decoded.match(/https?:\/\/[^\s"'<>]+/);
        if (urlMatch) return urlMatch[0];
      } catch {
        // Si falla el decode, intentar con base64 normal
        try {
          const decoded = Buffer.from(pathMatch[1], "base64").toString("utf-8");
          const urlMatch = decoded.match(/https?:\/\/[^\s"'<>]+/);
          if (urlMatch) return urlMatch[0];
        } catch {
          // Ignorar errores de decodificación
        }
      }
    }
  } catch {
    // Ignorar errores de parsing
  }

  // Si no podemos extraer la URL real, devolver la original
  return googleUrl;
}

/**
 * Sigue el redirect de Google News para obtener la URL final.
 * Alternativa cuando extractRealUrl no funciona.
 */
export async function followRedirect(googleUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(googleUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": GNEWS_CONFIG.userAgent },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // La URL final después de seguir redirects
    return response.url || googleUrl;
  } catch {
    return googleUrl;
  }
}

/**
 * Obtiene la URL real de un artículo de Google News.
 * Primero intenta extraerla del URL, luego sigue el redirect si es necesario.
 */
export async function getRealArticleUrl(googleUrl: string): Promise<string> {
  // Primero intentar extraer sin hacer request
  const extracted = extractRealUrl(googleUrl);

  // Si la URL extraída sigue siendo de Google News, seguir el redirect
  if (extracted.includes("news.google.com")) {
    return followRedirect(googleUrl);
  }

  return extracted;
}

/**
 * Actualiza el estado de una fuente NoRssSource.
 */
async function updateSourceStatus(
  sourceId: string,
  success: boolean
): Promise<void> {
  try {
    if (success) {
      await prisma.noRssSource.update({
        where: { id: sourceId },
        data: {
          lastFetch: new Date(),
          errorCount: 0,
        },
      });
    } else {
      await prisma.noRssSource.update({
        where: { id: sourceId },
        data: {
          errorCount: { increment: 1 },
        },
      });
    }
  } catch {
    // Ignorar errores de actualización
  }
}

/**
 * Desactiva fuentes con demasiados errores consecutivos.
 */
async function deactivateFailingSources(): Promise<void> {
  try {
    const result = await prisma.noRssSource.updateMany({
      where: {
        errorCount: { gte: GNEWS_CONFIG.errorThreshold },
        active: true,
      },
      data: { active: false },
    });

    if (result.count > 0) {
      console.log(
        `⚠️ GNews: ${result.count} fuente(s) desactivada(s) por errores consecutivos`
      );
    }
  } catch {
    // Ignorar
  }
}

/**
 * Collector principal: obtiene artículos de fuentes sin RSS usando Google News RSS.
 *
 * Para cada dominio configurado en NoRssSource, consulta:
 * https://news.google.com/rss/search?q=site:{domain}&hl=es-419&gl=MX&ceid=MX:es-419
 *
 * Esto devuelve los artículos más recientes indexados por Google News para ese sitio.
 */
export async function collectGnews(): Promise<NormalizedArticle[]> {
  // Obtener fuentes activas sin RSS
  const sources = await prisma.noRssSource.findMany({
    where: { active: true },
    orderBy: [{ tier: "asc" }, { name: "asc" }],
  });

  if (sources.length === 0) {
    console.log("📰 GNews: No hay fuentes configuradas");
    return [];
  }

  console.log(`📰 GNews: Procesando ${sources.length} fuentes`);

  const articles: NormalizedArticle[] = [];
  let sourcesOk = 0;
  let totalItems = 0;
  let urlsResolved = 0;

  for (const source of sources) {
    try {
      // Construir URL de Google News RSS para el dominio
      const url = `${GNEWS_CONFIG.baseUrl}?q=site:${source.domain}&hl=es-419&gl=MX&ceid=MX:es-419`;

      const feed = await parser.parseURL(url);
      const items = feed.items || [];

      if (items.length === 0) {
        console.log(`  ⚠️ [${source.name}] Sin artículos en Google News`);
        // No contar como error, simplemente no hay noticias recientes
        await updateSourceStatus(source.id, true);
        sourcesOk++;
        continue;
      }

      for (const item of items) {
        if (!item.link || !item.title) continue;

        // Intentar extraer URL real del artículo (sin hacer requests HTTP)
        const realUrl = extractRealUrl(item.link);

        // Si pudimos extraer la URL real, verificar dominio
        // Si no, confiar en Google News (ya filtramos por site:domain)
        if (!realUrl.includes("news.google.com")) {
          try {
            const urlDomain = new URL(realUrl).hostname.replace("www.", "");
            const sourceDomain = source.domain.replace("www.", "");
            // Verificar que la URL pertenece al dominio esperado
            if (!urlDomain.includes(sourceDomain) && !sourceDomain.includes(urlDomain)) {
              continue; // URL de otro dominio, saltar
            }
          } catch {
            // URL inválida, usar la de Google
          }
          urlsResolved++;
        }

        // Usar URL real si la tenemos, sino la de Google News (sigue funcionando)
        const finalUrl = realUrl.includes("news.google.com") ? item.link : realUrl;

        articles.push({
          url: finalUrl,
          title: item.title,
          source: source.name,
          content: item.contentSnippet || undefined,
          publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        });
        totalItems++;
      }

      // Actualizar estado exitoso
      await updateSourceStatus(source.id, true);
      sourcesOk++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ [${source.name}]: ${msg.slice(0, 80)}`);
      await updateSourceStatus(source.id, false);
    }

    // Rate limiting entre fuentes
    await new Promise((resolve) =>
      setTimeout(resolve, GNEWS_CONFIG.rateLimitMs)
    );
  }

  // Desactivar fuentes que fallan repetidamente
  await deactivateFailingSources();

  console.log(
    `📰 GNews: ${sourcesOk}/${sources.length} fuentes OK, ${totalItems} artículos (${urlsResolved} URLs resueltas)`
  );

  return articles;
}

/**
 * Extrae la URL real del wrapper de redirect de Bing News.
 * Bing envuelve URLs en: http://www.bing.com/news/apiclick.aspx?...&url=https%3a%2f%2f...
 */
export function extractBingRealUrl(bingUrl: string): string {
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
 * Busca artículos en Bing News RSS para un término dado.
 * https://www.bing.com/news/search?q="term"&format=rss
 */
async function searchBingNewsRss(
  term: string
): Promise<NormalizedArticle[]> {
  const query = encodeURIComponent(`"${term}"`);
  const url = `${GNEWS_CONFIG.bingBaseUrl}?q=${query}&format=rss`;

  const feed = await parser.parseURL(url);
  const items = feed.items || [];

  const results: NormalizedArticle[] = [];
  for (const item of items) {
    if (!item.link || !item.title) continue;

    const realUrl = extractBingRealUrl(item.link);
    // Extraer source del dominio de la URL real
    let source = "Bing News";
    try {
      source = new URL(realUrl).hostname.replace(/^www\./, "");
    } catch { /* ignorar */ }

    results.push({
      url: realUrl,
      title: item.title,
      source,
      content: item.contentSnippet || undefined,
      publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
    });
  }

  return results;
}

/**
 * Collector por nombre de cliente: busca en Google News RSS + Bing News RSS
 * artículos que mencionen a cada cliente activo por su nombre y keywords.
 *
 * Los artículos pasan por el pipeline normal de ingest (dedup, keyword match, pre-filtro, análisis).
 */
export async function collectGnewsByClient(): Promise<NormalizedArticle[]> {
  // Obtener clientes activos con sus keywords
  const clients = await prisma.client.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      keywords: {
        where: { active: true },
        select: { word: true },
      },
    },
  });

  if (clients.length === 0) {
    console.log("🔍 GNews Client Search: No hay clientes activos");
    return [];
  }

  console.log(`🔍 GNews Client Search: Buscando noticias para ${clients.length} clientes`);

  const articles: NormalizedArticle[] = [];
  let totalItems = 0;
  let clientsOk = 0;

  for (const client of clients) {
    // Construir queries de búsqueda: nombre del cliente + keywords relevantes
    const searchTerms = new Set<string>();
    searchTerms.add(client.name);

    // Agregar keywords que no sean genéricos (evitar keywords de 1 palabra muy comunes)
    for (const kw of client.keywords) {
      if (kw.word.length > 3 && kw.word !== client.name) {
        searchTerms.add(kw.word);
      }
    }

    for (const term of searchTerms) {
      try {
        // Buscar en Google News + Bing News en paralelo
        const [gResult, bResult] = await Promise.allSettled([
          (async () => {
            const query = encodeURIComponent(`"${term}"`);
            const url = `${GNEWS_CONFIG.baseUrl}?q=${query}&hl=es-419&gl=MX&ceid=MX:es-419`;
            const feed = await parser.parseURL(url);
            const items = feed.items || [];
            const results: NormalizedArticle[] = [];
            for (const item of items) {
              if (!item.link || !item.title) continue;
              const realUrl = await getRealArticleUrl(item.link);
              results.push({
                url: realUrl,
                title: item.title,
                source: item.creator || extractSourceFromTitle(item.title),
                content: item.contentSnippet || undefined,
                publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
              });
            }
            return results;
          })(),
          searchBingNewsRss(term),
        ]);

        if (gResult.status === "fulfilled" && gResult.value.length > 0) {
          articles.push(...gResult.value);
          totalItems += gResult.value.length;
          clientsOk++;
        }
        if (bResult.status === "fulfilled" && bResult.value.length > 0) {
          articles.push(...bResult.value);
          totalItems += bResult.value.length;
        }

        if (gResult.status === "rejected") {
          console.warn(`  ⚠️ Google News [${client.name}] "${term}": ${String(gResult.reason).slice(0, 80)}`);
        }
        if (bResult.status === "rejected") {
          console.warn(`  ⚠️ Bing News [${client.name}] "${term}": ${String(bResult.reason).slice(0, 80)}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Client Search [${client.name}] "${term}": ${msg.slice(0, 80)}`);
      }

      // Rate limiting entre búsquedas
      await new Promise((resolve) =>
        setTimeout(resolve, GNEWS_CONFIG.rateLimitMs)
      );
    }
  }

  console.log(
    `🔍 Client News Search: ${clientsOk} búsquedas exitosas, ${totalItems} artículos encontrados (Google + Bing)`
  );

  return articles;
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
 * Obtiene estadísticas de las fuentes NoRssSource (Google News).
 */
export async function getGnewsStats(): Promise<{
  total: number;
  active: number;
  byType: Record<string, number>;
  byTier: Record<number, number>;
  failing: number;
}> {
  try {
    const [total, active, byType, byTier, failing] = await Promise.all([
      prisma.noRssSource.count(),
      prisma.noRssSource.count({ where: { active: true } }),
      prisma.noRssSource.groupBy({
        by: ["type"],
        _count: { id: true },
      }),
      prisma.noRssSource.groupBy({
        by: ["tier"],
        _count: { id: true },
      }),
      prisma.noRssSource.count({ where: { errorCount: { gte: 3 } } }),
    ]);

    return {
      total,
      active,
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count.id])),
      byTier: Object.fromEntries(byTier.map((t) => [t.tier, t._count.id])),
      failing,
    };
  } catch {
    return {
      total: 0,
      active: 0,
      byType: {},
      byTier: {},
      failing: 0,
    };
  }
}
