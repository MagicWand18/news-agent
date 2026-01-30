/**
 * Script de migración para TelegramRecipient
 *
 * Migra los campos legacy telegramGroupId y clientGroupId de la tabla Client
 * a la nueva tabla TelegramRecipient.
 *
 * Ejecutar con: npx tsx prisma/migrate-telegram-recipients.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Iniciando migración de destinatarios de Telegram...\n");

  // Obtener todos los clientes con grupos de Telegram configurados
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { telegramGroupId: { not: null } },
        { clientGroupId: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      telegramGroupId: true,
      clientGroupId: true,
    },
  });

  console.log(`📋 Encontrados ${clients.length} clientes con grupos de Telegram\n`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const client of clients) {
    console.log(`\n📌 Procesando: ${client.name}`);

    // Migrar telegramGroupId (grupo interno de agencia)
    if (client.telegramGroupId) {
      try {
        await prisma.telegramRecipient.upsert({
          where: {
            clientId_chatId: {
              clientId: client.id,
              chatId: client.telegramGroupId,
            },
          },
          create: {
            clientId: client.id,
            chatId: client.telegramGroupId,
            type: "AGENCY_INTERNAL",
            label: "Grupo Interno (migrado)",
            active: true,
          },
          update: {}, // No actualizar si ya existe
        });
        console.log(`  ✅ Grupo interno migrado: ${client.telegramGroupId}`);
        createdCount++;
      } catch (error) {
        console.log(`  ⚠️ Grupo interno ya existía, omitiendo`);
        skippedCount++;
      }
    }

    // Migrar clientGroupId (grupo del cliente)
    if (client.clientGroupId) {
      try {
        await prisma.telegramRecipient.upsert({
          where: {
            clientId_chatId: {
              clientId: client.id,
              chatId: client.clientGroupId,
            },
          },
          create: {
            clientId: client.id,
            chatId: client.clientGroupId,
            type: "CLIENT_GROUP",
            label: "Grupo Cliente (migrado)",
            active: true,
          },
          update: {}, // No actualizar si ya existe
        });
        console.log(`  ✅ Grupo cliente migrado: ${client.clientGroupId}`);
        createdCount++;
      } catch (error) {
        console.log(`  ⚠️ Grupo cliente ya existía, omitiendo`);
        skippedCount++;
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 RESUMEN DE MIGRACIÓN");
  console.log("=".repeat(50));
  console.log(`  Clientes procesados: ${clients.length}`);
  console.log(`  Recipients creados: ${createdCount}`);
  console.log(`  Omitidos (duplicados): ${skippedCount}`);
  console.log("=".repeat(50));

  // Verificación final
  const totalRecipients = await prisma.telegramRecipient.count();
  console.log(`\n✅ Total de TelegramRecipients en la base de datos: ${totalRecipients}`);

  // Mostrar resumen por tipo
  const byType = await prisma.telegramRecipient.groupBy({
    by: ["type"],
    _count: { id: true },
  });

  console.log("\n📈 Distribución por tipo:");
  for (const t of byType) {
    const typeLabels: Record<string, string> = {
      AGENCY_INTERNAL: "Interno (Agencia)",
      CLIENT_GROUP: "Grupo Cliente",
      CLIENT_INDIVIDUAL: "Individual Cliente",
    };
    console.log(`  ${typeLabels[t.type] || t.type}: ${t._count.id}`);
  }

  console.log("\n🎉 Migración completada exitosamente!");
  console.log("\n⚠️ NOTA: Los campos legacy (telegramGroupId, clientGroupId)");
  console.log("   se mantienen por compatibilidad. Puedes eliminarlos");
  console.log("   después de verificar que todo funciona correctamente.\n");
}

main()
  .catch((e) => {
    console.error("❌ Error durante la migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
