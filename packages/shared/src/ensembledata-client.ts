/**
 * Cliente para la API de EnsembleData
 * Documentación: https://ensembledata.com/apis
 *
 * Soporta:
 * - Twitter (X): Búsqueda, timeline de usuario, detalles de usuario
 * - Instagram: Posts de usuario, búsqueda por hashtag
 * - TikTok: Posts de usuario, búsqueda por hashtag/keyword
 */

import { config } from "./config";

// ==================== TIPOS ====================

export type SocialPlatform = "TWITTER" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";

export interface EnsembleDataConfig {
  token: string;
  baseUrl: string;
}

// Twitter Types
export interface TwitterSearchResult {
  id: string;
  text: string;
  created_at: string;
  author: {
    id: string;
    username: string;
    name: string;
    followers_count: number;
  };
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    impression_count?: number;
  };
}

export interface TwitterUserInfo {
  id: string;
  username: string;
  name: string;
  description?: string;
  followers_count: number;
  following_count: number;
  tweet_count: number;
  verified?: boolean;
}

// Instagram Types - Estructura real de EnsembleData API
export interface InstagramPost {
  id: string;
  shortcode: string;
  edge_media_to_caption?: {
    edges: Array<{ node: { text: string } }>;
  };
  taken_at_timestamp?: number;
  owner: {
    id: string;
    username: string;
  };
  edge_liked_by?: { count: number };
  edge_media_preview_like?: { count: number };
  edge_media_to_comment?: { count: number };
  video_view_count?: number;
  is_video: boolean;
}

// Wrapper para la respuesta de posts de usuario
interface InstagramPostWrapper {
  node: InstagramPost;
}

export interface InstagramUserInfo {
  id: string;
  username: string;
  full_name?: string;
  biography?: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  is_verified: boolean;
}

// TikTok Types
export interface TikTokPost {
  id: string;
  desc: string;
  createTime: number;
  author: {
    id: string;
    uniqueId: string;
    nickname: string;
    followerCount?: number;
  };
  stats: {
    diggCount: number;
    commentCount: number;
    shareCount: number;
    playCount: number;
  };
}

export interface TikTokUserInfo {
  id: string;
  uniqueId: string;
  nickname: string;
  signature?: string;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  verified: boolean;
}

// Comment Types for extraction
export interface TikTokComment {
  cid: string;
  text: string;
  create_time: number;
  digg_count: number;
  reply_comment_total?: number;
  user: {
    unique_id: string;
    nickname: string;
  };
}

export interface InstagramComment {
  pk: string;
  text: string;
  created_at: number;
  comment_like_count: number;
  user: {
    username: string;
    full_name?: string;
  };
}

// YouTube Types
export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedTime: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  channelId: string;
  channelTitle: string;
}

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  subscriberCount: number;
  videoCount: number;
  description: string;
}

export interface YouTubeComment {
  commentId: string;
  text: string;
  authorDisplayName: string;
  authorChannelUrl: string;
  likeCount: number;
  publishedAt: string;
  totalReplyCount: number;
}

// Normalized comment structure
export interface SocialComment {
  commentId: string;
  text: string;
  authorHandle: string;
  authorName: string | null;
  likes: number;
  replies: number;
  postedAt: Date | null;
}

// Unified Response
export interface SocialPost {
  platform: SocialPlatform;
  postId: string;
  postUrl: string;
  content: string | null;
  authorHandle: string;
  authorName: string | null;
  authorFollowers: number | null;
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
  postedAt: Date | null;
}

export interface EnsembleDataResponse<T> {
  data: T;
  units_charged: number;
}

// ==================== HELPERS ====================

/**
 * Calcula un Unix timestamp restando N días desde ahora.
 */
function daysAgoTimestamp(days: number): number {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
}

/**
 * Filtra posts que sean más antiguos que maxAgeDays.
 * Necesario porque las APIs devuelven bloques completos que pueden
 * incluir posts fuera del rango solicitado.
 */
function filterOldPosts(posts: SocialPost[], maxAgeDays: number): SocialPost[] {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return posts.filter((p) => {
    if (!p.postedAt) return true; // Mantener si no tiene fecha
    return p.postedAt >= cutoff;
  });
}

/**
 * Parsea tiempo relativo de YouTube ("3 hours ago", "4 days ago", "9 months ago", "1 year ago")
 * a una fecha aproximada.
 */
function parseRelativeTime(text: string): Date | null {
  if (!text) return null;
  const match = text.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const now = Date.now();
  const ms: Record<string, number> = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };

  return new Date(now - amount * (ms[unit] || 0));
}

/**
 * Parsea conteo formateado de YouTube ("12 views", "177,220 views", "177K views", "1.2M views")
 * a un número.
 */
function parseFormattedCount(text: string): number | null {
  if (!text) return null;
  // Extraer la parte numérica
  const match = text.match(/([\d,.]+)\s*([KMB]?)/i);
  if (!match) return null;

  const num = parseFloat(match[1].replace(/,/g, ""));
  const suffix = match[2].toUpperCase();
  const multipliers: Record<string, number> = { K: 1000, M: 1000000, B: 1000000000 };

  return Math.round(num * (multipliers[suffix] || 1));
}

