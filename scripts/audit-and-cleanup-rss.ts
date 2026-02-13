/**
 * Script de Auditoría, Limpieza y Recategorización de Fuentes RSS
 *
 * 1. Exporta lista de evidencia (CSV) con estado actual de todas las fuentes
 * 2. Valida cada URL activa con HTTP GET
 * 3. Recategoriza fuentes (type: STATE/NATIONAL/SPECIALIZED, tier correcto)
 * 4. Elimina fuentes inactivas que no responden
 * 5. Agrega nuevas fuentes verificadas
 * 6. Genera reporte final de cobertura
 *
 * Uso:
 *   npx tsx scripts/audit-and-cleanup-rss.ts --dry-run
 *   npx tsx scripts/audit-and-cleanup-rss.ts
 */

import * as dotenv from "dotenv";
import { PrismaClient, SourceType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const prisma = new PrismaClient();

const CONFIG = {
  timeout: 12000,
  concurrency: 8,
  userAgent: "Mozilla/5.0 (compatible; MediaBot/1.0; RSS Audit)",
  rssContentTypes: ["application/rss+xml", "application/xml", "text/xml", "application/atom+xml", "application/rdf+xml"],
};

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RssSourceRow {
  id: string;
  name: string;
  url: string;
  tier: number;
  type: SourceType;
  state: string | null;
  city: string | null;
  active: boolean;
  errorCount: number;
}

interface AuditEntry extends RssSourceRow {
  httpStatus: number | null;
  isValidRss: boolean;
  error: string | null;
  action: "KEEP" | "FIX_CATEGORY" | "REACTIVATE" | "DELETE" | "ADD";
  newType?: SourceType;
  newTier?: number;
}

interface NewSource {
  name: string;
  url: string;
  tier: number;
  type: SourceType;
  state: string | null;
}

// ─── Recategorización ────────────────────────────────────────────────────────
// Toda fuente con state != null debería ser STATE (no NATIONAL), tier 2

// Fuentes nacionales reales (sin state, o state=null)
const SPECIALIZED_DOMAINS = [
  "altonivel.com.mx", "elceo.com", "politico.mx",
  "entrepreneur.com",
  "manufactura.mx", "obrasweb.mx", "inmobiliare.com", "realestatemarket.com.mx",
  "energiahoy.com", "t21.com.mx", "2000agro.com.mx",
  // Tech/entretenimiento
  "fayerwayer.com", "hipertextual.com", "unocero.com", "xataka.com.mx",
  "directoalpaladar.com.mx", "motorpasion.com.mx", "animalgourmet.com",
  // Deportes
  "espndeportes.espn.com", "mediotiempo.com", "record.com.mx", "tudn.com",
  // Espectáculos
  "quien.com", "tvnotas.com.mx", "publimetro.com.mx",
  // Ciencia/turismo
  "ciencia.unam.mx", "mexicodesconocido.com.mx",
  "autocosmos.com.mx",
];

// ─── Nuevas fuentes verificadas por investigación ────────────────────────────

const NEW_VERIFIED_SOURCES: NewSource[] = [
  // Morelos (0 fuentes activas - máxima prioridad)
  { name: "El Sol de Cuernavaca", url: "https://www.elsoldecuernavaca.com.mx/rss", tier: 2, type: "STATE", state: "Morelos" },
  { name: "El Sol de Cuautla", url: "https://www.elsoldecuautla.com.mx/rss", tier: 2, type: "STATE", state: "Morelos" },
  { name: "Quadratín Morelos", url: "https://morelos.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Morelos" },
  { name: "24 Morelos", url: "https://www.24morelos.com/feed/", tier: 2, type: "STATE", state: "Morelos" },

  // Nuevo León (corregir URLs)
  { name: "El Norte Local", url: "https://www.elnorte.com/rss/local.xml", tier: 2, type: "STATE", state: "Nuevo León" },
  { name: "Quadratín Nuevo León", url: "https://nuevoleon.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Nuevo León" },

  // San Luis Potosí
  { name: "El Sol de San Luis", url: "https://www.elsoldesanluis.com.mx/rss", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "La Jornada San Luis", url: "https://lajornadasanluis.com.mx/feed/", tier: 2, type: "STATE", state: "San Luis Potosí" },
  { name: "Astrolabio SLP", url: "https://astrolabio.com.mx/feed/", tier: 2, type: "STATE", state: "San Luis Potosí" },

  // Veracruz
  { name: "Diario de Xalapa", url: "https://www.diariodexalapa.com.mx/rss", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "El Sol de Córdoba", url: "https://www.elsoldecordoba.com.mx/rss", tier: 2, type: "STATE", state: "Veracruz" },
  { name: "El Sol de Orizaba", url: "https://www.elsoldeorizaba.com.mx/rss", tier: 2, type: "STATE", state: "Veracruz" },

  // Coahuila
  { name: "El Siglo de Torreón", url: "https://elsiglodetorreon.com.mx/index.xml", tier: 2, type: "STATE", state: "Coahuila" },
  { name: "Vanguardia RSS", url: "https://www.vanguardia.com.mx/rss", tier: 2, type: "STATE", state: "Coahuila" },

  // Baja California
  { name: "El Sol de Tijuana", url: "https://www.elsoldetijuana.com.mx/rss", tier: 2, type: "STATE", state: "Baja California" },
  { name: "La Voz de la Frontera", url: "https://www.lavozdelafrontera.com.mx/rss", tier: 2, type: "STATE", state: "Baja California" },
  { name: "San Diego Red", url: "https://www.sandiegored.com/feed/", tier: 2, type: "STATE", state: "Baja California" },

  // Durango
  { name: "El Sol de Durango", url: "https://www.elsoldedurango.com.mx/rss", tier: 2, type: "STATE", state: "Durango" },

  // Estado de México
  { name: "El Sol de Toluca", url: "https://www.elsoldetoluca.com.mx/rss", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "Quadratín Edomex", url: "https://edomex.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Estado de México" },
  { name: "AD Noticias", url: "https://adnoticias.mx/feed/", tier: 2, type: "STATE", state: "Estado de México" },

  // Puebla
  { name: "El Sol de Puebla", url: "https://www.elsoldepuebla.com.mx/rss", tier: 2, type: "STATE", state: "Puebla" },
  { name: "Quadratín Puebla", url: "https://puebla.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Puebla" },
  { name: "Ángulo 7", url: "https://www.angulo7.com.mx/feed/", tier: 2, type: "STATE", state: "Puebla" },

  // Querétaro
  { name: "Diario de Querétaro", url: "https://www.diariodequeretaro.com.mx/rss", tier: 2, type: "STATE", state: "Querétaro" },
  { name: "Quadratín Querétaro", url: "https://queretaro.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Querétaro" },

  // Sinaloa
  { name: "El Sol de Sinaloa", url: "https://www.elsoldesinaloa.com.mx/rss", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "El Sol de Mazatlán", url: "https://www.elsoldemazatlan.com.mx/rss", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "Línea Directa", url: "https://lineadirectaportal.com/feed", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "La Pared Noticias", url: "https://laparednoticias.com/feed/", tier: 2, type: "STATE", state: "Sinaloa" },
  { name: "Quadratín Sinaloa", url: "https://sinaloa.quadratin.com.mx/feed/", tier: 2, type: "STATE", state: "Sinaloa" },

  // Tabasco
  { name: "El Heraldo de Tabasco", url: "https://www.elheraldodetabasco.com.mx/rss", tier: 2, type: "STATE", state: "Tabasco" },

  // Tlaxcala
  { name: "El Sol de Tlaxcala", url: "https://www.elsoldetlaxcala.com.mx/rss", tier: 2, type: "STATE", state: "Tlaxcala" },
  { name: "La Jornada de Oriente", url: "https://www.lajornadadeoriente.com.mx/feed/", tier: 2, type: "STATE", state: "Tlaxcala" },

  // Colima
  { name: "Colima Noticias", url: "https://colimanoticias.com/feed/", tier: 2, type: "STATE", state: "Colima" },

  // CDMX
  { name: "Contralínea", url: "https://contralinea.com.mx/feed/", tier: 2, type: "STATE", state: "Ciudad de México" },

  // Campeche
  { name: "Campeche HOY", url: "https://campechehoy.mx/feed/", tier: 2, type: "STATE", state: "Campeche" },
];

// ─── Funciones de validación ─────────────────────────────────────────────────

function isRssContent(contentType: string | null, body: string): boolean {
  const ctMatch = contentType
    ? CONFIG.rssContentTypes.some((t) => contentType.toLowerCase().includes(t))
    : false;
  const trimmed = body.trim().substring(0, 500).toLowerCase();
  const bodyMatch =
    trimmed.includes("<?xml") ||
    trimmed.includes("<rss") ||
    trimmed.includes("<feed") ||
    trimmed.includes("<rdf");
  return ctMatch || bodyMatch;
}

async function validateUrl(url: string): Promise<{ httpStatus: number | null; isValidRss: boolean; error: string | null }> {
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
      return { httpStatus: response.status, isValidRss: false, error: `HTTP ${response.status}` };
    }

    const ct = response.headers.get("content-type");
    const body = await response.text();
    const valid = isRssContent(ct, body);

    return { httpStatus: 200, isValidRss: valid, error: valid ? null : "Not RSS" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const shortMsg = msg.includes("abort") ? "Timeout" : msg.substring(0, 60);
    return { httpStatus: null, isValidRss: false, error: shortMsg };
  }
}

