/**
 * Script de Diagnóstico de Fuentes RSS
 *
 * Lee TODAS las fuentes de RssSource (activas e inactivas),
 * hace HEAD/GET request a cada URL, clasifica errores y genera reporte.
 *
 * Uso:
 *   npx tsx scripts/diagnose-rss-sources.ts
 *   npx tsx scripts/diagnose-rss-sources.ts --output=json
 *   npx tsx scripts/diagnose-rss-sources.ts --state="Nuevo León"
 */

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const prisma = new PrismaClient();

// Configuración
const CONFIG = {
  timeout: 15000, // 15 segundos
  maxRedirects: 5,
  concurrency: 10, // Requests simultáneos
  userAgent: "Mozilla/5.0 (compatible; MediaBot/1.0; RSS Diagnostic)",
  rssContentTypes: [
    "application/rss+xml",
    "application/xml",
    "text/xml",
    "application/atom+xml",
    "application/rdf+xml",
  ],
};

// Tipos
type DiagnosisStatus =
  | "OK"
  | "REDIRECT"
  | "NOT_FOUND"
  | "HTML_NOT_RSS"
  | "TIMEOUT"
  | "DNS_ERROR"
  | "CONNECTION_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

interface SourceDiagnosis {
  id: string;
  name: string;
  url: string;
  state: string | null;
  active: boolean;
  errorCount: number;
  status: DiagnosisStatus;
  httpCode: number | null;
  finalUrl: string | null;
  contentType: string | null;
  isRssFeed: boolean;
  redirectChain: string[];
  errorMessage: string | null;
  suggestedAction: "KEEP" | "UPDATE_URL" | "DELETE" | "REACTIVATE" | "INVESTIGATE";
  suggestedUrl: string | null;
  responseTimeMs: number | null;
}

interface DiagnosisReport {
  timestamp: string;
  totalSources: number;
  summary: {
    OK: number;
    REDIRECT: number;
    NOT_FOUND: number;
    HTML_NOT_RSS: number;
    TIMEOUT: number;
    DNS_ERROR: number;
    CONNECTION_ERROR: number;
    SERVER_ERROR: number;
    UNKNOWN: number;
  };
  byAction: {
    KEEP: number;
    UPDATE_URL: number;
    DELETE: number;
    REACTIVATE: number;
    INVESTIGATE: number;
  };
  byState: Record<string, { total: number; ok: number; failed: number }>;
  sources: SourceDiagnosis[];
}

/**
 * Verifica si el content-type indica un feed RSS/XML
 */
function isRssContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return CONFIG.rssContentTypes.some((t) => ct.includes(t));
}

/**
 * Verifica si el contenido parece ser RSS/XML válido
 */
function looksLikeRss(content: string): boolean {
  const trimmed = content.trim().substring(0, 500).toLowerCase();
  return (
    trimmed.includes("<?xml") ||
    trimmed.includes("<rss") ||
    trimmed.includes("<feed") ||
    trimmed.includes("<rdf")
  );
}

/**
 * Busca feeds alternativos en una página HTML
 */
