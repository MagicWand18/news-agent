/**
 * Script de Reparación Automática de Fuentes RSS
 *
 * Lee el reporte de diagnóstico y aplica reparaciones:
 * - Sigue redirects y actualiza URLs
 * - Busca feeds alternativos en páginas HTML
 * - Resetea errorCount y reactiva fuentes reparadas
 *
 * Uso:
 *   npx tsx scripts/repair-rss-sources.ts
 *   npx tsx scripts/repair-rss-sources.ts --dry-run
 *   npx tsx scripts/repair-rss-sources.ts --input=path/to/report.json
 *   npx tsx scripts/repair-rss-sources.ts --state="Nuevo León"
 */

import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const prisma = new PrismaClient();

// Configuración
const CONFIG = {
  timeout: 15000,
  userAgent: "Mozilla/5.0 (compatible; MediaBot/1.0; RSS Repair)",
  maxRedirects: 5,
};

interface DiagnosisSource {
  id: string;
  name: string;
  url: string;
  state: string | null;
  active: boolean;
  errorCount: number;
  status: string;
  httpCode: number | null;
  finalUrl: string | null;
  suggestedAction: "KEEP" | "UPDATE_URL" | "DELETE" | "REACTIVATE" | "INVESTIGATE";
  suggestedUrl: string | null;
  errorMessage: string | null;
}

interface DiagnosisReport {
  timestamp: string;
  totalSources: number;
  sources: DiagnosisSource[];
}

interface RepairResult {
  id: string;
  name: string;
  state: string | null;
  action: string;
  success: boolean;
  oldUrl?: string;
  newUrl?: string;
  message: string;
}

/**
 * Verifica si una URL responde con RSS válido
 */
