/**
 * Worker de auto-archivado: mueve menciones y menciones sociales viejas a historial.
 * Ejecuta diariamente a las 3:00 AM.
 */
import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma, config } from "@mediabot/shared";

export function startArchiveWorker() {
  const worker = new Worker(
    QUEUE_NAMES.ARCHIVE_OLD_MENTIONS,
    async () => {
      const maxAgeDays = config.articles.maxAgeDays;
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

      console.log(`[Archive] Archivando menciones anteriores a ${cutoff.toISOString().split("T")[0]} (${maxAgeDays} días)...`);

      // Archivar Mentions: por publishedAt del artículo, o por createdAt si no tiene publishedAt
      const mentionsResult = await prisma.$executeRaw`
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

      // Archivar SocialMentions: por postedAt, o por createdAt si no tiene postedAt
      const socialResult = await prisma.$executeRaw`
        UPDATE "SocialMention"
        SET "isLegacy" = true
        WHERE "isLegacy" = false
          AND (
            ("postedAt" IS NOT NULL AND "postedAt" < ${cutoff})
            OR ("postedAt" IS NULL AND "createdAt" < ${cutoff})
          )
      `;

      console.log(`[Archive] Archivadas: ${mentionsResult} menciones noticias, ${socialResult} menciones sociales`);
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Archive] Job ${job?.id} failed:`, err.message);
  });

  console.log("📦 Archive worker started");
}
