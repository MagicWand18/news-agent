/**
 * Collector de redes sociales usando EnsembleData API.
 *
 * Recolecta menciones de Twitter, Instagram y TikTok para clientes
 * que tienen socialMonitoringEnabled = true.
 *
 * Sources monitoreadas:
 * - HANDLE: Posts de cuentas específicas (propias o competidores)
 * - HASHTAG: Posts que usan hashtags monitoreados
 * - KEYWORD: Búsqueda por keywords del cliente
 */

import {
  prisma,
  getEnsembleDataClient,
  config,
  type SocialPost,
} from "@mediabot/shared";
import { publishRealtimeEvent } from "@mediabot/shared/src/realtime-publisher.js";
import { REALTIME_CHANNELS } from "@mediabot/shared/src/realtime-types.js";
import { getQueue, QUEUE_NAMES } from "../queues.js";
import type { SocialPlatform as PrismaSocialPlatform } from "@prisma/client";

// Delay entre llamadas a la API para respetar rate limits
const API_DELAY_MS = 500;

// Máximo de posts a recolectar por fuente
const MAX_POSTS_PER_SOURCE = 20;

// Máxima antigüedad de posts a recolectar (en días)
const MAX_AGE_DAYS = config.social.maxAgeDays;

interface CollectionStats {
  clientsProcessed: number;
  totalHandles: number;
  totalHashtags: number;
  totalKeywords: number;
  postsCollected: number;
  postsNew: number;
  errors: number;
}

/**
 * Collector principal de redes sociales.
 * Ejecuta la recolección para todos los clientes con monitoreo social habilitado.
 */
export async function collectSocial(): Promise<CollectionStats> {
  const client = getEnsembleDataClient();

  // Verificar que la API está configurada
  if (!client.isConfigured()) {
    console.log("[Social] EnsembleData not configured, skipping collection");
    return {
      clientsProcessed: 0,
      totalHandles: 0,
      totalHashtags: 0,
      totalKeywords: 0,
      postsCollected: 0,
      postsNew: 0,
      errors: 0,
    };
  }

  // Obtener clientes con monitoreo social habilitado
  const clients = await prisma.client.findMany({
    where: {
      active: true,
      socialMonitoringEnabled: true,
    },
    include: {
      socialAccounts: {
        where: { active: true },
      },
      keywords: {
        where: { active: true },
        select: { word: true, type: true },
      },
    },
  });

  if (clients.length === 0) {
    console.log("[Social] No clients with social monitoring enabled");
    return {
      clientsProcessed: 0,
      totalHandles: 0,
      totalHashtags: 0,
      totalKeywords: 0,
      postsCollected: 0,
      postsNew: 0,
      errors: 0,
    };
  }

  console.log(`[Social] Processing ${clients.length} clients with social monitoring`);

  const stats: CollectionStats = {
    clientsProcessed: 0,
    totalHandles: 0,
    totalHashtags: 0,
    totalKeywords: 0,
    postsCollected: 0,
    postsNew: 0,
    errors: 0,
  };

  for (const clientData of clients) {
    console.log(`[Social] Processing client: ${clientData.name}`);

    try {
      // 1. Recolectar por cuentas monitoreadas (handles)
      for (const account of clientData.socialAccounts) {
        stats.totalHandles++;
        await delay(API_DELAY_MS);

        try {
          const posts = await collectFromHandle(client, account.platform, account.handle, null);
          const newPosts = await savePosts(
            posts,
            clientData.id,
            "HANDLE",
            account.handle,
            clientData.orgId ?? null
          );
          stats.postsCollected += posts.length;
          stats.postsNew += newPosts;
          console.log(`  Handle @${account.handle} (${account.platform}): ${posts.length} posts, ${newPosts} new`);
        } catch (error) {
          stats.errors++;
          console.error(`  Error collecting @${account.handle}:`, error instanceof Error ? error.message : error);
        }
      }

      // 2. Recolectar por hashtags
      const hashtags = clientData.socialHashtags || [];
      for (const hashtag of hashtags) {
        stats.totalHashtags++;
        await delay(API_DELAY_MS);

        try {
          // Buscar en todas las plataformas
          const posts = await collectFromHashtag(client, hashtag);
          const newPosts = await savePosts(posts, clientData.id, "HASHTAG", hashtag, clientData.orgId ?? null);
          stats.postsCollected += posts.length;
          stats.postsNew += newPosts;
          console.log(`  Hashtag #${hashtag}: ${posts.length} posts, ${newPosts} new`);
        } catch (error) {
          stats.errors++;
          console.error(`  Error collecting #${hashtag}:`, error instanceof Error ? error.message : error);
        }
      }

      // 3. Recolectar por keywords (solo NAME y BRAND para evitar ruido)
      const keywordsToSearch = clientData.keywords
        .filter((k) => ["NAME", "BRAND"].includes(k.type))
        .map((k) => k.word);

      for (const keyword of keywordsToSearch.slice(0, 5)) { // Limitar a 5 keywords
        stats.totalKeywords++;
        await delay(API_DELAY_MS);

        try {
          const posts = await collectFromKeyword(client, keyword);
          const newPosts = await savePosts(posts, clientData.id, "KEYWORD", keyword, clientData.orgId ?? null);
          stats.postsCollected += posts.length;
          stats.postsNew += newPosts;
          console.log(`  Keyword "${keyword}": ${posts.length} posts, ${newPosts} new`);
        } catch (error) {
          stats.errors++;
          console.error(`  Error collecting "${keyword}":`, error instanceof Error ? error.message : error);
        }
      }

      stats.clientsProcessed++;
    } catch (error) {
      stats.errors++;
      console.error(`[Social] Error processing client ${clientData.name}:`, error);
    }
  }

  console.log(`[Social] Collection complete:`, stats);
  return stats;
}

