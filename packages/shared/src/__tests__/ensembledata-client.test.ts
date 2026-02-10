/**
 * Tests para el cliente de EnsembleData - YouTube y normalización.
 * Usa las estructuras reales de la API (videoRenderer, commentThreadRenderer).
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
    it("retorna directamente si ya es un channel ID (UC...)", async () => {
      const result = await client.getYouTubeChannelIdFromUsername("UC_x5XG1OV2P6uZZ5FSM9Ttw");
      expect(result).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
      // No debe hacer fetch si ya es un channel ID
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("busca por nombre y extrae browseId del resultado", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            posts: [
              {
                videoRenderer: {
                  videoId: "abc123",
                  title: { runs: [{ text: "Some Video" }] },
                  ownerText: {
                    runs: [{
                      text: "Google Developers",
                      navigationEndpoint: {
                        browseEndpoint: { browseId: "UC_x5XG1OV2P6uZZ5FSM9Ttw" },
                      },
                    }],
                  },
                },
              },
            ],
          },
          units_charged: 1,
        }),
      });

      const result = await client.getYouTubeChannelIdFromUsername("Google Developers");
      expect(result).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
    });

    it("retorna null cuando no hay resultados", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { posts: [] }, units_charged: 1 }),
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
    it("retorna info del canal desde channel/videos endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: {
              title: "Test Channel",
              description: "A test channel",
              urlCanonical: "https://youtube.com/@testchannel",
            },
            videos: [],
          },
          units_charged: 1,
        }),
      });

      const result = await client.getYouTubeChannelInfo("UC_test");
      expect(result).not.toBeNull();
      expect(result!.channelId).toBe("UC_test");
      expect(result!.title).toBe("Test Channel");
      expect(result!.description).toBe("A test channel");
    });

    it("retorna null en caso de error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("API error"));

      const result = await client.getYouTubeChannelInfo("UC_test");
      expect(result).toBeNull();
    });
  });

  describe("getYouTubeChannelVideos", () => {
    it("retorna videos normalizados con estructura richItemRenderer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { title: "Test Channel" },
            videos: [
              {
                richItemRenderer: {
                  content: {
                    videoRenderer: {
                      videoId: "abc123",
                      title: { runs: [{ text: "Test Video" }] },
                      publishedTimeText: { simpleText: "2 days ago" },
                      viewCountText: { simpleText: "5,000 views" },
                      ownerText: {
                        runs: [{
                          text: "Test Channel",
                          navigationEndpoint: {
                            browseEndpoint: { browseId: "UC_test" },
                          },
                        }],
                      },
                    },
                  },
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
      expect(posts[0].authorHandle).toBe("UC_test");
      expect(posts[0].views).toBe(5000);

      // Verificar que usa browseId
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("browseId=UC_test");
    });

    it("filtra videos antiguos con maxAgeDays", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { title: "Ch" },
            videos: [
              {
                richItemRenderer: {
                  content: {
                    videoRenderer: {
                      videoId: "old1",
                      title: { runs: [{ text: "Old Video" }] },
                      publishedTimeText: { simpleText: "60 days ago" },
                      viewCountText: { simpleText: "100 views" },
                    },
                  },
                },
              },
              {
                richItemRenderer: {
                  content: {
                    videoRenderer: {
                      videoId: "new1",
                      title: { runs: [{ text: "New Video" }] },
                      publishedTimeText: { simpleText: "2 days ago" },
                      viewCountText: { simpleText: "200 views" },
                    },
                  },
                },
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
    it("busca videos por keyword con estructura videoRenderer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            posts: [
              {
                videoRenderer: {
                  videoId: "xyz789",
                  title: { runs: [{ text: "Search Result" }] },
                  publishedTimeText: { simpleText: "1 day ago" },
                  viewCountText: { simpleText: "1,000 views" },
                  ownerText: {
                    runs: [{
                      text: "Creator",
                      navigationEndpoint: {
                        browseEndpoint: { browseId: "UC_creator" },
                      },
                    }],
                  },
                },
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

      // Verificar que usa /youtube/search (no /youtube/keyword/search)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("/youtube/search");
      expect(calledUrl).not.toContain("/keyword/");
      expect(calledUrl).toContain("period=month");
    });

    it("mapea días a period correcto", async () => {
      // Test 7 días → week
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { posts: [] }, units_charged: 1 }),
      });
      await client.searchYouTube("test", 10, 7);
      expect(mockFetch.mock.calls[0][0]).toContain("period=week");

      // Test 1 día → today
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { posts: [] }, units_charged: 1 }),
      });
      await client.searchYouTube("test", 10, 1);
      expect(mockFetch.mock.calls[1][0]).toContain("period=today");

      // Test 60 días → year
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { posts: [] }, units_charged: 1 }),
      });
      await client.searchYouTube("test", 10, 60);
      expect(mockFetch.mock.calls[2][0]).toContain("period=year");
    });
  });

  describe("getYouTubeVideoComments", () => {
    it("extrae y normaliza comentarios con estructura commentThreadRenderer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: [
              {
                commentThreadRenderer: {
                  comment: {
                    properties: {
                      commentId: "comment1",
                      content: { content: "Great video!" },
                      publishedTime: "2 days ago",
                    },
                    author: {
                      channelId: "UC_user1",
                      displayName: "User1",
                    },
                    toolbar: {
                      likeCountNotliked: "5",
                      replyCount: "2",
                    },
                  },
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
      expect(comments[0].authorHandle).toBe("UC_user1");
      expect(comments[0].likes).toBe(5);
      expect(comments[0].replies).toBe(2);
      expect(comments[0].postedAt).toBeInstanceOf(Date);
    });

    it("parsea likes formateados (176K)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: [
              {
                commentThreadRenderer: {
                  comment: {
                    properties: {
                      commentId: "top_comment",
                      content: { content: "Amazing!" },
                      publishedTime: "9 months ago",
                    },
                    author: {
                      channelId: "UC_popular",
                      displayName: "Popular User",
                    },
                    toolbar: {
                      likeCountNotliked: "176K",
                      replyCount: "959",
                    },
                  },
                },
              },
            ],
          },
          units_charged: 1,
        }),
      });

      const comments = await client.getYouTubeVideoComments("abc123", 10);
      expect(comments[0].likes).toBe(176000);
      expect(comments[0].replies).toBe(959);
    });

    it("maneja paginación con nextCursor", async () => {
      // Primera página
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: Array.from({ length: 20 }, (_, i) => ({
              commentThreadRenderer: {
                comment: {
                  properties: {
                    commentId: `comment_${i}`,
                    content: { content: `Comment ${i}` },
                    publishedTime: "1 day ago",
                  },
                  author: { channelId: `UC_${i}`, displayName: `User${i}` },
                  toolbar: { likeCountNotliked: "0", replyCount: "0" },
                },
              },
            })),
            nextCursor: "cursor_page2",
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
              commentThreadRenderer: {
                comment: {
                  properties: {
                    commentId: `comment_2_${i}`,
                    content: { content: `Comment page2 ${i}` },
                    publishedTime: "2 days ago",
                  },
                  author: { channelId: `UC_2_${i}`, displayName: `User2_${i}` },
                  toolbar: { likeCountNotliked: "0", replyCount: "0" },
                },
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
    it("valida un channel ID directamente (UC...)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { title: "Valid Channel" },
            videos: [],
          },
          units_charged: 1,
        }),
      });

      const result = await client.validateHandle("YOUTUBE", "UC_valid");
      expect(result.valid).toBe(true);
      expect(result.platformUserId).toBe("UC_valid");
    });

    it("valida un nombre de canal via búsqueda", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            posts: [
              {
                videoRenderer: {
                  videoId: "v1",
                  ownerText: {
                    runs: [{
                      text: "Google Developers",
                      navigationEndpoint: {
                        browseEndpoint: { browseId: "UC_google" },
                      },
                    }],
                  },
                },
              },
            ],
          },
          units_charged: 1,
        }),
      });

      const result = await client.validateHandle("YOUTUBE", "GoogleDevelopers");
      expect(result.valid).toBe(true);
      expect(result.platformUserId).toBe("UC_google");
    });

    it("rechaza un canal inexistente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { posts: [] }, units_charged: 1 }),
      });

      const result = await client.validateHandle("YOUTUBE", "nonexistent");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Canal no encontrado");
    });
  });

  // ==================== NORMALIZACIÓN ====================

  describe("normalización YouTube videoRenderer", () => {
    it("normaliza video con estructura richItemRenderer real", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { title: "Mi Canal" },
            videos: [{
              richItemRenderer: {
                content: {
                  videoRenderer: {
                    videoId: "v1",
                    title: { runs: [{ text: "Mi Video" }] },
                    publishedTimeText: { simpleText: "3 days ago" },
                    viewCountText: { simpleText: "10,000 views" },
                    ownerText: {
                      runs: [{
                        text: "Mi Canal",
                        navigationEndpoint: {
                          browseEndpoint: { browseId: "UC_mi" },
                        },
                      }],
                    },
                  },
                },
              },
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
      expect(post.shares).toBe(0);
      expect(post.postedAt).toBeInstanceOf(Date);
    });

    it("maneja video sin viewCountText", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { title: "Canal" },
            videos: [{
              richItemRenderer: {
                content: {
                  videoRenderer: {
                    videoId: "v2",
                    title: { runs: [{ text: "Video sin views" }] },
                  },
                },
              },
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

  // ==================== INSTAGRAM COMMENTS ====================

  describe("getInstagramPostComments", () => {
    it("envía cursor vacío en la primera petición", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: [
              {
                node: {
                  pk: "12345",
                  text: "Great post!",
                  created_at: 1770754306,
                  comment_like_count: 5,
                  child_comment_count: 2,
                  user: { username: "testuser", full_name: "Test User" },
                },
              },
            ],
            nextCursor: null,
          },
          units_charged: 4,
        }),
      });

      const comments = await client.getInstagramPostComments("media123", 10);
      expect(comments).toHaveLength(1);
      expect(comments[0].commentId).toBe("12345");
      expect(comments[0].text).toBe("Great post!");
      expect(comments[0].authorHandle).toBe("testuser");
      expect(comments[0].replies).toBe(2);

      // Verificar que cursor= se envía (no filtrado)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("cursor=");
    });

    it("maneja paginación con nextCursor", async () => {
      // Primera página
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: Array.from({ length: 15 }, (_, i) => ({
              node: {
                pk: `pk_${i}`,
                text: `Comment ${i}`,
                created_at: 1770754306,
                user: { username: `user${i}` },
              },
            })),
            nextCursor: "next_page_token",
          },
          units_charged: 4,
        }),
      });

      // Segunda página
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            comments: Array.from({ length: 10 }, (_, i) => ({
              node: {
                pk: `pk_2_${i}`,
                text: `Comment page2 ${i}`,
                created_at: 1770754306,
                user: { username: `user2_${i}` },
              },
            })),
            nextCursor: null,
          },
          units_charged: 4,
        }),
      });

      const comments = await client.getInstagramPostComments("media123", 20);
      expect(comments).toHaveLength(20);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
