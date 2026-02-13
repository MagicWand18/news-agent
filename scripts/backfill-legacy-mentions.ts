/**
 * Script de migración: marca menciones existentes como historial.
 * Historial = artículo con publishedAt > 30 días de antigüedad.
 * También corrige menciones marcadas incorrectamente como legacy.
 *
 * Ejecutar después del deploy con: npx tsx scripts/backfill-legacy-mentions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MAX_AGE_DAYS = parseInt(process.env.MAX_ARTICLE_AGE_DAYS || "30", 10);

async function main() {
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  console.log(`Iniciando backfill de menciones historial (cutoff: ${cutoff.toISOString().split("T")[0]}, ${MAX_AGE_DAYS} días)...`);

  // === PASO 1: Corregir menciones marcadas incorrectamente como legacy ===
  // Desmarcar menciones cuyo artículo es reciente (< 30 días)
  const fixedResult = await prisma.$executeRaw`
    UPDATE "Mention" m
    SET "isLegacy" = false
    FROM "Article" a
    WHERE m."articleId" = a.id
      AND m."isLegacy" = true
      AND a."publishedAt" IS NOT NULL
      AND a."publishedAt" >= ${cutoff}
  `;
  console.log(`Menciones corregidas (desmarcadas de legacy): ${fixedResult}`);

  // === PASO 2: Marcar como legacy las que sí son viejas ===
  const mentionResult = await prisma.$executeRaw`
    UPDATE "Mention" m
    SET "isLegacy" = true
    FROM "Article" a
    WHERE m."articleId" = a.id
      AND m."isLegacy" = false
      AND (
        (a."publishedAt" IS NOT NULL AND a."publishedAt" < ${cutoff})
        OR (a."publishedAt" IS NULL AND m."createdAt" < ${cutoff})
      )
  `;
  console.log(`Menciones noticias archivadas: ${mentionResult}`);

  // === Menciones sociales ===
  const socialResult = await prisma.$executeRaw`
    UPDATE "SocialMention"
    SET "isLegacy" = true
    WHERE "isLegacy" = false
      AND (
        ("postedAt" IS NOT NULL AND "postedAt" < ${cutoff})
        OR ("postedAt" IS NULL AND "createdAt" < ${cutoff})
      )
  `;
  console.log(`Menciones sociales archivadas: ${socialResult}`);

  // Verificar resultado
  const mentionVerification = await prisma.$queryRaw<
    { isLegacy: boolean; count: bigint }[]
  >`SELECT "isLegacy", COUNT(*) as count FROM "Mention" GROUP BY "isLegacy"`;

  const socialVerification = await prisma.$queryRaw<
    { isLegacy: boolean; count: bigint }[]
  >`SELECT "isLegacy", COUNT(*) as count FROM "SocialMention" GROUP BY "isLegacy"`;

  console.log("\nDistribución final - Menciones noticias:");
  for (const row of mentionVerification) {
    console.log(`  isLegacy=${row.isLegacy}: ${Number(row.count)}`);
  }
  console.log("Distribución final - Menciones sociales:");
  for (const row of socialVerification) {
    console.log(`  isLegacy=${row.isLegacy}: ${Number(row.count)}`);
  }
}

main()
  .catch((err) => {
    console.error("Error en backfill:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
