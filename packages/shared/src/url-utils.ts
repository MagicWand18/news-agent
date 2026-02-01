/**
 * Utilidades robustas para manejo de URLs en búsqueda de noticias.
 * Normalización, validación, deduplicación y extracción de títulos.
 */

// Parámetros de tracking comunes a eliminar
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "ref",
  "source",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "yclid",
  "twclid",
  "igshid",
]);

// Sufijos comunes de sitios a limpiar de títulos
const SITE_SUFFIXES = [
  " | El Universal",
  " - El Universal",
  " | Milenio",
  " - Milenio",
  " | La Jornada",
  " - La Jornada",
  " | Excélsior",
  " - Excélsior",
  " | El Financiero",
  " - El Financiero",
  " | Forbes México",
  " - Forbes México",
  " | Expansión",
  " - Expansión",
  " | Reuters",
  " - Reuters",
  " | BBC",
  " - BBC",
  " | CNN",
  " - CNN",
  " - YouTube",
  " | YouTube",
];

// Patrones de soft 404 (páginas de error disfrazadas)
const SOFT_404_PATTERNS = [
  /página\s+no\s+encontrada/i,
  /page\s+not\s+found/i,
  /404\s*[-–—]\s*not\s+found/i,
  /error\s+404/i,
  /no\s+existe/i,
  /contenido\s+no\s+disponible/i,
  /artículo\s+no\s+encontrado/i,
  /lo\s+sentimos.*no.*encontramos/i,
  /this\s+page\s+doesn't\s+exist/i,
  /página\s+eliminada/i,
  /contenido\s+expirado/i,
];

/**
 * Resultado de validación de URL.
 */
export interface UrlValidationResult {
  valid: boolean;
  finalUrl: string | null;
  statusCode?: number;
  error?: string;
  isRedirect?: boolean;
  isVertexRedirect?: boolean;
  isSoft404?: boolean;
}

/**
 * Opciones para validación de URL.
 */
export interface ValidationOptions {
  /** Número de reintentos (default: 2) */
  retries?: number;
  /** Timeout en milisegundos (default: 10000) */
  timeout?: number;
  /** Detectar soft 404s leyendo el contenido (default: true) */
  detectSoft404?: boolean;
  /** User-Agent personalizado */
  userAgent?: string;
}

/**
 * Resultado de extracción de título.
 */
export interface TitleExtractionResult {
  title: string;
  source: "og:title" | "title" | "h1" | "meta-description" | "fallback";
  isGeneric: boolean;
}

/**
 * Normaliza una URL para comparación y deduplicación.
 *
 * - Convierte a HTTPS
 * - Remueve www
 * - Remueve trailing slash
 * - Remueve fragmentos (#)
 * - Remueve parámetros de tracking (utm_*, fbclid, gclid, etc.)
 * - Lowercase en hostname
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Convertir HTTP a HTTPS
    if (urlObj.protocol === "http:") {
      urlObj.protocol = "https:";
    }

    // Remover www del hostname y hacer lowercase
    urlObj.hostname = urlObj.hostname.replace(/^www\./i, "").toLowerCase();

    // Remover fragmentos
    urlObj.hash = "";

    // Remover parámetros de tracking
    const paramsToDelete: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((key) => urlObj.searchParams.delete(key));

    // Reconstruir URL
    let normalized = urlObj.toString();

    // Remover trailing slash (excepto si es solo el dominio)
    if (normalized.endsWith("/") && urlObj.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    // Si no es una URL válida, retornar original
    return url;
  }
}

/**
 * Detecta si un URL es un redirect temporal de Google Vertex AI Search.
 */
export function isVertexRedirectUrl(url: string): boolean {
  return url.includes("vertexaisearch.cloud.google.com/grounding-api-redirect");
}

/**
 * Decodifica entidades HTML comunes.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Detecta si una página es un soft 404 (página de error disfrazada).
 */
