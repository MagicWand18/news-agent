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

export type SocialPlatform = "TWITTER" | "INSTAGRAM" | "TIKTOK";

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
      if (value !== undefined && value !== null && value !== "") {
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
   */
  async getTwitterUserTweets(username: string, maxResults: number = 20): Promise<SocialPost[]> {
    // Primero obtener el ID del usuario
    const userInfo = await this.getTwitterUser(username);
    if (!userInfo?.id) {
      console.log(`[EnsembleData] Could not get Twitter user ID for: ${username}`);
      return [];
    }
    return this.getTwitterUserTweetsById(userInfo.id, maxResults);
  }

  /**
   * Obtiene tweets recientes de un usuario por ID numérico.
   * Endpoint: /twitter/user/tweets con parámetro id=
   */
  async getTwitterUserTweetsById(userId: string, maxResults: number = 20): Promise<SocialPost[]> {
    try {
      const response = await this.request<{ data: TwitterSearchResult[] }>("/twitter/user/tweets", {
        id: userId,
      });

      // La respuesta viene como array de objetos con estructura especial de Twitter
      const tweets = response.data?.data || [];
      return tweets.slice(0, maxResults).map((tweet) => this.normalizeTwitterPost(tweet));
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
   */
  async getInstagramUserPosts(username: string, maxResults: number = 12): Promise<SocialPost[]> {
    // Primero obtener el ID del usuario
    const userInfo = await this.getInstagramUser(username);
    if (!userInfo?.id) {
      console.log(`[EnsembleData] Could not get Instagram user ID for: ${username}`);
      return [];
    }
    return this.getInstagramUserPostsById(userInfo.id, maxResults);
  }

  /**
   * Obtiene posts de un usuario de Instagram por ID numérico.
   * Endpoint: /instagram/user/posts con parámetro user_id=
   */
  async getInstagramUserPostsById(userId: string, maxResults: number = 12): Promise<SocialPost[]> {
    try {
      // La respuesta tiene estructura: { data: { posts: [{ node: InstagramPost }] } }
      const response = await this.request<{ posts: InstagramPostWrapper[] }>("/instagram/user/posts", {
        user_id: userId,
        depth: 1, // Requerido por EnsembleData API
      });

      const posts = response.data?.posts || [];
      return posts.slice(0, maxResults).map((wrapper) => this.normalizeInstagramPost(wrapper.node));
    } catch (error) {
      console.error(`[EnsembleData] Error getting posts for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Busca posts por hashtag en Instagram.
   * Endpoint: /instagram/hashtag/posts con parámetro name=
   */
  async searchInstagramHashtag(hashtag: string, maxResults: number = 20): Promise<SocialPost[]> {
    const cleanHashtag = hashtag.replace(/^#/, "");

    try {
      // Estructura similar a user/posts: { data: { posts: [{ node: InstagramPost }] } }
      const response = await this.request<{ posts: InstagramPostWrapper[] }>("/instagram/hashtag/posts", {
        name: cleanHashtag,
      });
      const posts = response.data?.posts || [];
      return posts.slice(0, maxResults).map((wrapper) => this.normalizeInstagramPost(wrapper.node));
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
   * Endpoint: /tt/user/posts con parámetro username=
   */
  async getTikTokUserPosts(username: string, maxResults: number = 20): Promise<SocialPost[]> {
    try {
      const response = await this.request<{ data: TikTokPost[] }>("/tt/user/posts", {
        username,
        depth: "1",
      });

      const posts = response.data?.data || [];
      return posts.slice(0, maxResults).map((post) => this.normalizeTikTokPost(post));
    } catch (error) {
      console.error(`[EnsembleData] Error getting TikTok posts for ${username}:`, error);
      return [];
    }
  }

  /**
   * Busca posts por hashtag en TikTok.
   * Endpoint: /tt/hashtag/posts con parámetro name=
   */
  async searchTikTokHashtag(hashtag: string, maxResults: number = 20): Promise<SocialPost[]> {
    const cleanHashtag = hashtag.replace(/^#/, "");

    try {
      const response = await this.request<{ data: TikTokPost[] }>("/tt/hashtag/posts", {
        name: cleanHashtag,
        depth: "1",
      });

      const posts = response.data?.data || [];
      return posts.slice(0, maxResults).map((post) => this.normalizeTikTokPost(post));
    } catch (error) {
      console.error(`[EnsembleData] Error searching TikTok hashtag ${cleanHashtag}:`, error);
      return [];
    }
  }

  /**
   * Busca posts por keyword en TikTok.
   * Endpoint: /tt/keyword/search con parámetros name= y period=
   */
  async searchTikTok(query: string, maxResults: number = 20): Promise<SocialPost[]> {
    try {
      const response = await this.request<{ data: TikTokPost[] }>("/tt/keyword/search", {
        name: query,
        period: "7", // Últimos 7 días
      });

      const posts = response.data?.data || [];
      return posts.slice(0, maxResults).map((post) => this.normalizeTikTokPost(post));
    } catch (error) {
      console.error(`[EnsembleData] Error searching TikTok keyword ${query}:`, error);
      return [];
    }
  }

  /**
   * Obtiene información de un usuario de TikTok.
   * Endpoint: /tt/user/info con parámetro username=
   */
  async getTikTokUser(username: string): Promise<TikTokUserInfo | null> {
    try {
      const response = await this.request<TikTokUserInfo>("/tt/user/info", {
        username,
      });
      return response.data || null;
    } catch {
      return null;
    }
  }

  private normalizeTikTokPost(post: TikTokPost): SocialPost {
    return {
      platform: "TIKTOK",
      postId: post.id,
      postUrl: `https://tiktok.com/@${post.author.uniqueId}/video/${post.id}`,
      content: post.desc || null,
      authorHandle: post.author.uniqueId,
      authorName: post.author.nickname,
      authorFollowers: post.author.followerCount || null,
      likes: post.stats.diggCount,
      comments: post.stats.commentCount,
      shares: post.stats.shareCount,
      views: post.stats.playCount,
      postedAt: post.createTime ? new Date(post.createTime * 1000) : null,
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
          cursor?: number;
          has_more?: boolean;
        }>("/tt/post/comments", params);

        const comments = response.data?.comments || [];
        if (comments.length === 0) break;

        for (const comment of comments) {
          if (allComments.length >= maxComments) break;
          allComments.push(this.normalizeTikTokComment(comment));
        }

        // Verificar si hay más comentarios
        if (!response.data?.has_more || !response.data?.cursor) break;
        cursor = response.data.cursor;

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
  async getInstagramPostComments(shortcode: string, maxComments: number = 30): Promise<SocialComment[]> {
    const allComments: SocialComment[] = [];
    let endCursor: string | undefined;
    const commentsPerRequest = 10;
    const maxRequests = Math.ceil(maxComments / commentsPerRequest);

    for (let i = 0; i < maxRequests && allComments.length < maxComments; i++) {
      try {
        const params: Record<string, string | number | boolean> = {
          code: shortcode,
        };
        if (endCursor) {
          params.end_cursor = endCursor;
        }

        const response = await this.request<{
          comments: InstagramComment[];
          end_cursor?: string;
          has_next_page?: boolean;
        }>("/instagram/post/comments", params);

        const comments = response.data?.comments || [];
        if (comments.length === 0) break;

        for (const comment of comments) {
          if (allComments.length >= maxComments) break;
          allComments.push(this.normalizeInstagramComment(comment));
        }

        // Verificar si hay más comentarios
        if (!response.data?.has_next_page || !response.data?.end_cursor) break;
        endCursor = response.data.end_cursor;

        // Pequeño delay entre requests para evitar rate limiting
        if (i < maxRequests - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[EnsembleData] Error getting Instagram comments (request ${i + 1}):`, error);
        break;
      }
    }

    console.log(`[EnsembleData] Extracted ${allComments.length} Instagram comments for post ${shortcode}`);
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

  private normalizeInstagramComment(comment: InstagramComment): SocialComment {
    return {
      commentId: comment.pk,
      text: comment.text,
      authorHandle: comment.user.username,
      authorName: comment.user.full_name || null,
      likes: comment.comment_like_count,
      replies: 0, // Instagram no incluye replies en este endpoint
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