function findAlternativeFeeds(html: string, baseUrl: string): string[] {
  const feeds: string[] = [];

  // Buscar <link rel="alternate" type="application/rss+xml">
  const linkRegex = /<link[^>]+rel=["']alternate["'][^>]+>/gi;
  const matches = html.match(linkRegex) || [];

  for (const match of matches) {
    const typeMatch = match.match(/type=["']([^"']+)["']/i);
    const hrefMatch = match.match(/href=["']([^"']+)["']/i);

    if (
      typeMatch &&
      hrefMatch &&
      (typeMatch[1].includes("rss") || typeMatch[1].includes("atom"))
    ) {
      let feedUrl = hrefMatch[1];
      // Resolver URLs relativas
      if (feedUrl.startsWith("/")) {
        const base = new URL(baseUrl);
        feedUrl = `${base.protocol}//${base.host}${feedUrl}`;
      }
      feeds.push(feedUrl);
    }
  }

  // Buscar patrones comunes de RSS
  const base = new URL(baseUrl);
  const commonPaths = ["/feed", "/feed/", "/rss", "/rss.xml", "/feed.xml", "/atom.xml"];
  for (const feedPath of commonPaths) {
    feeds.push(`${base.protocol}//${base.host}${feedPath}`);
  }

  return Array.from(new Set(feeds)); // Eliminar duplicados
}

/**
 * Realiza el diagnóstico de una fuente RSS
 */
async function diagnoseSource(source: {
  id: string;
  name: string;
  url: string;
  state: string | null;
  active: boolean;
  errorCount: number;
}): Promise<SourceDiagnosis> {
  const diagnosis: SourceDiagnosis = {
    id: source.id,
    name: source.name,
    url: source.url,
    state: source.state,
    active: source.active,
    errorCount: source.errorCount,
    status: "UNKNOWN",
    httpCode: null,
    finalUrl: null,
    contentType: null,
    isRssFeed: false,
    redirectChain: [],
    errorMessage: null,
    suggestedAction: "INVESTIGATE",
    suggestedUrl: null,
    responseTimeMs: null,
  };

  const startTime = Date.now();
  let currentUrl = source.url;
  let redirectCount = 0;

  try {
    // Seguir redirects manualmente para capturar la cadena
    while (redirectCount < CONFIG.maxRedirects) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

      const response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": CONFIG.userAgent,
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      diagnosis.httpCode = response.status;
      diagnosis.contentType = response.headers.get("content-type");
      diagnosis.responseTimeMs = Date.now() - startTime;

      // Manejar redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (location) {
          diagnosis.redirectChain.push(currentUrl);
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

      diagnosis.finalUrl = currentUrl !== source.url ? currentUrl : null;

      // Analizar respuesta
      if (response.status === 200) {
        const content = await response.text();

        // Verificar si es RSS válido
        if (isRssContentType(diagnosis.contentType) || looksLikeRss(content)) {
          diagnosis.status = diagnosis.redirectChain.length > 0 ? "REDIRECT" : "OK";
          diagnosis.isRssFeed = true;

          if (diagnosis.redirectChain.length > 0) {
            diagnosis.suggestedAction = "UPDATE_URL";
            diagnosis.suggestedUrl = currentUrl;
          } else if (!source.active && source.errorCount > 0) {
            diagnosis.suggestedAction = "REACTIVATE";
          } else {
            diagnosis.suggestedAction = "KEEP";
          }
        } else {
          // Es HTML, no RSS
          diagnosis.status = "HTML_NOT_RSS";
          diagnosis.isRssFeed = false;

          // Buscar feeds alternativos en el HTML
          const alternatives = findAlternativeFeeds(content, currentUrl);
          if (alternatives.length > 0) {
            diagnosis.suggestedUrl = alternatives[0];
            diagnosis.suggestedAction = "UPDATE_URL";
            diagnosis.errorMessage = `Found ${alternatives.length} potential feeds: ${alternatives.slice(0, 3).join(", ")}`;
          } else {
            diagnosis.suggestedAction = "DELETE";
            diagnosis.errorMessage = "URL returns HTML, no RSS feed found";
          }
        }
      } else if (response.status === 404) {
        diagnosis.status = "NOT_FOUND";
        diagnosis.suggestedAction = "DELETE";
        diagnosis.errorMessage = "Feed not found (404)";
      } else if (response.status >= 500) {
        diagnosis.status = "SERVER_ERROR";
        diagnosis.suggestedAction = "INVESTIGATE";
        diagnosis.errorMessage = `Server error: ${response.status}`;
      } else {
        diagnosis.status = "UNKNOWN";
        diagnosis.errorMessage = `HTTP ${response.status}`;
      }

      break;
    }

    if (redirectCount >= CONFIG.maxRedirects) {
      diagnosis.status = "REDIRECT";
      diagnosis.suggestedAction = "INVESTIGATE";
      diagnosis.errorMessage = `Too many redirects (${redirectCount})`;
    }
  } catch (error) {
    diagnosis.responseTimeMs = Date.now() - startTime;

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      if (msg.includes("abort") || msg.includes("timeout")) {
        diagnosis.status = "TIMEOUT";
        diagnosis.errorMessage = "Request timeout";
        diagnosis.suggestedAction = "INVESTIGATE";
      } else if (
        msg.includes("getaddrinfo") ||
        msg.includes("dns") ||
        msg.includes("enotfound")
      ) {
        diagnosis.status = "DNS_ERROR";
        diagnosis.errorMessage = "DNS resolution failed";
        diagnosis.suggestedAction = "DELETE";
      } else if (
        msg.includes("econnrefused") ||
        msg.includes("econnreset") ||
        msg.includes("network")
      ) {
        diagnosis.status = "CONNECTION_ERROR";
        diagnosis.errorMessage = error.message;
        diagnosis.suggestedAction = "INVESTIGATE";
      } else {
        diagnosis.status = "UNKNOWN";
        diagnosis.errorMessage = error.message;
        diagnosis.suggestedAction = "INVESTIGATE";
      }
    }
  }

  return diagnosis;
}