export function isSoft404(html: string, statusCode: number): boolean {
  // Si el status no es 200, no es un soft 404 (es un 404 real)
  if (statusCode !== 200) return false;

  // Buscar patrones comunes de error en el HTML
  const lowerHtml = html.toLowerCase();

  for (const pattern of SOFT_404_PATTERNS) {
    if (pattern.test(lowerHtml)) {
      return true;
    }
  }

  // Detectar títulos genéricos de error
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    if (
      title.includes("404") ||
      title.includes("not found") ||
      title.includes("error") ||
      title.includes("página no encontrada")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Limpia un título removiendo sufijos de sitios.
 */
function cleanTitle(title: string): string {
  let cleaned = decodeHtmlEntities(title).trim();

  // Remover sufijos de sitios
  for (const suffix of SITE_SUFFIXES) {
    if (cleaned.toLowerCase().endsWith(suffix.toLowerCase())) {
      cleaned = cleaned.slice(0, -suffix.length).trim();
      break;
    }
  }

  // Patrón genérico para sufijos tipo " - Sitio" o " | Sitio"
  cleaned = cleaned.replace(/\s*[-|–—]\s*[^-|–—]{0,40}$/, "").trim();

  return cleaned;
}

/**
 * Extrae el título de una página HTML con múltiples estrategias.
 *
 * Prioridad: og:title > title > h1 > meta-description > fallback
 */
export function extractTitle(html: string, fallbackDomain: string): TitleExtractionResult {
  const genericTitle = `Artículo de ${fallbackDomain}`;

  // 1. Intentar og:title (mejor para noticias/social)
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
  ) || html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i
  );
  if (ogMatch?.[1]) {
    const title = cleanTitle(ogMatch[1]);
    if (title.length > 10) {
      return { title, source: "og:title", isGeneric: false };
    }
  }

  // 2. Intentar <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = cleanTitle(titleMatch[1]);
    if (title.length > 10 && !title.toLowerCase().includes("404")) {
      return { title, source: "title", isGeneric: false };
    }
  }

  // 3. Intentar <h1>
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match?.[1]) {
    const title = cleanTitle(h1Match[1]);
    if (title.length > 10) {
      return { title, source: "h1", isGeneric: false };
    }
  }

  // 4. Intentar meta description
  const descMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  ) || html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
  );
  if (descMatch?.[1]) {
    const desc = decodeHtmlEntities(descMatch[1]).trim();
    if (desc.length > 20 && desc.length <= 150) {
      return { title: desc, source: "meta-description", isGeneric: false };
    }
  }

  // 5. Fallback
  return { title: genericTitle, source: "fallback", isGeneric: true };
}

/**
 * Valida que un URL exista y responda correctamente con retry y fallback.
 * Retorna información detallada sobre el resultado.
 */
export async function validateUrl(
  url: string,
  options: ValidationOptions = {}
): Promise<UrlValidationResult> {
  const {
    retries = 2,
    timeout = 10000,
    detectSoft404 = true,
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  } = options;

  const headers = {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  // Función de espera para backoff exponencial
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Intentar primero con HEAD, luego con GET si falla
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Backoff exponencial: 1s, 2s, 4s...
      await wait(Math.pow(2, attempt - 1) * 1000);
    }

    try {
      // Intentar HEAD primero (más rápido)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      // Si HEAD falla con 405 Method Not Allowed o similar, intentar GET
      if (!response.ok && (response.status === 405 || response.status === 403)) {
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), timeout);

        response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: getController.signal,
          headers,
        });

        clearTimeout(getTimeoutId);
      }

      const finalUrl = response.url;

      // Rechazar URLs de Vertex AI redirect
      if (isVertexRedirectUrl(finalUrl)) {
        return {
          valid: false,
          finalUrl: null,
          statusCode: response.status,
          error: "Vertex AI redirect URL",
          isVertexRedirect: true,
        };
      }

      // Verificar status
      if (!response.ok) {
        // Reintentar solo en errores de servidor (5xx)
        if (response.status >= 500 && attempt < retries) {
          continue;
        }
        return {
          valid: false,
          finalUrl: null,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        };
      }

      // Detectar soft 404 si es necesario (requiere GET)
      if (detectSoft404 && response.headers.get("content-type")?.includes("text/html")) {
        try {
          const getController = new AbortController();
          const getTimeoutId = setTimeout(() => getController.abort(), timeout);

          const getResponse = await fetch(finalUrl, {
            method: "GET",
            signal: getController.signal,
            headers,
          });

          clearTimeout(getTimeoutId);

          if (getResponse.ok) {
            const html = await getResponse.text();
            if (isSoft404(html, getResponse.status)) {
              return {
                valid: false,
                finalUrl: null,
                statusCode: 200,
                error: "Soft 404 detected",
                isSoft404: true,
              };
            }
          }
        } catch {
          // Si falla la detección de soft 404, asumimos que está bien
        }
      }

      return {
        valid: true,
        finalUrl,
        statusCode: response.status,
        isRedirect: finalUrl !== url,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Reintentar en timeout o errores de red
      if (attempt < retries) {
        continue;
      }

      return {
        valid: false,
        finalUrl: null,
        error: msg,
      };
    }
  }

  return {
    valid: false,
    finalUrl: null,
    error: "Max retries exceeded",
  };
}

