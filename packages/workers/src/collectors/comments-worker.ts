/**
 * Worker para extracción de comentarios de posts de Instagram y TikTok.
 *
 * Procesa la cola EXTRACT_COMMENTS para extraer comentarios bajo demanda.
 * Los comentarios se guardan en commentsData del SocialMention y se
 * encola el análisis de sentimiento de los comentarios.
 */

import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { prisma, config, getEnsembleDataClient } from "@mediabot/shared";
import type { SocialComment } from "@mediabot/shared";

interface ExtractCommentsJobData {
  mentionId: string;
  maxComments?: number;
}

/**
 * Extrae el shortcode de una URL de Instagram.
 * Formato: https://instagram.com/p/SHORTCODE
 */
function extractInstagramShortcode(postUrl: string): string | null {
  const match = postUrl.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Extrae el ID del video de una URL de TikTok.
 * Formato: https://tiktok.com/@user/video/VIDEO_ID
 */
function extractTikTokVideoId(postUrl: string): string | null {
  const match = postUrl.match(/video\/(\d+)/);
  return match ? match[1] : null;
}

export function startCommentsExtractionWorker() {
  const analyzeQueue = getQueue(QUEUE_NAMES.ANALYZE_SOCIAL);

  const worker = new Worker(
    QUEUE_NAMES.EXTRACT_COMMENTS,
    async (job) => {
      const { mentionId, maxComments } = job.data as ExtractCommentsJobData;

      // Verificar si la feature está habilitada
      if (!config.socialComments.enabled) {
        console.log(`[CommentsWorker] Feature disabled, skipping mention ${mentionId}`);
        return { skipped: true, reason: "feature_disabled" };
      }

      const mention = await prisma.socialMention.findUnique({
        where: { id: mentionId },
        include: { client: { select: { id: true, name: true } } },
      });

      if (!mention) {
        console.log(`[CommentsWorker] Mention ${mentionId} not found`);
        return { skipped: true, reason: "not_found" };
      }

      // Si ya tiene comentarios extraídos recientemente (menos de 1 hora), omitir
      if (mention.commentsExtractedAt) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (mention.commentsExtractedAt > hourAgo) {
          console.log(`[CommentsWorker] Mention ${mentionId} already has recent comments, skipping`);
          return { skipped: true, reason: "already_extracted" };
        }
      }

      console.log(`[CommentsWorker] Extracting comments for ${mention.platform} mention ${mentionId}`);

      const client = getEnsembleDataClient();
      if (!client.isConfigured()) {
        console.error(`[CommentsWorker] EnsembleData client not configured`);
        return { error: "api_not_configured" };
      }

      let comments: SocialComment[] = [];

      try {
        switch (mention.platform) {
          case "TIKTOK": {
            // Extraer ID del video de la URL
            const videoId = extractTikTokVideoId(mention.postUrl) || mention.postId;
            comments = await client.getTikTokPostComments(
              videoId,
              maxComments || config.socialComments.tiktokMaxComments
            );
            break;
          }

          case "INSTAGRAM": {
            // Usar el postId (media_id numérico) directamente
            comments = await client.getInstagramPostComments(
              mention.postId,
              maxComments || config.socialComments.instagramMaxComments
            );
            break;
          }

          case "TWITTER":
            // Twitter no tiene endpoint de comentarios en EnsembleData
            console.log(`[CommentsWorker] Twitter comments not supported`);
            return { skipped: true, reason: "platform_not_supported" };

          default:
            console.log(`[CommentsWorker] Unknown platform: ${mention.platform}`);
            return { skipped: true, reason: "unknown_platform" };
        }

        // Guardar comentarios en la DB
        await prisma.socialMention.update({
          where: { id: mentionId },
          data: {
            commentsData: comments as unknown as object[],
            commentsCount: comments.length,
            commentsExtractedAt: new Date(),
            commentsAnalyzed: false, // Marca para análisis pendiente
          },
        });

        console.log(
          `[CommentsWorker] Saved ${comments.length} comments for mention ${mentionId}`
        );

        // Encolar análisis de comentarios si hay suficientes
        if (comments.length > 0) {
          await analyzeQueue.add(
            "analyze-comments",
            {
              mentionId,
              hasComments: true,
            },
            {
              jobId: `analyze-comments-${mentionId}`,
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
            }
          );
          console.log(`[CommentsWorker] Enqueued comments analysis for mention ${mentionId}`);
        }

        return {
          success: true,
          commentsExtracted: comments.length,
          platform: mention.platform,
        };
      } catch (error) {
        console.error(`[CommentsWorker] Error extracting comments:`, error);
        throw error; // Re-throw para que BullMQ maneje el retry
      }
    },
    {
      connection,
      concurrency: 2, // Limitar concurrencia para evitar rate limiting
      limiter: {
        max: 10, // Máximo 10 extracciones por minuto
        duration: 60000,
      },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[CommentsWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job, result) => {
    if (result?.success) {
      console.log(
        `[CommentsWorker] Job ${job?.id} completed: ${result.commentsExtracted} comments extracted`
      );
    }
  });

  console.log(`💬 Comments extraction worker started`);
}
