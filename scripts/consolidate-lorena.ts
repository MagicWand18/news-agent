/**
 * Script de consolidación: Dos clientes "Lorena de la Garza" → uno solo.
 *
 * Cliente viejo: cmlfu8p8g0002y42uvtknnpxq (sin Telegram, 6 menciones)
 * Cliente nuevo: cmlidtgsx0002r44kjs7hurac (con Telegram, 1 mención)
 *
 * Migra datos del viejo al nuevo y desactiva el viejo.
 *
 * Uso: npx tsx scripts/consolidate-lorena.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OLD_CLIENT_ID = "cmlfu8p8g0002y42uvtknnpxq";
const NEW_CLIENT_ID = "cmlidtgsx0002r44kjs7hurac";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("=== MODO DRY RUN — No se harán cambios ===\n");
  }

  console.log("=== Consolidación: Lorena de la Garza ===\n");

  // Verificar ambos clientes
  const oldClient = await prisma.client.findUnique({
    where: { id: OLD_CLIENT_ID },
    include: {
      _count: {
        select: {
          mentions: true,
          socialMentions: true,
          socialAccounts: true,
          keywords: true,
        },
      },
    },
  });

  const newClient = await prisma.client.findUnique({
    where: { id: NEW_CLIENT_ID },
    include: {
      keywords: { where: { active: true } },
      _count: {
        select: {
          mentions: true,
          socialMentions: true,
          socialAccounts: true,
          keywords: true,
        },
      },
    },
  });

  if (!oldClient || !newClient) {
    console.error("Uno de los clientes no existe:");
    console.error(`  Viejo (${OLD_CLIENT_ID}): ${oldClient ? "OK" : "NO ENCONTRADO"}`);
    console.error(`  Nuevo (${NEW_CLIENT_ID}): ${newClient ? "OK" : "NO ENCONTRADO"}`);
    process.exit(1);
  }

  console.log(`Cliente viejo: "${oldClient.name}" (${OLD_CLIENT_ID})`);
  console.log(`  Menciones: ${oldClient._count.mentions}`);
  console.log(`  Social Mentions: ${oldClient._count.socialMentions}`);
  console.log(`  Social Accounts: ${oldClient._count.socialAccounts}`);
  console.log(`  Keywords: ${oldClient._count.keywords}`);

  console.log(`\nCliente nuevo: "${newClient.name}" (${NEW_CLIENT_ID})`);
  console.log(`  Menciones: ${newClient._count.mentions}`);
  console.log(`  Social Mentions: ${newClient._count.socialMentions}`);
  console.log(`  Social Accounts: ${newClient._count.socialAccounts}`);
  console.log(`  Keywords: ${newClient._count.keywords}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Acciones que se realizarían:");
    console.log(`  - Migrar ${oldClient._count.mentions} menciones`);
    console.log(`  - Migrar ${oldClient._count.socialMentions} social mentions`);
    console.log(`  - Migrar ${oldClient._count.socialAccounts} social accounts`);
    console.log("  - Migrar keywords únicos");
    console.log("  - Desactivar cliente viejo");
    return;
  }

  // 1. Migrar Mentions
  const mentionResult = await prisma.mention.updateMany({
    where: { clientId: OLD_CLIENT_ID },
    data: { clientId: NEW_CLIENT_ID },
  });
  console.log(`\nMenciones migradas: ${mentionResult.count}`);

  // 2. Migrar SocialMentions
  const socialMentionResult = await prisma.socialMention.updateMany({
    where: { clientId: OLD_CLIENT_ID },
    data: { clientId: NEW_CLIENT_ID },
  });
  console.log(`Social Mentions migradas: ${socialMentionResult.count}`);

  // 3. Migrar SocialAccounts (evitar duplicados)
  const oldAccounts = await prisma.socialAccount.findMany({
    where: { clientId: OLD_CLIENT_ID },
  });
  let accountsMigrated = 0;
  for (const account of oldAccounts) {
    try {
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: { clientId: NEW_CLIENT_ID },
      });
      accountsMigrated++;
    } catch {
      // Duplicado — eliminar del viejo
      await prisma.socialAccount.delete({ where: { id: account.id } });
      console.log(`  SocialAccount duplicada eliminada: ${account.platform}/${account.handle}`);
    }
  }
  console.log(`Social Accounts migradas: ${accountsMigrated}`);

  // 4. Migrar Keywords útiles (evitar duplicados)
  const existingWords = new Set(newClient.keywords.map((k) => k.word.toLowerCase()));
  const oldKeywords = await prisma.keyword.findMany({
    where: { clientId: OLD_CLIENT_ID, active: true },
  });
  let keywordsMigrated = 0;
  for (const kw of oldKeywords) {
    if (!existingWords.has(kw.word.toLowerCase())) {
      await prisma.keyword.update({
        where: { id: kw.id },
        data: { clientId: NEW_CLIENT_ID },
      });
      keywordsMigrated++;
      console.log(`  Keyword migrado: "${kw.word}" (${kw.type})`);
    } else {
      await prisma.keyword.update({
        where: { id: kw.id },
        data: { active: false },
      });
    }
  }
  console.log(`Keywords migrados: ${keywordsMigrated}`);

  // 5. Migrar ClientCompetitor
  const oldCompetitorLinks = await prisma.clientCompetitor.findMany({
    where: { clientId: OLD_CLIENT_ID },
  });
  let competitorLinksMigrated = 0;
  for (const link of oldCompetitorLinks) {
    try {
      await prisma.clientCompetitor.upsert({
        where: {
          clientId_competitorId: {
            clientId: NEW_CLIENT_ID,
            competitorId: link.competitorId,
          },
        },
        create: {
          clientId: NEW_CLIENT_ID,
          competitorId: link.competitorId,
        },
        update: {},
      });
      competitorLinksMigrated++;
    } catch {
      console.log(`  ClientCompetitor ya existe para competidor ${link.competitorId}`);
    }
    // Eliminar el link viejo
    await prisma.clientCompetitor.delete({ where: { id: link.id } });
  }
  console.log(`ClientCompetitors migrados: ${competitorLinksMigrated}`);

  // 6. Desactivar cliente viejo
  await prisma.client.update({
    where: { id: OLD_CLIENT_ID },
    data: { active: false },
  });
  console.log(`\nCliente viejo desactivado.`);

  // Resumen
  console.log("\n=== CONSOLIDACIÓN COMPLETA ===");
  console.log(`Cliente activo: "${newClient.name}" (${NEW_CLIENT_ID})`);
  console.log(`Total datos migrados: ${mentionResult.count} menciones, ${socialMentionResult.count} social, ${accountsMigrated} accounts, ${keywordsMigrated} keywords`);
  console.log("==============================\n");
}

main()
  .catch((error) => {
    console.error("Error en consolidación:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