/**
 * Procesa fuentes en paralelo con límite de concurrencia
 */
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      const result = await processor(item, currentIndex);
      results[currentIndex] = result;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);

  return results;
}

/**
 * Función principal
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputFormat = args.find((a) => a.startsWith("--output="))?.split("=")[1] || "console";
  const filterState = args.find((a) => a.startsWith("--state="))?.split("=")[1];

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        Diagnóstico de Fuentes RSS - MediaBot               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Obtener todas las fuentes
  const whereClause = filterState ? { state: filterState } : {};
  const sources = await prisma.rssSource.findMany({
    where: whereClause,
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });

  console.log(`📊 Fuentes encontradas: ${sources.length}`);
  if (filterState) {
    console.log(`🔍 Filtro aplicado: state = "${filterState}"`);
  }
  console.log(`⚙️  Concurrencia: ${CONFIG.concurrency} requests simultáneos`);
  console.log(`⏱️  Timeout: ${CONFIG.timeout / 1000} segundos\n`);

  // Diagnosticar todas las fuentes
  console.log("🔄 Iniciando diagnóstico...\n");

  let processed = 0;
  const diagnoses = await processInBatches(
    sources,
    async (source, i) => {
      const result = await diagnoseSource(source);
      processed++;
      const statusIcon =
        result.status === "OK"
          ? "✅"
          : result.status === "REDIRECT"
            ? "↪️"
            : result.status === "NOT_FOUND"
              ? "🔴"
              : result.status === "HTML_NOT_RSS"
                ? "📄"
                : result.status === "TIMEOUT"
                  ? "⏱️"
                  : "❓";

      console.log(
        `[${processed}/${sources.length}] ${statusIcon} ${source.name.substring(0, 30).padEnd(30)} | ${result.status.padEnd(15)} | ${result.httpCode || "---"}`
      );
      return result;
    },
    CONFIG.concurrency
  );

  // Generar reporte
  const report: DiagnosisReport = {
    timestamp: new Date().toISOString(),
    totalSources: sources.length,
    summary: {
      OK: 0,
      REDIRECT: 0,
      NOT_FOUND: 0,
      HTML_NOT_RSS: 0,
      TIMEOUT: 0,
      DNS_ERROR: 0,
      CONNECTION_ERROR: 0,
      SERVER_ERROR: 0,
      UNKNOWN: 0,
    },
    byAction: {
      KEEP: 0,
      UPDATE_URL: 0,
      DELETE: 0,
      REACTIVATE: 0,
      INVESTIGATE: 0,
    },
    byState: {},
    sources: diagnoses,
  };

  // Calcular resumen
  for (const d of diagnoses) {
    report.summary[d.status]++;
    report.byAction[d.suggestedAction]++;

    const state = d.state || "Nacional";
    if (!report.byState[state]) {
      report.byState[state] = { total: 0, ok: 0, failed: 0 };
    }
    report.byState[state].total++;
    if (d.status === "OK" || d.status === "REDIRECT") {
      report.byState[state].ok++;
    } else {
      report.byState[state].failed++;
    }
  }

  // Mostrar resumen
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    RESUMEN DEL DIAGNÓSTICO                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log("📊 Por Estado de Conexión:");
  console.log("┌─────────────────────┬─────────┐");
  console.log("│ Estado              │ Cantidad│");
  console.log("├─────────────────────┼─────────┤");
  for (const [status, count] of Object.entries(report.summary)) {
    if (count > 0) {
      console.log(`│ ${status.padEnd(19)} │ ${count.toString().padStart(7)} │`);
    }
  }
  console.log("└─────────────────────┴─────────┘\n");

  console.log("🔧 Por Acción Sugerida:");
  console.log("┌─────────────────────┬─────────┐");
  console.log("│ Acción              │ Cantidad│");
  console.log("├─────────────────────┼─────────┤");
  for (const [action, count] of Object.entries(report.byAction)) {
    if (count > 0) {
      console.log(`│ ${action.padEnd(19)} │ ${count.toString().padStart(7)} │`);
    }
  }
  console.log("└─────────────────────┴─────────┘\n");

  console.log("🗺️  Por Estado/Región:");
  console.log("┌────────────────────────────┬───────┬─────┬────────┐");
  console.log("│ Estado                     │ Total │ OK  │ Failed │");
  console.log("├────────────────────────────┼───────┼─────┼────────┤");
  for (const [state, stats] of Object.entries(report.byState).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(
      `│ ${state.substring(0, 26).padEnd(26)} │ ${stats.total.toString().padStart(5)} │ ${stats.ok.toString().padStart(3)} │ ${stats.failed.toString().padStart(6)} │`
    );
  }
  console.log("└────────────────────────────┴───────┴─────┴────────┘\n");

  // Mostrar fuentes que necesitan actualización de URL
  const needsUpdate = diagnoses.filter((d) => d.suggestedAction === "UPDATE_URL");
  if (needsUpdate.length > 0) {
    console.log("\n🔄 Fuentes que Requieren Actualización de URL:");
    console.log("─".repeat(80));
    for (const d of needsUpdate.slice(0, 20)) {
      console.log(`\n  ${d.name} (${d.state || "Nacional"})`);
      console.log(`    Actual:   ${d.url}`);
      console.log(`    Sugerida: ${d.suggestedUrl}`);
    }
    if (needsUpdate.length > 20) {
      console.log(`\n  ... y ${needsUpdate.length - 20} más`);
    }
  }

  // Guardar reporte
  const dateStr = new Date().toISOString().split("T")[0];
  const outputDir = path.join(__dirname, "..", "docs", "reports");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // JSON completo
  const jsonPath = path.join(outputDir, `rss-diagnosis-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n📁 Reporte JSON guardado: ${jsonPath}`);

  // CSV para análisis
  const csvPath = path.join(outputDir, `rss-diagnosis-${dateStr}.csv`);
  const csvHeader =
    "id,name,state,url,active,errorCount,status,httpCode,suggestedAction,suggestedUrl,errorMessage\n";
  const csvRows = diagnoses
    .map(
      (d) =>
        `"${d.id}","${d.name}","${d.state || ""}","${d.url}",${d.active},${d.errorCount},"${d.status}",${d.httpCode || ""},"${d.suggestedAction}","${d.suggestedUrl || ""}","${d.errorMessage || ""}"`
    )
    .join("\n");
  fs.writeFileSync(csvPath, csvHeader + csvRows);
  console.log(`📁 Reporte CSV guardado: ${csvPath}`);

  // Cerrar conexión
  await prisma.$disconnect();

  console.log("\n✅ Diagnóstico completado");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
