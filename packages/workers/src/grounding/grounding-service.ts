/**
 * Servicio de grounding con Gemini.
 * Busca noticias en internet usando Google Search grounding.
 */
import { prisma, config } from "@mediabot/shared";
import { GoogleGenerativeAI, GenerateContentResult } from "@google/generative-ai";

/**
 * Estructura de un chunk de grounding (URL real de Google Search).
 */
interface GroundingChunk {
  web?: {
    uri: string;
    title?: string;
  };
}

/**
 * Extrae URLs reales del groundingMetadata del response de Gemini.
 * Estos son los URLs que Google Search realmente encontró.
 */
function extractGroundingUrls(result: GenerateContentResult): GroundingChunk[] {
  try {
    // Acceder al candidato y su metadata de grounding
    const candidate = result.response.candidates?.[0];
    if (!candidate) return [];

    // El groundingMetadata contiene los chunks con URLs reales
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (candidate as any).groundingMetadata;
    if (!metadata?.groundingChunks) return [];

    return metadata.groundingChunks as GroundingChunk[];
  } catch (error) {
    console.warn("[Grounding] Error extracting grounding URLs:", error);
    return [];
  }
}

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
 * Detecta si un URL es un redirect temporal de Google Vertex AI Search.
 */
function isVertexRedirectUrl(url: string): boolean {
  return url.includes("vertexaisearch.cloud.google.com/grounding-api-redirect");
}

/**
 * Valida que un URL exista y responda correctamente.
 * Retorna el URL final (después de redirects) o null si no es válido.
 */
async function validateAndResolveUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    const finalUrl = response.url;

    // Rechazar URLs de Vertex AI redirect
    if (isVertexRedirectUrl(finalUrl)) {
      console.warn(`[Grounding] URL points to Vertex redirect: ${finalUrl.slice(0, 60)}...`);
      return null;
    }

    // Verificar que responda 200 OK (o 2xx)
    if (!response.ok) {
      console.warn(`[Grounding] URL returned ${response.status}: ${finalUrl.slice(0, 80)}...`);
      return null;
    }

    // Si el URL cambió (redirect), loguear
    if (finalUrl !== url) {
      console.log(`[Grounding] Resolved redirect -> ${finalUrl.slice(0, 80)}...`);
    }

    return finalUrl;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Grounding] URL validation failed: ${msg} - ${url.slice(0, 60)}...`);
    return null;
  }
}

/**
 * Ejecuta una búsqueda de grounding con Gemini.
 * Busca noticias en internet y crea artículos/menciones en la base de datos.
 */
export async function executeGroundingSearch(
  params: GroundingParams
): Promise<GroundingResult> {
  const { clientId, clientName, industry, days, articleCount, trigger } = params;
  const executedAt = new Date();

  console.log(
    `[Grounding] Starting search for "${clientName}" (${trigger}): ${articleCount} articles, last ${days} days`
  );

  if (!config.google.apiKey) {
    console.warn("[Grounding] GOOGLE_API_KEY not configured");
    return {
      success: false,
      articles: [],
      articlesFound: 0,
      mentionsCreated: 0,
      trigger,
      error: "GOOGLE_API_KEY no configurada",
      executedAt,
    };
  }

  const foundArticles: GroundingArticle[] = [];
  // Fecha mínima aceptable para el período solicitado
  const minAcceptableDate = subDays(new Date(), days);

  try {
    const genAI = new GoogleGenerativeAI(config.google.apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    });

    const industryContext = industry ? ` relacionadas con ${industry}` : "";
    const prompt = `Eres un investigador de medios. Busca entre ${articleCount} y ${articleCount + 10} noticias recientes sobre "${clientName}"${industryContext}.

CRITERIOS DE BÚSQUEDA:
- Noticias de los últimos ${days} días
- Fuentes: periódicos mexicanos (El Universal, Milenio, Reforma, Excélsior, La Jornada, El Financiero, Forbes México, Expansión), agencias internacionales (Reuters, AFP, EFE), y medios digitales
- Incluir menciones directas e indirectas (competidores, industria, ejecutivos)
- Priorizar noticias con impacto mediático

Responde en formato JSON:
{
  "articles": [
    {
      "title": "título completo de la noticia",
      "source": "nombre del medio",
      "url": "URL completa y funcional del artículo",
      "snippet": "resumen de 2-3 oraciones del contenido",
      "date": "YYYY-MM-DD"
    }
  ]
}

