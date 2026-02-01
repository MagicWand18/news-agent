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

// Instagram Types
export interface InstagramPost {
  id: string;
  shortcode: string;
  caption?: string;
  timestamp: number;
  owner: {
    id: string;
    username: string;
    full_name?: string;
    follower_count?: number;
  };
  like_count: number;
  comment_count: number;
  video_view_count?: number;
  is_video: boolean;
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
   * Obtiene tweets recientes de un usuario.
   * Endpoint: /twitter/user-tweets
   */
  async getTwitterUserTweets(username: string, maxResults: number = 20): Promise<SocialPost[]> {
    const response = await this.request<{ data: TwitterSearchResult[] }>("/twitter/user-tweets", {
      username,
      depth: maxResults,
    });

    return (response.data?.data || []).map((tweet) => this.normalizeTwitterPost(tweet));
  }

  /**
   * Obtiene tweets recientes de un usuario por ID numérico.
   * Endpoint: /twitter/user-tweets
   * Usar cuando se tiene el platformUserId cacheado.
   */
  async getTwitterUserTweetsById(userId: string, maxResults: number = 20): Promise<SocialPost[]> {
    // La API usa username, no ID
    console.log(`[EnsembleData] Twitter by ID not supported, need username`);
    return [];
  }

  /**
   * Obtiene información de un usuario de Twitter.
   * Endpoint: /twitter/user-info
   */
  async getTwitterUser(username: string): Promise<TwitterUserInfo | null> {
    try {
      const response = await this.request<{ data: TwitterUserInfo }>("/twitter/user-info", {
        username,
      });
      return response.data?.data || null;
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
   * Obtiene posts de un usuario de Instagram.
   * Endpoint: /instagram/user-posts
   */
  async getInstagramUserPosts(username: string, maxResults: number = 12): Promise<SocialPost[]> {
    const response = await this.request<{ data: InstagramPost[] }>("/instagram/user-posts", {
      username,
      depth: Math.min(maxResults, 24),
    });

    return (response.data?.data || []).map((post) => this.normalizeInstagramPost(post));
  }

  /**
   * Obtiene posts de un usuario de Instagram por ID numérico.
   * Endpoint: /instagram/user-posts
   * Usar cuando se tiene el platformUserId cacheado.
   */
  async getInstagramUserPostsById(userId: string, maxResults: number = 12): Promise<SocialPost[]> {
    // La API usa username, no ID directo
    console.log(`[EnsembleData] Instagram by ID not supported, need username`);
    return [];
  }

  /**
   * Busca posts por hashtag en Instagram.
   * Nota: EnsembleData no tiene búsqueda por hashtag para Instagram directamente.
   * Usar /instagram/search en su lugar.
   */
  async searchInstagramHashtag(hashtag: string, maxResults: number = 20): Promise<SocialPost[]> {
    // La API de EnsembleData no tiene búsqueda por hashtag específico
    // Podemos usar /instagram/search como alternativa
    const cleanHashtag = hashtag.replace(/^#/, "");

    try {
      const response = await this.request<{ data: InstagramPost[] }>("/instagram/search", {
        keyword: `#${cleanHashtag}`,
        depth: Math.min(maxResults, 24),
      });
      return (response.data?.data || []).map((post) => this.normalizeInstagramPost(post));
    } catch {
      console.log(`[EnsembleData] Instagram hashtag search not available: ${cleanHashtag}`);
      return [];
    }
  }

  /**
   * Obtiene información de un usuario de Instagram.
   * Endpoint: /instagram/user-info
   */
  async getInstagramUser(username: string): Promise<InstagramUserInfo | null> {
    try {
      const response = await this.request<{ data: InstagramUserInfo }>("/instagram/user-info", {
        username,
      });
      return response.data?.data || null;
    } catch {
      return null;
    }
  }

  private normalizeInstagramPost(post: InstagramPost): SocialPost {
    return {
      platform: "INSTAGRAM",
      postId: post.id,
      postUrl: `https://instagram.com/p/${post.shortcode}`,
      content: post.caption || null,
      authorHandle: post.owner.username,
      authorName: post.owner.full_name || null,
      authorFollowers: post.owner.follower_count || null,
      likes: post.like_count,
      comments: post.comment_count,
      shares: 0, // Instagram no tiene shares públicos
      views: post.video_view_count || null,
      postedAt: post.timestamp ? new Date(post.timestamp * 1000) : null,
    };
  }

  // ==================== TIKTOK ====================

  /**
   * Obtiene posts de un usuario de TikTok.
   * Endpoint: /tiktok/user/posts-username
   */
  async getTikTokUserPosts(username: string, maxResults: number = 20): Promise<SocialPost[]> {
    const response = await this.request<{ data: TikTokPost[] }>("/tiktok/user/posts-username", {
      username,
      depth: Math.min(maxResults, 35),
    });

    return (response.data?.data || []).map((post) => this.normalizeTikTokPost(post));
  }

  /**
   * Busca posts por hashtag en TikTok.
   * Endpoint: /tiktok/hashtag/posts
   */
  async searchTikTokHashtag(hashtag: string, maxResults: number = 20): Promise<SocialPost[]> {
    const cleanHashtag = hashtag.replace(/^#/, "");

    const response = await this.request<{ data: TikTokPost[] }>("/tiktok/hashtag/posts", {
      name: cleanHashtag,
      depth: Math.min(maxResults, 35),
    });

    return (response.data?.data || []).map((post) => this.normalizeTikTokPost(post));
  }

  /**
   * Busca posts por keyword en TikTok.
   * Endpoint: /tiktok/keyword/search
   */
  async searchTikTok(query: string, maxResults: number = 20): Promise<SocialPost[]> {
    const response = await this.request<{ data: TikTokPost[] }>("/tiktok/keyword/search", {
      keyword: query,
      depth: Math.min(maxResults, 35),
    });

    return (response.data?.data || []).map((post) => this.normalizeTikTokPost(post));
  }

  /**
   * Obtiene información de un usuario de TikTok.
   * Endpoint: /tiktok/user/info-username
   */
  async getTikTokUser(username: string): Promise<TikTokUserInfo | null> {
    try {
      const response = await this.request<{ data: TikTokUserInfo }>("/tiktok/user/info-username", {
        username,
      });
      return response.data?.data || null;
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
