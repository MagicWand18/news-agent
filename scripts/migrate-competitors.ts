/**
 * Script de migración: Keywords tipo COMPETITOR → modelo Competitor + ClientCompetitor.
 *
 * Lógica:
 * 1. Fetch todos los Keyword con type="COMPETITOR" + su client.orgId
 * 2. Agrupar por orgId + nombre normalizado para deduplicar
 * 3. Crear Competitor con upsert (nombre canónico = versión con acentos)
 * 4. Crear ClientCompetitor por cada cliente que tenía ese keyword
 * 5. Desactivar keywords COMPETITOR antiguos (active = false)
 * 6. Log del resumen
 *
 * Uso: npx tsx scripts/migrate-competitors.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Normaliza un nombre quitando acentos y pasando a lowercase */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  console.log("=== Migración: COMPETITOR keywords → Competitor model ===\n");

  // 1. Fetch keywords COMPETITOR activos con su cliente y org
  const competitorKeywords = await prisma.keyword.findMany({
    where: { type: "COMPETITOR", active: true },
    include: {
      client: {
        select: { id: true, name: true, orgId: true },
      },
    },
  });

  console.log(`Encontrados ${competitorKeywords.length} keywords tipo COMPETITOR activos\n`);

  if (competitorKeywords.length === 0) {
    console.log("No hay keywords COMPETITOR para migrar. Saliendo.");
    return;
  }

  // 2. Agrupar por orgId + nombre normalizado
  const groups = new Map<string, {
    canonicalName: string;
    orgId: string;
    clientIds: Set<string>;
    keywordIds: string[];
  }>();

  for (const kw of competitorKeywords) {
    const normalized = normalizeName(kw.word);
    const key = `${kw.client.orgId}::${normalized}`;

    if (!groups.has(key)) {
      groups.set(key, {
        canonicalName: kw.word, // Usar primera versión encontrada (con acentos)
        orgId: kw.client.orgId,
        clientIds: new Set(),
        keywordIds: [],
      });
    }

    const group = groups.get(key)!;
    group.clientIds.add(kw.client.id);
    group.keywordIds.push(kw.id);

    // Preferir versión con acentos (más larga suele tener acentos)
    if (kw.word.length > group.canonicalName.length) {
      group.canonicalName = kw.word;
    }
  }

  console.log(`Agrupados en ${groups.size} competidores únicos por org\n`);

  // 3 y 4. Crear Competitor y ClientCompetitor
  let competitorsCreated = 0;
  let clientCompetitorsCreated = 0;
  let keywordsDeactivated = 0;

  for (const [key, group] of groups) {
    console.log(`\n--- ${group.canonicalName} (org: ${group.orgId}) ---`);
    console.log(`  Clientes: ${group.clientIds.size}, Keywords: ${group.keywordIds.length}`);

    // Upsert Competitor
    const competitor = await prisma.competitor.upsert({
      where: {
        name_orgId: {
          name: group.canonicalName,
          orgId: group.orgId,
        },
      },
      create: {
        name: group.canonicalName,
        orgId: group.orgId,
      },
      update: {},
    });
    competitorsCreated++;
    console.log(`  Competitor: ${competitor.id} (${competitor.name})`);

    // Crear ClientCompetitor por cada cliente
    for (const clientId of group.clientIds) {
      try {
        await prisma.clientCompetitor.upsert({
          where: {
            clientId_competitorId: {
              clientId,
              competitorId: competitor.id,
            },
          },
          create: {
            clientId,
            competitorId: competitor.id,
          },
          update: {},
        });
        clientCompetitorsCreated++;
        console.log(`  ClientCompetitor: ${clientId} → ${competitor.id}`);
      } catch (error) {
        console.error(`  Error creando ClientCompetitor para cliente ${clientId}:`, error);
      }
    }

    // 5. Desactivar keywords
    const result = await prisma.keyword.updateMany({
      where: { id: { in: group.keywordIds } },
      data: { active: false },
    });
    keywordsDeactivated += result.count;
    console.log(`  Keywords desactivados: ${result.count}`);
  }

  // 6. Resumen
  console.log("\n=== RESUMEN DE MIGRACIÓN ===");
  console.log(`Competitors creados/actualizados: ${competitorsCreated}`);
  console.log(`ClientCompetitors creados: ${clientCompetitorsCreated}`);
  console.log(`Keywords desactivados: ${keywordsDeactivated}`);
  console.log("===========================\n");
}

main()
  .catch((error) => {
    console.error("Error en migración:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