REGLAS:
- Mínimo ${articleCount} artículos, máximo ${articleCount + 10}
- URLs deben ser reales y accesibles
- No inventar noticias - solo incluir las que realmente existen
- Si hay pocas noticias directas, incluir noticias relacionadas con la industria o competidores
- Responde SOLO con el JSON, sin explicaciones`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }] as unknown as import("@google/generative-ai").Tool[],
    });

    const response = result.response;
    const text = response.text();

    // PRIMERO: Extraer URLs reales del groundingMetadata (fuente confiable)
    const rawChunks = extractGroundingUrls(result);

    // Deduplicar chunks por URL antes de procesar
    const seenUrls = new Set<string>();
    const groundingChunks = rawChunks.filter((chunk) => {
      if (!chunk.web?.uri) return false;
      const url = chunk.web.uri.split("?")[0]; // Normalizar quitando query params
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });

    console.log(`[Grounding] Found ${rawChunks.length} URLs in groundingMetadata, ${groundingChunks.length} unique`);

    // Extraer JSON de la respuesta para títulos/snippets/fechas
    const jsonMatch = text.match(/\{[\s\S]*"articles"[\s\S]*\}/);
    let parsedArticles: Array<{
      title: string;
      source: string;
      url: string;
      snippet?: string;
      date?: string;
    }> = [];

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        parsedArticles = parsed.articles || [];
        console.log(`[Grounding] Gemini text contains ${parsedArticles.length} articles`);
      } catch (e) {
        console.warn("[Grounding] Failed to parse JSON from response text");
      }
    }

    // Procesar URLs del groundingMetadata (fuente principal)
    let skippedUrls = 0;
    let processedFromMetadata = 0;

    for (const chunk of groundingChunks) {
      if (!chunk.web?.uri) continue;

      const url = chunk.web.uri;

      // Validar que el URL existe y responde 200
      const finalUrl = await validateAndResolveUrl(url);
      if (!finalUrl) {
        skippedUrls++;
        continue;
      }

      // Verificar duplicados
      if (foundArticles.some((a) => a.url === finalUrl)) continue;

      // Extraer dominio como source
      let source = chunk.web.title || "Web";
      try {
        const urlObj = new URL(finalUrl);
        source = urlObj.hostname.replace("www.", "");
      } catch {
        // Mantener el title del chunk
      }

      // Buscar info adicional en el JSON de Gemini (título, snippet, fecha)
      // Intentar matchear por dominio ya que los URLs de Gemini son inventados
      const domain = source.toLowerCase();
      const matchingArticle = parsedArticles.find((a) => {
        try {
          const articleDomain = new URL(a.url).hostname.replace("www.", "").toLowerCase();
          return articleDomain === domain;
        } catch {
          return false;
        }
      });

      // Usar info del JSON si existe, si no usar defaults
      const title = matchingArticle?.title || chunk.web.title || `Artículo de ${source}`;
      const snippet = matchingArticle?.snippet;

      // Parsear fecha si existe en el JSON
      let publishedAt: Date | undefined;
      if (matchingArticle?.date) {
        const parsedDate = new Date(matchingArticle.date);
        if (!isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate;
        }
      }

      // Crear o encontrar el artículo en la base de datos
      let article = await prisma.article.findFirst({
        where: { url: finalUrl },
      });

      if (!article) {
        article = await prisma.article.create({
          data: {
            url: finalUrl,
            title,
            source,
            content: snippet || null,
            publishedAt: publishedAt || null,
          },
        });
      }

      // Marcar como histórico si la fecha está fuera del período solicitado
      const isHistorical = publishedAt ? publishedAt < minAcceptableDate : false;

      foundArticles.push({
        id: article.id,
        title,
        source,
        url: finalUrl,
        snippet,
        publishedAt,
        isHistorical,
      });
      processedFromMetadata++;
    }

    console.log(`[Grounding] Processed ${processedFromMetadata} articles from groundingMetadata`);
    if (skippedUrls > 0) {
      console.log(`[Grounding] Skipped ${skippedUrls} articles with invalid/unreachable URLs`);
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
      take: Math.max(0, articleCount - foundArticles.length),
    });

    // Agregar artículos de DB (estos ya están filtrados por fecha, no son históricos)
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

    // Log informativo de artículos históricos
    const historicalCount = foundArticles.filter((a) => a.isHistorical).length;
    if (historicalCount > 0) {
      console.log(
        `[Grounding] ${historicalCount} of ${foundArticles.length} articles are historical (outside ${days}-day period)`
      );
    }

    // Crear menciones para el cliente
    let mentionsCreated = 0;
    for (const article of foundArticles) {
      try {
        // Verificar si ya existe la mención
        const existing = await prisma.mention.findFirst({
          where: { articleId: article.id, clientId },
        });

        if (!existing) {
          await prisma.mention.create({
            data: {
              articleId: article.id,
              clientId,
              keywordMatched: clientName,
              snippet: article.snippet || null,
              sentiment: "NEUTRAL",
              relevance: 6,
            },
          });
          mentionsCreated++;
        }
      } catch (err) {
        // Ignorar errores de duplicados
        console.warn(`[Grounding] Error creating mention for article ${article.id}:`, err);
      }
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
      `[Grounding] Completed for "${clientName}": ${foundArticles.length} articles, ${mentionsCreated} new mentions`
    );

    return groundingResult;
  } catch (error) {
    console.error("[Grounding] Search error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";

    // Actualizar cliente con error
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

  // Verificar cada día hacia atrás
  for (let i = 0; i < consecutiveDays; i++) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const count = await prisma.mention.count({
      where: {
        clientId,
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    // Si algún día tiene suficientes menciones, no hay problema
    if (count >= minDailyMentions) {
      return false;
    }
  }

  // Todos los días tuvieron pocas menciones
  return true;
}