async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await processor(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ─── Determinar categoría correcta ──────────────────────────────────────────

function getCorrectCategory(source: RssSourceRow): { type: SourceType; tier: number } {
  const domain = (() => {
    try { return new URL(source.url).hostname.replace("www.", ""); }
    catch { return ""; }
  })();

  // Si tiene state → debe ser STATE, tier 2
  if (source.state) {
    // Verificar si es especializado
    const isSpecialized = SPECIALIZED_DOMAINS.some((d) => domain.includes(d));
    if (isSpecialized) {
      return { type: "SPECIALIZED", tier: 2 };
    }
    return { type: "STATE", tier: 2 };
  }

  // Sin state → es nacional o especializado
  const isSpecialized = SPECIALIZED_DOMAINS.some((d) => domain.includes(d));
  if (isSpecialized) {
    return { type: "SPECIALIZED", tier: 3 };
  }

  // Nacional de primer nivel
  const tier1Domains = [
    "jornada.com.mx", "milenio.com", "sinembargo.mx", "lopezdoriga.com",
    "elfinanciero.com.mx", "reforma.com", "bbc.co.uk", "bbci.co.uk",
    "expansion.mx", "eleconomista.com.mx", "forbes.com.mx",
  ];
  const isTier1 = tier1Domains.some((d) => domain.includes(d));
  return { type: "NATIONAL", tier: isTier1 ? 1 : 3 };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Auditoría, Limpieza y Recategorización RSS - MediaBot    ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (dryRun) console.log("⚠️  MODO DRY RUN\n");

  // ═══ FASE 1: Cargar y exportar estado actual ═══
  console.log("═══ Fase 1: Exportar estado actual (evidencia) ═══\n");

  const allSources = await prisma.rssSource.findMany({
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });

  console.log(`  Total fuentes en DB: ${allSources.length}`);
  console.log(`  Activas: ${allSources.filter((s) => s.active).length}`);
  console.log(`  Inactivas: ${allSources.filter((s) => !s.active).length}`);

  // Guardar evidencia CSV ANTES de cambios
  const dateStr = new Date().toISOString().split("T")[0];
  const outputDir = path.join(__dirname, "..", "docs", "reports");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const evidenceCsvPath = path.join(outputDir, `rss-evidence-before-${dateStr}.csv`);
  const csvHeader = "id,name,url,tier,type,state,city,active,errorCount\n";
  const csvRows = allSources.map((s) =>
    `"${s.id}","${s.name}","${s.url}",${s.tier},"${s.type}","${s.state || ""}","${s.city || ""}",${s.active},${s.errorCount}`
  ).join("\n");
  fs.writeFileSync(evidenceCsvPath, csvHeader + csvRows);
  console.log(`  📁 Evidencia guardada: ${evidenceCsvPath}\n`);

  // ═══ FASE 2: Validar todas las fuentes activas ═══
  console.log("═══ Fase 2: Validar fuentes activas ═══\n");

  const activeSources = allSources.filter((s) => s.active);
  console.log(`  Validando ${activeSources.length} fuentes activas...\n`);

  let validated = 0;
  const activeValidations = await processInBatches(
    activeSources,
    async (source) => {
      const result = await validateUrl(source.url);
      validated++;
      const icon = result.isValidRss ? "✅" : "❌";
      console.log(`  [${validated}/${activeSources.length}] ${icon} ${source.name.substring(0, 35).padEnd(35)} | ${result.httpStatus || "ERR"} | ${result.error || "OK"}`);
      return { id: source.id, ...result };
    },
    CONFIG.concurrency
  );

  const activeValid = activeValidations.filter((v) => v.isValidRss);
  const activeInvalid = activeValidations.filter((v) => !v.isValidRss);
  console.log(`\n  Válidas: ${activeValid.length} | Inválidas: ${activeInvalid.length}\n`);

  // ═══ FASE 3: Auditar y determinar acciones ═══
  console.log("═══ Fase 3: Determinar acciones ═══\n");

  const audit: AuditEntry[] = [];
  const validActiveIds = new Set(activeValid.map((v) => v.id));
  const invalidActiveIds = new Set(activeInvalid.map((v) => v.id));

  for (const source of allSources) {
    const correct = getCorrectCategory(source);
    const needsCategoryFix = source.type !== correct.type || source.tier !== correct.tier;
    const validation = activeValidations.find((v) => v.id === source.id);

    let action: AuditEntry["action"];
    if (!source.active) {
      // Inactiva → eliminar
      action = "DELETE";
    } else if (invalidActiveIds.has(source.id)) {
      // Activa pero no responde → eliminar
      action = "DELETE";
    } else if (needsCategoryFix && validActiveIds.has(source.id)) {
      // Activa, válida, pero mal categorizada → fix
      action = "FIX_CATEGORY";
    } else if (validActiveIds.has(source.id)) {
      action = "KEEP";
    } else {
      action = "DELETE";
    }

    audit.push({
      ...source,
      httpStatus: validation?.httpStatus ?? null,
      isValidRss: validation?.isValidRss ?? false,
      error: validation?.error ?? (source.active ? null : "Inactive"),
      action,
      newType: needsCategoryFix ? correct.type : undefined,
      newTier: needsCategoryFix ? correct.tier : undefined,
    });
  }

  const toDelete = audit.filter((a) => a.action === "DELETE");
  const toFix = audit.filter((a) => a.action === "FIX_CATEGORY");
  const toKeep = audit.filter((a) => a.action === "KEEP");

  console.log(`  KEEP: ${toKeep.length} (activas, válidas, bien categorizadas)`);
  console.log(`  FIX_CATEGORY: ${toFix.length} (válidas pero mal categorizadas)`);
  console.log(`  DELETE: ${toDelete.length} (inactivas o no responden)`);

  // Mostrar recategorizaciones
  if (toFix.length > 0) {
    console.log("\n  Recategorizaciones:");
    for (const entry of toFix) {
      console.log(`    ${entry.name.padEnd(35)} | ${entry.type} T${entry.tier} → ${entry.newType} T${entry.newTier} | ${entry.state || "Nacional"}`);
    }
  }

  // ═══ FASE 4: Validar nuevas fuentes ═══
  console.log("\n═══ Fase 4: Validar nuevas fuentes ═══\n");

  // Filtrar fuentes que ya existen en DB
  const existingUrls = new Set(allSources.map((s) => s.url));
  const newSources = NEW_VERIFIED_SOURCES.filter((s) => !existingUrls.has(s.url));
  console.log(`  Nuevas fuentes a validar: ${newSources.length} (${NEW_VERIFIED_SOURCES.length - newSources.length} ya existen)\n`);

  let newValidated = 0;
  const newValidations = await processInBatches(
    newSources,
    async (source) => {
      const result = await validateUrl(source.url);
      newValidated++;
      const icon = result.isValidRss ? "✅" : "⏭️";
      console.log(`  [${newValidated}/${newSources.length}] ${icon} ${source.name.padEnd(35)} | ${result.httpStatus || "ERR"} | ${result.error || "OK"}`);
      return { source, ...result };
    },
    CONFIG.concurrency
  );

  const validNew = newValidations.filter((v) => v.isValidRss);
  const invalidNew = newValidations.filter((v) => !v.isValidRss);
  console.log(`\n  Válidas: ${validNew.length} | Inválidas: ${invalidNew.length}\n`);

  // ═══ FASE 5: Aplicar cambios ═══
  console.log("═══ Fase 5: Aplicar cambios ═══\n");

  let deleted = 0;
  let fixed = 0;
  let added = 0;

  // 5a. Eliminar fuentes que no funcionan
  console.log(`  Eliminando ${toDelete.length} fuentes no funcionales...`);
  if (!dryRun) {
    const deleteIds = toDelete.map((d) => d.id);
    // Eliminar en lotes de 50
    for (let i = 0; i < deleteIds.length; i += 50) {
      const batch = deleteIds.slice(i, i + 50);
      const result = await prisma.rssSource.deleteMany({
        where: { id: { in: batch } },
      });
      deleted += result.count;
    }
  } else {
    deleted = toDelete.length;
  }
  console.log(`  ✅ ${deleted} eliminadas\n`);

  // 5b. Recategorizar fuentes
  console.log(`  Recategorizando ${toFix.length} fuentes...`);
  for (const entry of toFix) {
    if (!dryRun && entry.newType && entry.newTier) {
      await prisma.rssSource.update({
        where: { id: entry.id },
        data: { type: entry.newType, tier: entry.newTier },
      });
    }
    fixed++;
  }
  console.log(`  ✅ ${fixed} recategorizadas\n`);

  // 5c. Agregar nuevas fuentes verificadas
  console.log(`  Agregando ${validNew.length} nuevas fuentes...`);
  for (const v of validNew) {
    try {
      if (!dryRun) {
        await prisma.rssSource.upsert({
          where: { url: v.source.url },
          create: {
            name: v.source.name,
            url: v.source.url,
            tier: v.source.tier,
            type: v.source.type,
            state: v.source.state,
            active: true,
          },
          update: {
            name: v.source.name,
            tier: v.source.tier,
            type: v.source.type,
            state: v.source.state,
            active: true,
            errorCount: 0,
          },
        });
      }
      added++;
      console.log(`    ✅ ${v.source.name} (${v.source.state})`);
    } catch (error) {
      console.log(`    ❌ ${v.source.name}: ${(error as Error).message}`);
    }
  }
  console.log(`  ✅ ${added} agregadas\n`);

  // ═══ FASE 6: Reporte final ═══
  console.log("═══ Fase 6: Reporte final ═══\n");

  // Guardar evidencia post-cambios
  if (!dryRun) {
    const finalSources = await prisma.rssSource.findMany({
      orderBy: [{ state: "asc" }, { type: "asc" }, { name: "asc" }],
    });

    const afterCsvPath = path.join(outputDir, `rss-evidence-after-${dateStr}.csv`);
    const afterCsvHeader = "id,name,url,tier,type,state,active,errorCount\n";
    const afterCsvRows = finalSources.map((s) =>
      `"${s.id}","${s.name}","${s.url}",${s.tier},"${s.type}","${s.state || ""}",${s.active},${s.errorCount}`
    ).join("\n");
    fs.writeFileSync(afterCsvPath, afterCsvHeader + afterCsvRows);
    console.log(`  📁 Evidencia post-limpieza: ${afterCsvPath}`);

    // Cobertura por estado
    const stateStats = await prisma.rssSource.groupBy({
      by: ["state", "type"],
      where: { active: true },
      _count: { id: true },
    });

    const coverage: Record<string, { total: number; byType: Record<string, number> }> = {};
    for (const stat of stateStats) {
      const key = stat.state || "Nacional";
      if (!coverage[key]) coverage[key] = { total: 0, byType: {} };
      coverage[key].total += stat._count.id;
      coverage[key].byType[stat.type] = (coverage[key].byType[stat.type] || 0) + stat._count.id;
    }

    console.log("\n  ┌────────────────────────────┬───────┬──────────┬───────┬──────────────┐");
    console.log("  │ Estado                     │ Total │ NATIONAL │ STATE │ SPECIALIZED  │");
    console.log("  ├────────────────────────────┼───────┼──────────┼───────┼──────────────┤");

    const ALL_STATES = [
      "Nacional",
      "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
      "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
      "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo",
      "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León",
      "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
      "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala",
      "Veracruz", "Yucatán", "Zacatecas",
    ];

    let totalActive = 0;
    let statesWithCoverage = 0;
    for (const state of ALL_STATES) {
      const c = coverage[state] || { total: 0, byType: {} };
      totalActive += c.total;
      const icon = state === "Nacional" ? "🌐" : c.total >= 3 ? "✅" : c.total > 0 ? "⚠️" : "❌";
      if (state !== "Nacional" && c.total > 0) statesWithCoverage++;
      console.log(
        `  │ ${icon} ${state.padEnd(25)} │ ${c.total.toString().padStart(5)} │ ${(c.byType["NATIONAL"] || 0).toString().padStart(8)} │ ${(c.byType["STATE"] || 0).toString().padStart(5)} │ ${(c.byType["SPECIALIZED"] || 0).toString().padStart(12)} │`
      );
    }
    console.log("  └────────────────────────────┴───────┴──────────┴───────┴──────────────┘");
    console.log(`\n  Total activas: ${totalActive} | Estados con cobertura: ${statesWithCoverage}/32`);

    // Guardar reporte JSON
    const reportPath = path.join(outputDir, `rss-audit-${dateStr}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      before: {
        total: allSources.length,
        active: allSources.filter((s) => s.active).length,
        inactive: allSources.filter((s) => !s.active).length,
      },
      actions: {
        deleted: toDelete.length,
        recategorized: toFix.length,
        added: validNew.length,
        kept: toKeep.length,
      },
      after: {
        totalActive: totalActive,
        statesWithCoverage,
      },
      deletedSources: toDelete.map((d) => ({ name: d.name, url: d.url, state: d.state, reason: d.error || "Inactive" })),
      recategorized: toFix.map((f) => ({ name: f.name, from: `${f.type} T${f.tier}`, to: `${f.newType} T${f.newTier}`, state: f.state })),
      addedSources: validNew.map((v) => ({ name: v.source.name, url: v.source.url, state: v.source.state })),
      invalidNewSources: invalidNew.map((v) => ({ name: v.source.name, url: v.source.url, error: v.error })),
      coverage,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  📁 Reporte completo: ${reportPath}`);
  }

  // Resumen
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    RESUMEN                                ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`  Antes:  ${allSources.length} fuentes (${allSources.filter((s) => s.active).length} activas)`);
  console.log(`  Eliminadas: ${deleted} (inactivas o no funcionales)`);
  console.log(`  Recategorizadas: ${fixed}`);
  console.log(`  Nuevas agregadas: ${added}`);
  if (!dryRun) {
    const finalCount = await prisma.rssSource.count({ where: { active: true } });
    console.log(`  Después: ${finalCount} fuentes activas`);
  }

  await prisma.$disconnect();
  console.log("\n✅ Auditoría completada");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  prisma.$disconnect();
  process.exit(1);
});