/**
 * Deduplica una lista de items basándose en URLs normalizadas.
 * Preserva el primer item encontrado para cada URL única.
 */
export function deduplicateUrls<T>(
  items: T[],
  getUrl: (item: T) => string
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const url = getUrl(item);
    const normalized = normalizeUrl(url);

    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(item);
    }
  }

  return result;
}

/**
 * Extrae el dominio de una URL para usarlo como source.
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./i, "");
  } catch {
    return "Web";
  }
}

/**
 * Valida y procesa una URL con obtención de título.
 * Combina validateUrl + extractTitle en una sola operación.
 */
export async function validateAndEnrichUrl(
  url: string,
  fallbackTitle?: string,
  options: ValidationOptions = {}
): Promise<{
  valid: boolean;
  finalUrl: string | null;
  title: string;
  source: string;
  isGenericTitle: boolean;
  error?: string;
}> {
  const validation = await validateUrl(url, options);

  if (!validation.valid || !validation.finalUrl) {
    const domain = extractDomain(url);
    return {
      valid: false,
      finalUrl: null,
      title: fallbackTitle || `Artículo de ${domain}`,
      source: domain,
      isGenericTitle: true,
      error: validation.error,
    };
  }

  const finalUrl = validation.finalUrl;
  const domain = extractDomain(finalUrl);

  // Obtener HTML para extraer título
  try {
    // Para YouTube, usar oEmbed API (más confiable)
    if (finalUrl.includes("youtube.com/watch") || finalUrl.includes("youtu.be/")) {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(finalUrl)}&format=json`;
      const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) });
      if (oembedRes.ok) {
        const data = (await oembedRes.json()) as { title?: string };
        if (data.title) {
          return {
            valid: true,
            finalUrl,
            title: data.title,
            source: domain,
            isGenericTitle: false,
          };
        }
      }
    }

    // Para otros sitios, extraer del HTML
    const pageRes = await fetch(finalUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": options.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (pageRes.ok) {
      const html = await pageRes.text();
      const titleResult = extractTitle(html, domain);

      // Si tenemos un fallbackTitle mejor que el genérico, usarlo
      if (titleResult.isGeneric && fallbackTitle && fallbackTitle.length > 15) {
        return {
          valid: true,
          finalUrl,
          title: fallbackTitle,
          source: domain,
          isGenericTitle: false,
        };
      }

      return {
        valid: true,
        finalUrl,
        title: titleResult.title,
        source: domain,
        isGenericTitle: titleResult.isGeneric,
      };
    }
  } catch (err) {
    // Si falla la obtención del título, usar fallback
  }

  return {
    valid: true,
    finalUrl,
    title: fallbackTitle || `Artículo de ${domain}`,
    source: domain,
    isGenericTitle: !fallbackTitle,
  };
}
