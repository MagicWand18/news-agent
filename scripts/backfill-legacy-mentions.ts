/**
 * Script de migración: marca menciones existentes como legacy.
 * Legacy = artículo publicado ANTES del createdAt del cliente.
 *
 * Ejecutar después del deploy con: npx tsx scripts/backfill-legacy-mentions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando backfill de menciones legacy...");

  // Contar menciones que serán marcadas como legacy
  const previewCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM "Mention" m
    JOIN "Article" a ON m."articleId" = a.id
    JOIN "Client" c ON m."clientId" = c.id
    WHERE a."publishedAt" IS NOT NULL
      AND a."publishedAt" < c."createdAt"
      AND m."isLegacy" = false
  `;

  const count = Number(previewCount[0].count);
  console.log(`Menciones a marcar como legacy: ${count}`);

  if (count === 0) {
    console.log("No hay menciones para actualizar.");
    return;
  }

  // Ejecutar actualización
  const result = await prisma.$executeRaw`
    UPDATE "Mention" m
    SET "isLegacy" = true
    FROM "Article" a, "Client" c
    WHERE m."articleId" = a.id
      AND m."clientId" = c.id
      AND a."publishedAt" IS NOT NULL
      AND a."publishedAt" < c."createdAt"
      AND m."isLegacy" = false
  `;

  console.log(`Menciones actualizadas: ${result}`);

  // Verificar resultado
  const verification = await prisma.$queryRaw<
    [{ isLegacy: boolean; count: bigint }][]
  >`
    SELECT "isLegacy", COUNT(*) as count
    FROM "Mention"
    GROUP BY "isLegacy"
  `;

  console.log("\nDistribución final:");
  for (const row of verification as { isLegacy: boolean; count: bigint }[]) {
    console.log(`  isLegacy=${row.isLegacy}: ${Number(row.count)} menciones`);
  }
}

main()
  .catch((err) => {
    console.error("Error en backfill:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