/**
 * Recolecta posts de un handle específico.
 * Nota: EnsembleData siempre requiere username, no soporta búsqueda por ID.
 */
async function collectFromHandle(
  client: ReturnType<typeof getEnsembleDataClient>,
  platform: PrismaSocialPlatform,
  handle: string,
  _platformUserId: string | null,
  maxPosts: number = MAX_POSTS_PER_SOURCE,
  maxAgeDays: number = MAX_AGE_DAYS
): Promise<SocialPost[]> {
  switch (platform) {
    case "TWITTER":
      return client.getTwitterUserTweets(handle, maxPosts, maxAgeDays);
    case "INSTAGRAM":
      return client.getInstagramUserPosts(handle, maxPosts, maxAgeDays);
    case "TIKTOK":
      return client.getTikTokUserPosts(handle, maxPosts, maxAgeDays);
    case "YOUTUBE": {
      // Resolver username → channelId
      const channelId = await client.getYouTubeChannelIdFromUsername(handle);
      if (!channelId) {
        console.log(`[Social] YouTube channel not found for username: ${handle}`);
        return [];
      }
      return client.getYouTubeChannelVideos(channelId, maxPosts, maxAgeDays);
    }
    default:
      return [];
  }
}

/**
 * Recolecta posts por hashtag en las plataformas especificadas.
 */
async function collectFromHashtag(
  client: ReturnType<typeof getEnsembleDataClient>,
  hashtag: string,
  platforms?: PrismaSocialPlatform[],
  maxPosts: number = MAX_POSTS_PER_SOURCE,
  maxAgeDays: number = MAX_AGE_DAYS
): Promise<SocialPost[]> {
  const posts: SocialPost[] = [];
  const shouldCollect = (p: PrismaSocialPlatform) => !platforms || platforms.includes(p);

  // Instagram
  if (shouldCollect("INSTAGRAM")) {
    try {
      const igPosts = await client.searchInstagramHashtag(hashtag, maxPosts, maxAgeDays);
      posts.push(...igPosts);
    } catch (error) {
      console.error(`  [Instagram hashtag error]:`, error instanceof Error ? error.message : error);
    }
    await delay(API_DELAY_MS);
  }

  // TikTok
  if (shouldCollect("TIKTOK")) {
    try {
      const ttPosts = await client.searchTikTokHashtag(hashtag, maxPosts, maxAgeDays);
      posts.push(...ttPosts);
    } catch (error) {
      console.error(`  [TikTok hashtag error]:`, error instanceof Error ? error.message : error);
    }
  }

  return posts;
}

/**
 * Recolecta posts por keyword usando búsqueda.
 */
async function collectFromKeyword(
  client: ReturnType<typeof getEnsembleDataClient>,
  keyword: string,
  maxAgeDays: number = MAX_AGE_DAYS
): Promise<SocialPost[]> {
  const posts: SocialPost[] = [];

  // Twitter search (no soporta keyword search en EnsembleData)
  try {
    const tweets = await client.searchTwitter(keyword, MAX_POSTS_PER_SOURCE);
    posts.push(...tweets);
  } catch (error) {
    console.error(`  [Twitter search error]:`, error instanceof Error ? error.message : error);
  }

  await delay(API_DELAY_MS);

  // TikTok search
  try {
    const ttPosts = await client.searchTikTok(keyword, MAX_POSTS_PER_SOURCE, maxAgeDays);
    posts.push(...ttPosts);
  } catch (error) {
    console.error(`  [TikTok search error]:`, error instanceof Error ? error.message : error);
  }

  await delay(API_DELAY_MS);

  // YouTube search
  try {
    const ytPosts = await client.searchYouTube(keyword, MAX_POSTS_PER_SOURCE, maxAgeDays);
    posts.push(...ytPosts);
  } catch (error) {
    console.error(`  [YouTube search error]:`, error instanceof Error ? error.message : error);
  }

  return posts;
}

/**
 * Guarda posts en la base de datos evitando duplicados.
 * Retorna el número de posts nuevos creados.
 */