async function verifyRssFeed(url: string): Promise<{
  valid: boolean;
  contentType: string | null;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": CONFIG.userAgent,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { valid: false, contentType: null, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type");
    const content = await response.text();

    // Verificar si es RSS/XML válido
    const isRss =
      contentType?.includes("xml") ||
      content.trim().startsWith("<?xml") ||
      content.includes("<rss") ||
      content.includes("<feed") ||
      content.includes("<rdf");

    return { valid: isRss, contentType };
  } catch (error) {
    return {
      valid: false,
      contentType: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Busca URL final siguiendo redirects
 */
async function followRedirects(url: string): Promise<{
  finalUrl: string;
  redirectCount: number;
  error?: string;
}> {
  let currentUrl = url;
  let redirectCount = 0;

  try {
    while (redirectCount < CONFIG.maxRedirects) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

      const response = await fetch(currentUrl, {
        method: "HEAD",
        headers: { "User-Agent": CONFIG.userAgent },
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (location) {
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

      return { finalUrl: currentUrl, redirectCount };
    }

    return { finalUrl: currentUrl, redirectCount };
  } catch (error) {
    return {
      finalUrl: url,
      redirectCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Busca feeds alternativos en una página
 */
async function findAlternativeFeeds(pageUrl: string): Promise<string[]> {
  const feeds: string[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    const response = await fetch(pageUrl, {
      headers: { "User-Agent": CONFIG.userAgent },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return feeds;

    const html = await response.text();
    const base = new URL(pageUrl);

    // Buscar <link rel="alternate">
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
        if (feedUrl.startsWith("/")) {
          feedUrl = `${base.protocol}//${base.host}${feedUrl}`;
        }
        feeds.push(feedUrl);
      }
    }

    // Probar rutas comunes si no encontramos nada
    if (feeds.length === 0) {
      const commonPaths = ["/feed", "/feed/", "/rss", "/rss.xml", "/feed.xml"];
      for (const feedPath of commonPaths) {
        const testUrl = `${base.protocol}//${base.host}${feedPath}`;
        const check = await verifyRssFeed(testUrl);
        if (check.valid) {
          feeds.push(testUrl);
          break; // Solo necesitamos uno válido
        }
      }
    }
  } catch {
    // Ignorar errores
  }

  return feeds;
}

/**
 * Repara una fuente individual
 */
async function repairSource(
  source: DiagnosisSource,
  dryRun: boolean
): Promise<RepairResult> {
  const result: RepairResult = {
    id: source.id,
    name: source.name,
    state: source.state,
    action: source.suggestedAction,
    success: false,
    message: "",
  };

  try {
    switch (source.suggestedAction) {
      case "KEEP": {
        result.success = true;
        result.message = "Sin cambios necesarios";
        break;
      }

      case "REACTIVATE": {
        // Verificar que el feed sigue funcionando
        const check = await verifyRssFeed(source.url);
        if (check.valid) {
          if (!dryRun) {
            await prisma.rssSource.update({
              where: { id: source.id },
              data: {
                active: true,
                errorCount: 0,
              },
            });
          }
          result.success = true;
          result.message = dryRun
            ? "[DRY RUN] Se reactivaría la fuente"
            : "Fuente reactivada exitosamente";
        } else {
          result.success = false;
          result.message = `Feed sigue fallando: ${check.error || "respuesta no válida"}`;
        }
        break;
      }

      case "UPDATE_URL": {
        let newUrl = source.suggestedUrl;

        // Si no hay URL sugerida, intentar seguir redirects
        if (!newUrl) {
          const redirectResult = await followRedirects(source.url);
          if (redirectResult.finalUrl !== source.url) {
            newUrl = redirectResult.finalUrl;
          }
        }

        // Si aún no hay URL, buscar feeds alternativos
        if (!newUrl) {
          // Extraer dominio base
          const base = new URL(source.url);
          const homeUrl = `${base.protocol}//${base.host}`;
          const alternatives = await findAlternativeFeeds(homeUrl);
          if (alternatives.length > 0) {
            newUrl = alternatives[0];
          }
        }

        if (newUrl) {
          // Verificar que la nueva URL funciona
          const check = await verifyRssFeed(newUrl);
          if (check.valid) {
            if (!dryRun) {
              await prisma.rssSource.update({
                where: { id: source.id },
                data: {
                  url: newUrl,
                  active: true,
                  errorCount: 0,
                },
              });
            }
            result.success = true;
            result.oldUrl = source.url;
            result.newUrl = newUrl;
            result.message = dryRun
              ? `[DRY RUN] Se actualizaría URL`
              : `URL actualizada exitosamente`;
          } else {
            result.success = false;
            result.message = `Nueva URL no responde: ${check.error || "no válida"}`;
          }
        } else {
          result.success = false;
          result.message = "No se encontró URL alternativa válida";
        }
        break;
      }

      case "DELETE": {
        // No eliminamos automáticamente, solo marcamos como inactiva
        if (!dryRun) {
          await prisma.rssSource.update({
            where: { id: source.id },
            data: {
              active: false,
              errorCount: 999, // Marcar como permanentemente fallida
            },
          });
        }
        result.success = true;
        result.message = dryRun
          ? "[DRY RUN] Se marcaría como inactiva permanentemente"
          : "Marcada como inactiva permanentemente";
        break;
      }

      case "INVESTIGATE": {
        // Intentar reparación automática antes de dejar para investigación manual
        const check = await verifyRssFeed(source.url);
        if (check.valid) {
          if (!dryRun) {
            await prisma.rssSource.update({
              where: { id: source.id },
              data: {
                active: true,
                errorCount: 0,
              },
            });
          }
          result.success = true;
          result.message = dryRun
            ? "[DRY RUN] Feed funciona, se reactivaría"
            : "Feed funciona, reactivada";
        } else {
          // Intentar buscar alternativa
          const base = new URL(source.url);
          const homeUrl = `${base.protocol}//${base.host}`;
          const alternatives = await findAlternativeFeeds(homeUrl);

          if (alternatives.length > 0) {
            const altCheck = await verifyRssFeed(alternatives[0]);
            if (altCheck.valid) {
              if (!dryRun) {
                await prisma.rssSource.update({
                  where: { id: source.id },
                  data: {
                    url: alternatives[0],
                    active: true,
                    errorCount: 0,
                  },
                });
              }
              result.success = true;
              result.oldUrl = source.url;
              result.newUrl = alternatives[0];
              result.message = dryRun
                ? "[DRY RUN] Se encontró alternativa válida"
                : "Actualizada con URL alternativa";
            } else {
              result.success = false;
              result.message = "Requiere investigación manual";
            }
          } else {
            result.success = false;
            result.message = "Requiere investigación manual";
          }
        }
        break;
      }

      default:
        result.message = `Acción desconocida: ${source.suggestedAction}`;
    }
  } catch (error) {
    result.success = false;
    result.message = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Función principal
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const inputArg = args.find((a) => a.startsWith("--input="));
  const filterState = args.find((a) => a.startsWith("--state="))?.split("=")[1];

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        Reparación de Fuentes RSS - MediaBot                ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (dryRun) {
    console.log("⚠️  MODO DRY RUN - No se aplicarán cambios reales\n");
  }

  // Buscar el reporte de diagnóstico más reciente
  let reportPath: string;

  if (inputArg) {
    reportPath = inputArg.split("=")[1];
  } else {
    const reportsDir = path.join(__dirname, "..", "docs", "reports");
    const files = fs.readdirSync(reportsDir).filter((f) => f.startsWith("rss-diagnosis-"));
    files.sort().reverse();

    if (files.length === 0) {
      console.error(
        "❌ No se encontró reporte de diagnóstico. Ejecuta primero: npx tsx scripts/diagnose-rss-sources.ts"
      );
      process.exit(1);
    }

    reportPath = path.join(reportsDir, files[0]);
  }

  console.log(`📁 Usando reporte: ${reportPath}\n`);

  // Leer el reporte
  const report: DiagnosisReport = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

  // Filtrar fuentes que necesitan acción
  let sourcesToRepair = report.sources.filter(
    (s) => s.suggestedAction !== "KEEP" || (!s.active && s.errorCount > 0)
  );

  if (filterState) {
    sourcesToRepair = sourcesToRepair.filter((s) => s.state === filterState);
    console.log(`🔍 Filtro aplicado: state = "${filterState}"`);
  }

  console.log(`📊 Fuentes a procesar: ${sourcesToRepair.length}\n`);

  const results: RepairResult[] = [];
  let processed = 0;

  // Procesar cada fuente
  for (const source of sourcesToRepair) {
    processed++;
    console.log(
      `[${processed}/${sourcesToRepair.length}] Procesando: ${source.name.substring(0, 35).padEnd(35)} | ${source.suggestedAction}`
    );

    const result = await repairSource(source, dryRun);
    results.push(result);

    const icon = result.success ? "✅" : "❌";
    console.log(`    ${icon} ${result.message}`);
    if (result.newUrl) {
      console.log(`       URL: ${result.oldUrl} → ${result.newUrl}`);
    }

    // Pequeña pausa para no sobrecargar
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Resumen
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    RESUMEN DE REPARACIÓN                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Reparadas exitosamente: ${successful.length}`);
  console.log(`❌ Fallaron: ${failed.length}`);

  // Agrupar por acción
  const byAction: Record<string, { success: number; failed: number }> = {};
  for (const r of results) {
    if (!byAction[r.action]) {
      byAction[r.action] = { success: 0, failed: 0 };
    }
    if (r.success) {
      byAction[r.action].success++;
    } else {
      byAction[r.action].failed++;
    }
  }

  console.log("\n📊 Por Acción:");
  console.log("┌─────────────────────┬─────────┬─────────┐");
  console.log("│ Acción              │ Éxito   │ Fallo   │");
  console.log("├─────────────────────┼─────────┼─────────┤");
  for (const [action, stats] of Object.entries(byAction)) {
    console.log(
      `│ ${action.padEnd(19)} │ ${stats.success.toString().padStart(7)} │ ${stats.failed.toString().padStart(7)} │`
    );
  }
  console.log("└─────────────────────┴─────────┴─────────┘");

  // Listar URLs actualizadas
  const urlUpdates = results.filter((r) => r.newUrl);
  if (urlUpdates.length > 0) {
    console.log("\n🔄 URLs Actualizadas:");
    console.log("─".repeat(80));
    for (const r of urlUpdates) {
      console.log(`\n  ${r.name} (${r.state || "Nacional"})`);
      console.log(`    Antes: ${r.oldUrl}`);
      console.log(`    Ahora: ${r.newUrl}`);
    }
  }

  // Listar fuentes que requieren investigación manual
  const needsManual = failed.filter((r) => r.message.includes("investigación manual"));
  if (needsManual.length > 0) {
    console.log("\n🔍 Requieren Investigación Manual:");
    console.log("─".repeat(80));
    for (const r of needsManual) {
      console.log(`  - ${r.name} (${r.state || "Nacional"})`);
    }
  }

  // Guardar resultados
  const dateStr = new Date().toISOString().split("T")[0];
  const outputDir = path.join(__dirname, "..", "docs", "reports");
  const resultPath = path.join(outputDir, `rss-repair-${dateStr}.json`);

  fs.writeFileSync(
    resultPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        dryRun,
        totalProcessed: results.length,
        successful: successful.length,
        failed: failed.length,
        results,
      },
      null,
      2
    )
  );

  console.log(`\n📁 Resultados guardados: ${resultPath}`);

  // Cerrar conexión
  await prisma.$disconnect();

  console.log("\n✅ Reparación completada");

  if (dryRun) {
    console.log("\n💡 Para aplicar los cambios, ejecuta sin --dry-run:");
    console.log("   npx tsx scripts/repair-rss-sources.ts");
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
