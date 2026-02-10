/**
 * Tests para el cliente de EnsembleData - YouTube y normalización.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config antes de importar el cliente
vi.mock("../config", () => ({
  config: {
    ensembledata: {
      token: "test-token",
      baseUrl: "https://ensembledata.com/apis",
    },
    social: { maxAgeDays: 7 },
    socialComments: {
      enabled: true,
      tiktokMaxComments: 60,
      instagramMaxComments: 30,
      youtubeMaxComments: 30,
    },
  },
}));

import { EnsembleDataClient } from "../ensembledata-client";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("EnsembleDataClient", () => {
  let client: EnsembleDataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new EnsembleDataClient({
      token: "test-token",
      baseUrl: "https://ensembledata.com/apis",
    });
  });

  describe("isConfigured", () => {
    it("retorna true cuando tiene token", () => {
      expect(client.isConfigured()).toBe(true);
    });

    it("usa token de config como fallback cuando se pasa vacío", () => {
      // "" es falsy → el constructor usa config.ensembledata.token ("test-token") como fallback
      const withFallback = new EnsembleDataClient({ token: "", baseUrl: "" });
      expect(withFallback.isConfigured()).toBe(true);
    });
  });

  // ==================== YOUTUBE ====================

  describe("getYouTubeChannelIdFromUsername", () => {
    it("retorna channelId cuando el username existe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { channel_id: "UC_x5XG1OV2P6uZZ5FSM9Ttw" },
          units_charged: 1,
        }),
      });

      const result = await client.getYouTubeChannelIdFromUsername("GoogleDevelopers");
      expect(result).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
    });

    it("retorna null cuando el username no existe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {}, units_charged: 1 }),
      });

      const result = await client.getYouTubeChannelIdFromUsername("nonexistent_channel_xyz");
      expect(result).toBeNull();
    });

    it("retorna null en caso de error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.getYouTubeChannelIdFromUsername("test");
      expect(result).toBeNull();
    });
  });

  describe("getYouTubeChannelInfo", () => {
    it("retorna info del canal", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "UC_test",
            snippet: { title: "Test Channel", description: "A test channel" },
            statistics: { subscriberCount: "1000", videoCount: "50" },
          },
          units_charged: 1,
        }),
      });

      const result = await client.getYouTubeChannelInfo("UC_test");
      expect(result).not.toBeNull();
      expect(result!.channelId).toBe("UC_test");
      expect(result!.title).toBe("Test Channel");
      expect(result!.subscriberCount).toBe(1000);
      expect(result!.videoCount).toBe(50);
    });

    it("retorna null en caso de error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("API error"));

      const result = await client.getYouTubeChannelInfo("UC_test");
      expect(result).toBeNull();
    });
  });

  describe("getYouTubeChannelVideos", () => {
    it("retorna videos normalizados como SocialPost", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: [
              {
                videoId: "abc123",
                snippet: {
                  title: "Test Video",
                  channelTitle: "Test Channel",
                  channelId: "UC_test",
                  publishedAt: "2026-02-01T12:00:00Z",
                },
                statistics: {
                  viewCount: "5000",
                  likeCount: "100",
                  commentCount: "20",
                },
              },
            ],
          },
          units_charged: 1,
        }),
      });

      const posts = await client.getYouTubeChannelVideos("UC_test", 10);
      expect(posts).toHaveLength(1);
      expect(posts[0].platform).toBe("YOUTUBE");
      expect(posts[0].postId).toBe("abc123");
      expect(posts[0].postUrl).toBe("https://youtube.com/watch?v=abc123");
      expect(posts[0].content).toBe("Test Video");
      expect(posts[0].authorName).toBe("Test Channel");
      expect(posts[0].likes).toBe(100);
      expect(posts[0].comments).toBe(20);
      expect(posts[0].views).toBe(5000);
    });

    it("filtra videos antiguos con maxAgeDays", async () => {
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 días
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 días

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: [
              {
                videoId: "old1",
                snippet: { title: "Old Video", channelTitle: "Ch", channelId: "UC", publishedAt: oldDate },
                statistics: { viewCount: "100", likeCount: "10", commentCount: "5" },
              },
              {
                videoId: "new1",
                snippet: { title: "New Video", channelTitle: "Ch", channelId: "UC", publishedAt: recentDate },
                statistics: { viewCount: "200", likeCount: "20", commentCount: "10" },
              },
            ],
          },
          units_charged: 1,
        }),
      });

      const posts = await client.getYouTubeChannelVideos("UC", 10, 7);
      expect(posts).toHaveLength(1);
      expect(posts[0].postId).toBe("new1");
    });

    it("retorna array vacío en caso de error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("API error"));

      const posts = await client.getYouTubeChannelVideos("UC_test", 10);
      expect(posts).toEqual([]);
    });
  });

  describe("searchYouTube", () => {
    it("busca videos por keyword y normaliza resultados", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: [
              {
                videoId: "xyz789",
                snippet: {
                  title: "Search Result",
                  channelTitle: "Creator",
                  channelId: "UC_creator",
                  publishedAt: new Date().toISOString(),
                },
                statistics: { viewCount: "1000", likeCount: "50", commentCount: "10" },
              },
            ],
          },
          units_charged: 2,
        }),
      });

      const posts = await client.searchYouTube("test keyword", 10, 30);
      expect(posts).toHaveLength(1);
      expect(posts[0].platform).toBe("YOUTUBE");
      expect(posts[0].content).toBe("Search Result");

      // Verificar que se usó el period correcto (30 días → "month")
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("period=month");
    });

    it("mapea días a period correcto", async () => {
      // Test 7 días → week
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { videos: [] }, units_charged: 1 }),
      });
      await client.searchYouTube("test", 10, 7);
      expect(mockFetch.mock.calls[0][0]).toContain("period=week");

      // Test 1 día → today
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { videos: [] }, units_charged: 1 }),
      });
      await client.searchYouTube("test", 10, 1);
      expect(mockFetch.mock.calls[1][0]).toContain("period=today");

      // Test 60 días → year
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { videos: [] }, units_charged: 1 }),
      });
      await client.searchYouTube("test", 10, 60);
      expect(mockFetch.mock.calls[2][0]).toContain("period=year");
    });
  });

  describe("getYouTubeVideoComments", () => {
    it("extrae y normaliza comentarios de un video", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: [
              {
                id: "comment1",
                snippet: {
                  topLevelComment: {
                    snippet: {
                      textDisplay: "Great video!",
                      authorDisplayName: "User1",
                      authorChannelUrl: "http://youtube.com/user1",
                      likeCount: 5,
                      publishedAt: "2026-02-01T10:00:00Z",
                    },
                  },
                  totalReplyCount: 2,
                },
              },
            ],
          },
          units_charged: 1,
        }),
      });

      const comments = await client.getYouTubeVideoComments("abc123", 10);
      expect(comments).toHaveLength(1);
      expect(comments[0].commentId).toBe("comment1");
      expect(comments[0].text).toBe("Great video!");
      expect(comments[0].authorName).toBe("User1");
      expect(comments[0].likes).toBe(5);
      expect(comments[0].replies).toBe(2);
    });

    it("maneja paginación con cursor", async () => {
      // Primera página
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: Array.from({ length: 20 }, (_, i) => ({
              id: `comment_${i}`,
              snippet: {
                topLevelComment: {
                  snippet: {
                    textDisplay: `Comment ${i}`,
                    authorDisplayName: `User${i}`,
                    likeCount: 0,
                  },
                },
                totalReplyCount: 0,
              },
            })),
            next_cursor: "cursor_page2",
          },
          units_charged: 1,
        }),
      });

      // Segunda página
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: Array.from({ length: 10 }, (_, i) => ({
              id: `comment_2_${i}`,
              snippet: {
                topLevelComment: {
                  snippet: {
                    textDisplay: `Comment page2 ${i}`,
                    authorDisplayName: `User2_${i}`,
                    likeCount: 0,
                  },
                },
                totalReplyCount: 0,
              },
            })),
          },
          units_charged: 1,
        }),
      });

      const comments = await client.getYouTubeVideoComments("abc123", 25);
      expect(comments).toHaveLength(25);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("validateHandle - YOUTUBE", () => {
    it("valida un canal existente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { channel_id: "UC_valid" },
          units_charged: 1,
        }),
      });

      const result = await client.validateHandle("YOUTUBE", "GoogleDevelopers");
      expect(result.valid).toBe(true);
      expect(result.platformUserId).toBe("UC_valid");
    });

    it("rechaza un canal inexistente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {}, units_charged: 1 }),
      });

      const result = await client.validateHandle("YOUTUBE", "nonexistent");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Canal no encontrado");
    });
  });

  // ==================== NORMALIZACIÓN ====================

  describe("normalización YouTube", () => {
    it("normaliza video con estructura snippet/statistics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: [{
              videoId: "v1",
              snippet: {
                title: "Mi Video",
                description: "Descripción",
                channelTitle: "Mi Canal",
                channelId: "UC_mi",
                publishedAt: "2026-01-15T08:00:00Z",
              },
              statistics: { viewCount: "10000", likeCount: "500", commentCount: "30" },
            }],
          },
          units_charged: 1,
        }),
      });

      const posts = await client.getYouTubeChannelVideos("UC_mi");
      const post = posts[0];
      expect(post.platform).toBe("YOUTUBE");
      expect(post.postUrl).toBe("https://youtube.com/watch?v=v1");
      expect(post.authorHandle).toBe("UC_mi");
      expect(post.authorName).toBe("Mi Canal");
      expect(post.views).toBe(10000);
      expect(post.likes).toBe(500);
      expect(post.shares).toBe(0); // YouTube no expone shares
      expect(post.postedAt).toEqual(new Date("2026-01-15T08:00:00Z"));
    });

    it("maneja video sin statistics graciosamente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            videos: [{
              videoId: "v2",
              snippet: { title: "Video sin stats", channelTitle: "Canal", channelId: "UC" },
            }],
          },
          units_charged: 1,
        }),
      });

      const posts = await client.getYouTubeChannelVideos("UC");
      expect(posts).toHaveLength(1);
      expect(posts[0].likes).toBe(0);
      expect(posts[0].views).toBeNull();
    });
  });
});