// ==================== CLIENTE ====================

class EnsembleDataClient {
  private token: string;
  private baseUrl: string;

  constructor(cfg?: EnsembleDataConfig) {
    this.token = cfg?.token || config.ensembledata.token;
    this.baseUrl = cfg?.baseUrl || config.ensembledata.baseUrl;
  }

  /**
   * Verifica si el cliente está configurado correctamente.
   */
  isConfigured(): boolean {
    return Boolean(this.token);
  }

  /**
   * Hace una petición a la API de EnsembleData.
   */
  private async request<T>(endpoint: string, params: Record<string, string | number | boolean>): Promise<EnsembleDataResponse<T>> {
    if (!this.isConfigured()) {
      throw new Error("EnsembleData token not configured");
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set("token", this.token);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    console.log(`[EnsembleData] Request: ${endpoint}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EnsembleData] Error ${response.status}: ${errorText}`);
      throw new Error(`EnsembleData API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as EnsembleDataResponse<T>;
    console.log(`[EnsembleData] Response OK, units charged: ${data.units_charged || 0}`);

    // Logging diagnóstico para endpoints TikTok
    if (endpoint.startsWith("/tt/")) {
      const rawKeys = Object.keys((data?.data as Record<string, unknown>) || {});
      console.log(`[EnsembleData] TikTok ${endpoint} response data keys:`, rawKeys.slice(0, 10));
    }

    return data;
  }

  // ==================== TWITTER ====================

  /**
   * Busca tweets por keyword.
   * Nota: EnsembleData no tiene búsqueda por keyword para Twitter,
   * solo permite obtener tweets de usuarios específicos.
   * Este método retorna array vacío.
   */
  async searchTwitter(query: string, maxResults: number = 20): Promise<SocialPost[]> {
    // La API de EnsembleData no soporta búsqueda por keyword en Twitter
    // Solo permite obtener tweets de usuarios específicos
    console.log(`[EnsembleData] Twitter keyword search not supported, skipping: ${query}`);
    return [];
  }

  /**
   * Obtiene tweets recientes de un usuario por username.
   * Primero obtiene el ID del usuario, luego sus tweets.
   * Endpoint: /twitter/user/tweets requiere id numérico
   *
   * @param maxAgeDays - Filtra tweets más viejos que N días (post-fetch, la API no soporta filtro nativo)
   */
  async getTwitterUserTweets(username: string, maxResults: number = 20, maxAgeDays?: number): Promise<SocialPost[]> {
    const userInfo = await this.getTwitterUser(username);
    if (!userInfo?.id) {
      console.log(`[EnsembleData] Could not get Twitter user ID for: ${username}`);
      return [];
    }
    return this.getTwitterUserTweetsById(userInfo.id, maxResults, maxAgeDays);
  }

  /**
   * Obtiene tweets recientes de un usuario por ID numérico.
   * Endpoint: /twitter/user/tweets con parámetro id=
   * Nota: La API no tiene filtro de fecha nativo, se filtra post-fetch.
   */
  async getTwitterUserTweetsById(userId: string, maxResults: number = 20, maxAgeDays?: number): Promise<SocialPost[]> {
    try {
      const response = await this.request<{ data: TwitterSearchResult[] }>("/twitter/user/tweets", {
        id: userId,
      });

      const tweets = response.data?.data || [];
      let posts = tweets.slice(0, maxResults).map((tweet) => this.normalizeTwitterPost(tweet));

      if (maxAgeDays) {
        const before = posts.length;
        posts = filterOldPosts(posts, maxAgeDays);
        if (before !== posts.length) {
          console.log(`[EnsembleData] Twitter: filtrados ${before - posts.length} tweets antiguos (>${maxAgeDays}d)`);
        }
      }

      return posts;
    } catch (error) {
      console.error(`[EnsembleData] Error getting tweets for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Obtiene información de un usuario de Twitter.
   * Endpoint: /twitter/user/info con parámetro name=
   */
  async getTwitterUser(username: string): Promise<TwitterUserInfo | null> {
    try {
      const response = await this.request<TwitterUserInfo>("/twitter/user/info", {
        name: username, // La API usa 'name' no 'username'
      });
      return response.data || null;
    } catch {
      return null;
    }
  }

  private normalizeTwitterPost(tweet: TwitterSearchResult): SocialPost {
    return {
      platform: "TWITTER",
      postId: tweet.id,
      postUrl: `https://twitter.com/${tweet.author.username}/status/${tweet.id}`,
      content: tweet.text,
      authorHandle: tweet.author.username,
      authorName: tweet.author.name,
      authorFollowers: tweet.author.followers_count,
      likes: tweet.public_metrics.like_count,
      comments: tweet.public_metrics.reply_count,
      shares: tweet.public_metrics.retweet_count + (tweet.public_metrics.quote_count || 0),
      views: tweet.public_metrics.impression_count || null,
      postedAt: tweet.created_at ? new Date(tweet.created_at) : null,
    };
  }

  // ==================== INSTAGRAM ====================

  /**
   * Obtiene posts de un usuario de Instagram por username.
   * Primero obtiene el ID del usuario, luego sus posts.
   * Endpoint: /instagram/user/posts requiere user_id=
   *
   * @param maxAgeDays - Usa oldest_timestamp para no traer posts más viejos que N días
   */
  async getInstagramUserPosts(username: string, maxResults: number = 12, maxAgeDays?: number): Promise<SocialPost[]> {
    const userInfo = await this.getInstagramUser(username);
    if (!userInfo?.id) {
      console.log(`[EnsembleData] Could not get Instagram user ID for: ${username}`);
      return [];
    }
    return this.getInstagramUserPostsById(userInfo.id, maxResults, maxAgeDays);
  }

  /**
   * Obtiene posts de un usuario de Instagram por ID numérico.
   * Endpoint: /instagram/user/posts con parámetro user_id= y oldest_timestamp=
   * Nota: oldest_timestamp indica cuándo dejar de buscar, pero el último bloque
   * puede incluir posts fuera del rango. Se filtra post-fetch.
   */
  async getInstagramUserPostsById(userId: string, maxResults: number = 12, maxAgeDays?: number): Promise<SocialPost[]> {
    try {
      const params: Record<string, string | number | boolean> = {
        user_id: userId,
        depth: 1,
      };

      if (maxAgeDays) {
        params.oldest_timestamp = daysAgoTimestamp(maxAgeDays);
      }

      const response = await this.request<{ posts: InstagramPostWrapper[] }>("/instagram/user/posts", params);

      const rawPosts = response.data?.posts || [];
      let posts = rawPosts.slice(0, maxResults).map((wrapper) => this.normalizeInstagramPost(wrapper.node));

      // Filtro post-fetch: la API puede devolver posts fuera del rango en el último bloque
      if (maxAgeDays) {
        const before = posts.length;
        posts = filterOldPosts(posts, maxAgeDays);
        if (before !== posts.length) {
          console.log(`[EnsembleData] Instagram: filtrados ${before - posts.length} posts antiguos (>${maxAgeDays}d)`);
        }
      }

      return posts;
    } catch (error) {
      console.error(`[EnsembleData] Error getting posts for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Busca posts por hashtag en Instagram.
   * Endpoint: /instagram/hashtag/posts con parámetro name=
   * Nota: Este endpoint no tiene filtro de fecha nativo, se filtra post-fetch.
   */
  async searchInstagramHashtag(hashtag: string, maxResults: number = 20, maxAgeDays?: number): Promise<SocialPost[]> {
    const cleanHashtag = hashtag.replace(/^#/, "");

    try {
      const response = await this.request<{ posts: InstagramPostWrapper[] }>("/instagram/hashtag/posts", {
        name: cleanHashtag,
      });
      const rawPosts = response.data?.posts || [];
      let posts = rawPosts.slice(0, maxResults).map((wrapper) => this.normalizeInstagramPost(wrapper.node));

      if (maxAgeDays) {
        const before = posts.length;
        posts = filterOldPosts(posts, maxAgeDays);
        if (before !== posts.length) {
          console.log(`[EnsembleData] IG hashtag #${cleanHashtag}: filtrados ${before - posts.length} posts antiguos (>${maxAgeDays}d)`);
        }
      }

      return posts;
    } catch {
      console.log(`[EnsembleData] Instagram hashtag search not available: ${cleanHashtag}`);
      return [];
    }
  }

  /**
   * Obtiene información de un usuario de Instagram.
   * Endpoint: /instagram/user/info con parámetro username=
   */
  async getInstagramUser(username: string): Promise<InstagramUserInfo | null> {
    try {
      // La respuesta viene en data.pk como ID
      const response = await this.request<{ pk: string; username: string; full_name: string; is_private: boolean; follower_count?: number; following_count?: number; media_count?: number }>("/instagram/user/info", {
        username,
      });
      const userData = response.data;
      if (!userData?.pk) return null;

      return {
        id: userData.pk,
        username: userData.username,
        full_name: userData.full_name,
        follower_count: userData.follower_count || 0,
        following_count: userData.following_count || 0,
        media_count: userData.media_count || 0,
        is_verified: false, // No viene en la respuesta básica
      };
    } catch {
      return null;
    }
  }

  private normalizeInstagramPost(post: InstagramPost): SocialPost {
    // Extraer caption de la estructura anidada
    const caption = post.edge_media_to_caption?.edges?.[0]?.node?.text || null;
    // Likes pueden venir en diferentes campos
    const likes = post.edge_liked_by?.count || post.edge_media_preview_like?.count || 0;
    const comments = post.edge_media_to_comment?.count || 0;

    return {
      platform: "INSTAGRAM",
      postId: post.id,
      postUrl: `https://instagram.com/p/${post.shortcode}`,
      content: caption,
      authorHandle: post.owner.username,
      authorName: null, // No viene en la respuesta de posts
      authorFollowers: null, // No viene en la respuesta de posts
      likes,
      comments,
      shares: 0, // Instagram no tiene shares públicos
      views: post.video_view_count || null,
      postedAt: post.taken_at_timestamp ? new Date(post.taken_at_timestamp * 1000) : null,
    };
  }

  // ==================== TIKTOK ====================

  /**
   * Obtiene posts de un usuario de TikTok.
   * Endpoint: /tt/user/posts con parámetro username= y oldest_createtime=
   *
   * @param maxAgeDays - Usa oldest_createtime para detener la búsqueda en posts más viejos que N días.
   *   Nota: el último bloque puede incluir posts fuera del rango, se filtra post-fetch.
   */
  async getTikTokUserPosts(username: string, maxResults: number = 20, maxAgeDays?: number): Promise<SocialPost[]> {
    try {
      const params: Record<string, string | number | boolean> = {
        username,
        depth: "1",
      };

      if (maxAgeDays) {
        params.oldest_createtime = daysAgoTimestamp(maxAgeDays);
      }

      const response = await this.request<Record<string, unknown>>("/tt/user/posts", params);

      const rawData = response.data as Record<string, unknown>;
      console.log(`[EnsembleData] TikTok user posts keys:`, Object.keys(rawData || {}));
      const rawPosts = ((rawData?.data || rawData?.aweme_list || (Array.isArray(rawData) ? rawData : [])) as TikTokPost[]);
      let posts = rawPosts.slice(0, maxResults).map((post) => this.normalizeTikTokPost(post));

      if (maxAgeDays) {
        const before = posts.length;
        posts = filterOldPosts(posts, maxAgeDays);
        if (before !== posts.length) {
          console.log(`[EnsembleData] TikTok @${username}: filtrados ${before - posts.length} posts antiguos (>${maxAgeDays}d)`);
        }
      }

      return posts;
    } catch (error) {
      console.error(`[EnsembleData] Error getting TikTok posts for ${username}:`, error);
      return [];
    }
  }

  /**
   * Busca posts por hashtag en TikTok.
   * Usa /tt/hashtag/recent-posts con parámetro days= para filtrar por fecha.
   * Fallback a /tt/hashtag/posts si no se especifica maxAgeDays.
   */
  async searchTikTokHashtag(hashtag: string, maxResults: number = 20, maxAgeDays?: number): Promise<SocialPost[]> {
    const cleanHashtag = hashtag.replace(/^#/, "");

    try {
      if (maxAgeDays) {
        // /tt/hashtag/recent-posts tiene estructura diferente: data.posts[].{authorInfos, itemInfos}
        const response = await this.request<Record<string, unknown>>("/tt/hashtag/recent-posts", {
          name: cleanHashtag,
          days: maxAgeDays,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawData = response.data as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawPosts = (rawData?.posts || []) as any[];

        let posts = rawPosts.slice(0, maxResults).map((post) => this.normalizeRecentHashtagPost(post));

        posts = filterOldPosts(posts, maxAgeDays);
        return posts;
      } else {
        // /tt/hashtag/posts tiene estructura estándar: data.data[].{aweme_id, desc, author, statistics}
        const response = await this.request<Record<string, unknown>>("/tt/hashtag/posts", {
          name: cleanHashtag,
        });
        const rawData = response.data as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawPosts = ((rawData?.data || rawData?.aweme_list || []) as any[]);
        return rawPosts.slice(0, maxResults).map((post) => this.normalizeTikTokPost(post));
      }
    } catch (error) {
      console.error(`[EnsembleData] Error searching TikTok hashtag ${cleanHashtag}:`, error);
      return [];
    }
  }

  /**
   * Busca posts por keyword en TikTok.
   * Endpoint: /tt/keyword/search con parámetros name= y period=
   * period acepta: "0" (hoy), "1", "7", "30", "90", "180"
   *
   * @param maxAgeDays - Se mapea al period más cercano soportado por la API
   */
  async searchTikTok(query: string, maxResults: number = 20, maxAgeDays?: number): Promise<SocialPost[]> {
    try {
      // Mapear maxAgeDays al period más cercano soportado
      const period = maxAgeDays ? this.mapDaysToPeriod(maxAgeDays) : "7";

      const response = await this.request<Record<string, unknown>>("/tt/keyword/search", {
        name: query,
        period,
      });

      const rawData = response.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawItems = ((rawData?.data || rawData?.aweme_list || (Array.isArray(rawData) ? rawData : [])) as any[]);

      // Keyword search envuelve cada resultado en { type, aweme_info }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawPosts: any[] = rawItems.map((item) => item.aweme_info || item);

      let posts = rawPosts.slice(0, maxResults).map((post) => this.normalizeTikTokPost(post));

      // Filtrado post-fetch para exactitud (period es aproximado)
      if (maxAgeDays) {
        posts = filterOldPosts(posts, maxAgeDays);
      }

      return posts;
    } catch (error) {
      console.error(`[EnsembleData] Error searching TikTok keyword ${query}:`, error);
      return [];
    }
  }

  /**
   * Mapea días a los valores de period soportados por la API de TikTok.
   * Valores válidos: "0" (hoy), "1", "7", "30", "90", "180"
   */
  private mapDaysToPeriod(days: number): string {
    if (days <= 0) return "0";
    if (days <= 1) return "1";
    if (days <= 7) return "7";
    if (days <= 30) return "30";
    if (days <= 90) return "90";
    return "180";
  }

  /**
   * Obtiene información de un usuario de TikTok.
   * Endpoint: /tt/user/info con parámetro username=
   * Estructura real: data = { user: {...}, stats: { followerCount, videoCount, ... } }
   */
  async getTikTokUser(username: string): Promise<TikTokUserInfo | null> {
    try {
      const response = await this.request<Record<string, unknown>>("/tt/user/info", {
        username,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = response.data as any;
      const user = rawData?.user || rawData;
      const stats = rawData?.stats || {};
      if (!user?.uniqueId && !user?.unique_id) return null;

      return {
        id: user.id || user.uid || "",
        uniqueId: user.uniqueId || user.unique_id || username,
        nickname: user.nickname || "",
        signature: user.signature || undefined,
        followerCount: stats.followerCount || stats.follower_count || user.followerCount || 0,
        followingCount: stats.followingCount || stats.following_count || user.followingCount || 0,
        videoCount: stats.videoCount || stats.video_count || user.aweme_count || 0,
        verified: user.verified || false,
      };
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeTikTokPost(post: any): SocialPost {
    // Soportar camelCase y snake_case de la API
    const author = post.author || {};
    const stats = post.stats || post.statistics || {};
    const postId = post.id || post.aweme_id || "";
    const authorHandle = author.uniqueId || author.unique_id || "unknown";
    const createTime = post.createTime || post.create_time;

    return {
      platform: "TIKTOK",
      postId: String(postId),
      postUrl: `https://tiktok.com/@${authorHandle}/video/${postId}`,
      content: post.desc || post.description || null,
      authorHandle,
      authorName: author.nickname || author.nick_name || null,
      authorFollowers: author.followerCount || author.follower_count || null,
      likes: stats.diggCount || stats.digg_count || stats.likes || 0,
      comments: stats.commentCount || stats.comment_count || stats.comments || 0,
      shares: stats.shareCount || stats.share_count || stats.shares || 0,
      views: stats.playCount || stats.play_count || stats.views || null,
      postedAt: createTime ? new Date(createTime * 1000) : null,
    };
  }

  /**
   * Normaliza un post del endpoint /tt/hashtag/recent-posts que tiene estructura diferente:
   * { authorInfos: { uniqueId, nickName }, itemInfos: { id, text, createTime, diggCount, ... } }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeRecentHashtagPost(post: any): SocialPost {
    const authorInfos = post.authorInfos || {};
    const itemInfos = post.itemInfos || {};
    const authorHandle = authorInfos.uniqueId || authorInfos.unique_id || "unknown";
    const postId = itemInfos.id || "";
    const createTime = Number(itemInfos.createTime || itemInfos.create_time || 0);

    return {
      platform: "TIKTOK",
      postId: String(postId),
      postUrl: `https://tiktok.com/@${authorHandle}/video/${postId}`,
      content: itemInfos.text || null,
      authorHandle,
      authorName: authorInfos.nickName || authorInfos.nickname || null,
      authorFollowers: null,
      likes: Number(itemInfos.diggCount || itemInfos.digg_count || 0),
      comments: Number(itemInfos.commentCount || itemInfos.comment_count || 0),
      shares: Number(itemInfos.shareCount || itemInfos.share_count || 0),
      views: Number(itemInfos.playCount || itemInfos.play_count || 0) || null,
      postedAt: createTime ? new Date(createTime * 1000) : null,
    };
  }

  // ==================== YOUTUBE ====================

  /**
   * Resuelve un handle de YouTube a un channelId (browseId).
   * Si el handle ya es un channelId (empieza con UC/UU), lo retorna directamente.
   * Si no, busca en YouTube y extrae el browseId del primer resultado.
   */
  async getYouTubeChannelIdFromUsername(username: string): Promise<string | null> {
    // Si ya es un channel ID, retornar directamente
    if (username.startsWith("UC") || username.startsWith("UU")) {
      return username;
    }

    try {
      // Buscar el canal por nombre usando YouTube search
      const response = await this.request<Record<string, unknown>>("/youtube/search", {
        keyword: username,
        depth: 0,
        sorting: "relevance",
      });

      const rawData = response.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts = (rawData?.posts || []) as any[];

      // Buscar el browseId en los resultados
      for (const item of posts) {
        const renderer = item?.videoRenderer || item;
        const browseId = renderer?.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
          || renderer?.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
        const channelName = renderer?.ownerText?.runs?.[0]?.text
          || renderer?.longBylineText?.runs?.[0]?.text || "";

        // Si el nombre del canal coincide (case insensitive), retornar su browseId
        if (browseId && channelName.toLowerCase().includes(username.toLowerCase())) {
          console.log(`[EnsembleData] Resolved YouTube "${username}" → ${browseId} (${channelName})`);
          return browseId;
        }
      }

      // Si no hubo coincidencia exacta, usar el primer resultado con browseId
      for (const item of posts) {
        const renderer = item?.videoRenderer || item;
        const browseId = renderer?.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
          || renderer?.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
        if (browseId) {
          console.log(`[EnsembleData] YouTube "${username}" → using first result: ${browseId}`);
          return browseId;
        }
      }

      console.log(`[EnsembleData] Could not resolve YouTube channel for: ${username}`);
      return null;
    } catch (error) {
      console.error(`[EnsembleData] Error resolving YouTube channel "${username}":`, error);
      return null;
    }
  }

  /**
   * Obtiene información detallada de un canal de YouTube.
   * Usa /youtube/channel/videos que retorna data.user con metadata del canal.
   */
  async getYouTubeChannelInfo(channelId: string): Promise<YouTubeChannelInfo | null> {
    try {
      const response = await this.request<Record<string, unknown>>("/youtube/channel/videos", {
        browseId: channelId,
        depth: 0,
      });
      const data = response.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = data?.user as any;
      if (!user) return null;

      return {
        channelId,
        title: user.title || "",
        subscriberCount: 0, // No disponible en este endpoint
        videoCount: 0, // No disponible en este endpoint
        description: user.description || "",
      };
    } catch {
      return null;
    }
  }

  /**
   * Obtiene videos de un canal de YouTube.
   * Endpoint: /youtube/channel/videos con browseId=
   * Estructura: data.videos[].richItemRenderer.content.videoRenderer
   */
  async getYouTubeChannelVideos(channelId: string, maxResults: number = 20, maxAgeDays?: number): Promise<SocialPost[]> {
    try {
      const response = await this.request<Record<string, unknown>>("/youtube/channel/videos", {
        browseId: channelId,
        depth: 1,
      });

      const rawData = response.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawVideos = (rawData?.videos || []) as any[];

      // Extraer videoRenderer de la estructura anidada richItemRenderer.content.videoRenderer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videos: any[] = [];
      for (const item of rawVideos) {
        const renderer = item?.richItemRenderer?.content?.videoRenderer || item?.videoRenderer || item;
        if (renderer?.videoId) {
          videos.push(renderer);
        }
      }

      let posts = videos.slice(0, maxResults).map((video) => this.normalizeYouTubePost(video));

      if (maxAgeDays) {
        const before = posts.length;
        posts = filterOldPosts(posts, maxAgeDays);
        if (before !== posts.length) {
          console.log(`[EnsembleData] YouTube channel ${channelId}: filtrados ${before - posts.length} videos antiguos (>${maxAgeDays}d)`);
        }
      }

      return posts;
    } catch (error) {
      console.error(`[EnsembleData] Error getting YouTube videos for channel ${channelId}:`, error);
      return [];
    }
  }

  /**
   * Busca videos en YouTube por keyword.
   * Endpoint: /youtube/search (NO /youtube/keyword/search)
   * Estructura: data.posts[].videoRenderer
   * Usa `period` nativo para filtro temporal + filtrado post-fetch.
   */
  async searchYouTube(keyword: string, maxResults: number = 20, maxAgeDays?: number): Promise<SocialPost[]> {
    try {
      const period = maxAgeDays ? this.mapDaysToYouTubePeriod(maxAgeDays) : "month";

      const response = await this.request<Record<string, unknown>>("/youtube/search", {
        keyword,
        depth: 1,
        period,
        sorting: "relevance",
      });

      const rawData = response.data as Record<string, unknown>;
      // Resultados vienen en data.posts[].videoRenderer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawPosts = (rawData?.posts || rawData?.videos || []) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videos: any[] = [];
      for (const item of rawPosts) {
        const renderer = item?.videoRenderer || item;
        if (renderer?.videoId) {
          videos.push(renderer);
        }
      }

      let posts = videos.slice(0, maxResults).map((video) => this.normalizeYouTubePost(video));

      // Filtrado post-fetch para exactitud
      if (maxAgeDays) {
        posts = filterOldPosts(posts, maxAgeDays);
      }

      return posts;
    } catch (error) {
      console.error(`[EnsembleData] Error searching YouTube keyword ${keyword}:`, error);
      return [];
    }
  }

  /**
   * Obtiene comentarios de un video de YouTube.
   * Endpoint: /youtube/video/comments
   * Estructura: data.comments[].commentThreadRenderer.comment.{properties, author, toolbar}
   */
  async getYouTubeVideoComments(videoId: string, maxComments: number = 30): Promise<SocialComment[]> {
    const allComments: SocialComment[] = [];
    let cursor: string | undefined;
    const maxRequests = Math.ceil(maxComments / 20);

    for (let i = 0; i < maxRequests && allComments.length < maxComments; i++) {
      try {
        const params: Record<string, string | number | boolean> = {
          id: videoId,
        };
        if (cursor) {
          params.cursor = cursor;
        }

        const response = await this.request<Record<string, unknown>>("/youtube/video/comments", params);
        const data = response.data as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const comments = (data?.comments || []) as any[];
        if (comments.length === 0) break;

        for (const comment of comments) {
          if (allComments.length >= maxComments) break;
          allComments.push(this.normalizeYouTubeComment(comment));
        }

        // Paginación usa nextCursor
        const nextCursor = data?.nextCursor;
        if (!nextCursor) break;
        cursor = String(nextCursor);

        if (i < maxRequests - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[EnsembleData] Error getting YouTube comments (request ${i + 1}):`, error);
        break;
      }
    }

    console.log(`[EnsembleData] Extracted ${allComments.length} YouTube comments for video ${videoId}`);
    return allComments;
  }

  /**
   * Mapea días a los valores de period soportados por YouTube search.
   * Valores válidos: "hour", "today", "week", "month", "year"
   */
  private mapDaysToYouTubePeriod(days: number): string {
    if (days <= 1) return "today";
    if (days <= 7) return "week";
    if (days <= 30) return "month";
    return "year";
  }

  /**
   * Normaliza un video de YouTube (estructura videoRenderer de la API).
   * Soporta tanto videoRenderer (search) como estructura con snippet/statistics (fallback).
   *
   * videoRenderer: { videoId, title.runs[0].text, publishedTimeText.simpleText,
   *   viewCountText.simpleText, ownerText.runs[0].text, ownerText.runs[0]...browseEndpoint.browseId }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeYouTubePost(video: any): SocialPost {
    const videoId = video.videoId || video.video_id || video.id?.videoId || video.id || "";

    // Formato videoRenderer (actual de la API)
    const title = video.title?.runs?.[0]?.text || video.title?.simpleText || video.snippet?.title || video.title || "";
    const channelTitle = video.ownerText?.runs?.[0]?.text || video.longBylineText?.runs?.[0]?.text
      || video.snippet?.channelTitle || "unknown";
    const channelId = video.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
      || video.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
      || video.snippet?.channelId || "";

    // Parsear fecha: relativa ("3 hours ago") o ISO string
    let postedAt: Date | null = null;
    const publishedText = video.publishedTimeText?.simpleText || video.snippet?.publishedAt || video.publishedTime;
    if (publishedText) {
      // Intentar primero como fecha relativa
      postedAt = parseRelativeTime(publishedText);
      // Fallback a ISO date
      if (!postedAt) {
        const d = new Date(publishedText);
        if (!isNaN(d.getTime())) postedAt = d;
      }
    }

    // Parsear views: "12 views", "177K views", o número directo
    const viewText = video.viewCountText?.simpleText || video.shortViewCountText?.simpleText;
    const views = viewText ? parseFormattedCount(viewText)
      : Number(video.statistics?.viewCount || video.viewCount || 0) || null;

    return {
      platform: "YOUTUBE",
      postId: String(videoId),
      postUrl: `https://youtube.com/watch?v=${videoId}`,
      content: title || null,
      authorHandle: channelId || channelTitle,
      authorName: channelTitle,
      authorFollowers: null,
      likes: Number(video.statistics?.likeCount || video.likeCount || 0),
      comments: Number(video.statistics?.commentCount || video.commentCount || 0),
      shares: 0, // YouTube no expone shares
      views,
      postedAt,
    };
  }

  /**
   * Normaliza un comentario de YouTube.
   * Estructura real: commentThreadRenderer.comment.{properties, author, toolbar}
   * - properties: commentId, content.content, publishedTime ("9 months ago")
   * - author: channelId, displayName
   * - toolbar: likeCountNotliked ("176K"), replyCount ("959")
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeYouTubeComment(raw: any): SocialComment {
    // Extraer el comment del wrapper commentThreadRenderer
    const comment = raw?.commentThreadRenderer?.comment || raw?.comment || raw;
    const properties = comment?.properties || {};
    const author = comment?.author || {};
    const toolbar = comment?.toolbar || {};

    // Parsear likes y replies (pueden ser strings formateados como "176K")
    const likes = parseFormattedCount(String(toolbar.likeCountNotliked || "0")) || 0;
    const replies = parseFormattedCount(String(toolbar.replyCount || "0")) || 0;

    // Parsear fecha relativa ("9 months ago")
    const publishedTime = properties.publishedTime || "";
    const postedAt = parseRelativeTime(publishedTime);

    return {
      commentId: properties.commentId || raw?.id || "",
      text: properties.content?.content || "",
      authorHandle: author.channelId || "",
      authorName: author.displayName || null,
      likes,
      replies,
      postedAt,
    };
  }

  // ==================== COMMENTS EXTRACTION ====================

  /**
   * Extrae comentarios de un post de TikTok.
   * Endpoint: /tt/post/comments
   * Costo: 1 unit por request (30 comentarios)
   *
   * @param postId - ID del post de TikTok
   * @param maxComments - Máximo de comentarios a extraer (default: 60, max: 2 requests)
   * @returns Array de comentarios normalizados
   */
  async getTikTokPostComments(postId: string, maxComments: number = 60): Promise<SocialComment[]> {
    const allComments: SocialComment[] = [];
    let cursor: number | undefined;
    const commentsPerRequest = 30;
    const maxRequests = Math.ceil(maxComments / commentsPerRequest);

    for (let i = 0; i < maxRequests && allComments.length < maxComments; i++) {
      try {
        const params: Record<string, string | number | boolean> = {
          aweme_id: postId,
        };
        if (cursor !== undefined) {
          params.cursor = cursor;
        }

        const response = await this.request<{
          comments: TikTokComment[];
          nextCursor?: number;
          total?: number;
        }>("/tt/post/comments", params);

        const comments = response.data?.comments || [];
        if (comments.length === 0) break;

        for (const comment of comments) {
          if (allComments.length >= maxComments) break;
          allComments.push(this.normalizeTikTokComment(comment));
        }

        // Paginación usa nextCursor
        if (!response.data?.nextCursor) break;
        cursor = response.data.nextCursor;

        // Pequeño delay entre requests para evitar rate limiting
        if (i < maxRequests - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[EnsembleData] Error getting TikTok comments (request ${i + 1}):`, error);
        break;
      }
    }

    console.log(`[EnsembleData] Extracted ${allComments.length} TikTok comments for post ${postId}`);
    return allComments;
  }

  /**
   * Extrae comentarios de un post de Instagram.
   * Endpoint: /instagram/post/comments
   * Costo: 4 units por request (10 comentarios)
   *
   * @param shortcode - Shortcode del post de Instagram (ej: "CxYz123AbC")
   * @param maxComments - Máximo de comentarios a extraer (default: 30, max: 3 requests)
   * @returns Array de comentarios normalizados
   */
  async getInstagramPostComments(mediaId: string, maxComments: number = 30): Promise<SocialComment[]> {
    const allComments: SocialComment[] = [];
    let cursor = "";
    const commentsPerRequest = 15;
    const maxRequests = Math.ceil(maxComments / commentsPerRequest);

    for (let i = 0; i < maxRequests && allComments.length < maxComments; i++) {
      try {
        const params: Record<string, string | number | boolean> = {
          media_id: mediaId,
          cursor,
          sorting: "popular",
        };

        const response = await this.request<{
          comments: Array<{ node: InstagramComment }>;
          nextCursor?: string;
        }>("/instagram/post/comments", params);

        // La API retorna comments[].node con la estructura real
        const rawComments = response.data?.comments || [];
        if (rawComments.length === 0) break;

        for (const wrapper of rawComments) {
          if (allComments.length >= maxComments) break;
          const comment = wrapper.node || wrapper;
          allComments.push(this.normalizeInstagramComment(comment as InstagramComment));
        }

        // Paginación usa nextCursor
        const nextCursor = response.data?.nextCursor;
        if (!nextCursor) break;
        cursor = nextCursor;

        // Pequeño delay entre requests para evitar rate limiting
        if (i < maxRequests - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[EnsembleData] Error getting Instagram comments (request ${i + 1}):`, error);
        break;
      }
    }

    console.log(`[EnsembleData] Extracted ${allComments.length} Instagram comments for media ${mediaId}`);
    return allComments;
  }

  private normalizeTikTokComment(comment: TikTokComment): SocialComment {
    return {
      commentId: comment.cid,
      text: comment.text,
      authorHandle: comment.user.unique_id,
      authorName: comment.user.nickname,
      likes: comment.digg_count,
      replies: comment.reply_comment_total || 0,
      postedAt: comment.create_time ? new Date(comment.create_time * 1000) : null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeInstagramComment(comment: any): SocialComment {
    return {
      commentId: String(comment.pk || ""),
      text: comment.text || "",
      authorHandle: comment.user?.username || "",
      authorName: comment.user?.full_name || null,
      likes: Number(comment.comment_like_count || 0),
      replies: Number(comment.child_comment_count || 0),
      postedAt: comment.created_at ? new Date(comment.created_at * 1000) : null,
    };
  }

  // ==================== VALIDACIÓN DE HANDLES ====================

  /**
   * Valida si un handle existe en una plataforma.
   * Retorna el ID de plataforma si existe.
   */
  async validateHandle(platform: SocialPlatform, handle: string): Promise<{ valid: boolean; platformUserId?: string; error?: string }> {
    const cleanHandle = handle.replace(/^@/, "");

    try {
      switch (platform) {
        case "TWITTER": {
          const user = await this.getTwitterUser(cleanHandle);
          return user
            ? { valid: true, platformUserId: user.id }
            : { valid: false, error: "Usuario no encontrado" };
        }
        case "INSTAGRAM": {
          const user = await this.getInstagramUser(cleanHandle);
          return user
            ? { valid: true, platformUserId: user.id }
            : { valid: false, error: "Usuario no encontrado" };
        }
        case "TIKTOK": {
          const user = await this.getTikTokUser(cleanHandle);
          return user
            ? { valid: true, platformUserId: user.id }
            : { valid: false, error: "Usuario no encontrado" };
        }
        case "YOUTUBE": {
          // Si ya es un channel ID, verificar que el canal existe
          if (cleanHandle.startsWith("UC") || cleanHandle.startsWith("UU")) {
            const info = await this.getYouTubeChannelInfo(cleanHandle);
            return info
              ? { valid: true, platformUserId: cleanHandle }
              : { valid: false, error: "Canal no encontrado" };
          }
          // Si no, resolver username a channelId via búsqueda
          const channelId = await this.getYouTubeChannelIdFromUsername(cleanHandle);
          return channelId
            ? { valid: true, platformUserId: channelId }
            : { valid: false, error: "Canal no encontrado" };
        }
        default:
          return { valid: false, error: "Plataforma no soportada" };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error de validación";
      return { valid: false, error: msg };
    }
  }
}

// Instancia singleton
let clientInstance: EnsembleDataClient | null = null;

/**
 * Obtiene la instancia del cliente EnsembleData.
 */
export function getEnsembleDataClient(): EnsembleDataClient {
  if (!clientInstance) {
    clientInstance = new EnsembleDataClient();
  }
  return clientInstance;
}

/**
 * Crea una nueva instancia del cliente con configuración personalizada.
 */
export function createEnsembleDataClient(cfg: EnsembleDataConfig): EnsembleDataClient {
  return new EnsembleDataClient(cfg);
}

export { EnsembleDataClient };