async function savePosts(
  posts: SocialPost[],
  clientId: string,
  sourceType: "HANDLE" | "HASHTAG" | "KEYWORD",
  sourceValue: string,
  orgId: string | null = null
): Promise<number> {
  let newCount = 0;

  for (const post of posts) {
    try {
      // Upsert para evitar duplicados por platform + postId
      const existing = await prisma.socialMention.findUnique({
        where: {
          platform_postId: {
            platform: post.platform as PrismaSocialPlatform,
            postId: post.postId,
          },
        },
      });

      if (existing) {
        // Actualizar métricas si ya existe
        await prisma.socialMention.update({
          where: { id: existing.id },
          data: {
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            views: post.views,
            updatedAt: new Date(),
          },
        });
      } else {
        // Crear nueva mención
        const created = await prisma.socialMention.create({
          data: {
            clientId,
            platform: post.platform as PrismaSocialPlatform,
            postId: post.postId,
            postUrl: post.postUrl,
            content: post.content,
            authorHandle: post.authorHandle,
            authorName: post.authorName,
            authorFollowers: post.authorFollowers,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            views: post.views,
            sourceType,
            sourceValue,
            postedAt: post.postedAt,
          },
        });
        newCount++;

        // Publicar evento realtime
        publishRealtimeEvent(REALTIME_CHANNELS.SOCIAL_NEW, {
          id: created.id,
          clientId,
          orgId,
          title: post.content?.slice(0, 100),
          platform: post.platform,
          source: post.authorHandle,
          timestamp: new Date().toISOString(),
        });

        // Encolar extracción de topic para la social mention (Sprint 19)
        try {
          const socialTopicQueue = getQueue(QUEUE_NAMES.ANALYZE_SOCIAL_TOPIC);
          await socialTopicQueue.add("extract-social-topic", {
            socialMentionId: created.id,
          }, {
            delay: 2000, // Pequeño delay para no saturar
            attempts: 2,
            backoff: { type: "exponential", delay: 5000 },
          });
        } catch {
          // No bloquear el flujo si falla el enqueue
        }
      }
    } catch (error) {
      // Ignorar errores de duplicados (race condition)
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        continue;
      }
      console.error(`  Error saving post ${post.postId}:`, error);
    }
  }

  return newCount;
}

/**
 * Helper para delays entre llamadas API.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Opciones para recolección de menciones sociales.
 */
export interface CollectSocialOptions {
  platforms?: PrismaSocialPlatform[]; // Si no se especifica, recolecta todas
  collectHandles?: boolean; // Default: true
  collectHashtags?: boolean; // Default: true
  maxPostsPerSource?: number; // Default: MAX_POSTS_PER_SOURCE (20)
  maxAgeDays?: number; // Default: MAX_AGE_DAYS de config
}

/**
 * Recolecta menciones sociales para un cliente específico.
 * Útil para ejecución manual o on-demand.
 */
export async function collectSocialForClient(
  clientId: string,
  options: CollectSocialOptions = {}
): Promise<{
  postsCollected: number;
  postsNew: number;
  errors: number;
}> {
  const {
    platforms,
    collectHandles = true,
    collectHashtags = true,
    maxPostsPerSource: maxPosts = MAX_POSTS_PER_SOURCE,
    maxAgeDays = MAX_AGE_DAYS,
  } = options;

  const apiClient = getEnsembleDataClient();

  if (!apiClient.isConfigured()) {
    throw new Error("EnsembleData not configured");
  }

  const clientData = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      socialAccounts: { where: { active: true } },
      keywords: { where: { active: true }, select: { word: true, type: true } },
    },
  });

  if (!clientData) {
    throw new Error("Client not found");
  }

  let postsCollected = 0;
  let postsNew = 0;
  let errors = 0;

  // Handles (filtrar por plataformas si se especifica)
  if (collectHandles) {
    const accountsToProcess = platforms
      ? clientData.socialAccounts.filter((a) => platforms.includes(a.platform))
      : clientData.socialAccounts;

    for (const account of accountsToProcess) {
      await delay(API_DELAY_MS);
      try {
        const posts = await collectFromHandle(apiClient, account.platform, account.handle, null, maxPosts, maxAgeDays);
        const newPosts = await savePosts(posts, clientId, "HANDLE", account.handle, clientData.orgId ?? null);
        postsCollected += posts.length;
        postsNew += newPosts;
        console.log(`  Handle @${account.handle} (${account.platform}): ${posts.length} posts, ${newPosts} new`);
      } catch (error) {
        errors++;
        console.error(`  Error collecting @${account.handle}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // Hashtags (buscar en las plataformas especificadas o todas)
  if (collectHashtags) {
    for (const hashtag of clientData.socialHashtags || []) {
      await delay(API_DELAY_MS);
      try {
        const posts = await collectFromHashtag(apiClient, hashtag, platforms, maxPosts, maxAgeDays);
        const newPosts = await savePosts(posts, clientId, "HASHTAG", hashtag, clientData.orgId ?? null);
        postsCollected += posts.length;
        postsNew += newPosts;
        console.log(`  Hashtag #${hashtag}: ${posts.length} posts, ${newPosts} new`);
      } catch (error) {
        errors++;
        console.error(`  Error collecting #${hashtag}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  return { postsCollected, postsNew, errors };
}
