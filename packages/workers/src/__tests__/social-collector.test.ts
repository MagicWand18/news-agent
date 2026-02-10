/**
 * Tests para el collector social - flujo de YouTube y maxAgeDays.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de dependencias
vi.mock("@mediabot/shared", () => {
  const mockPrisma = {
    client: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    socialMention: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  };

  const mockEnsembleClient = {
    isConfigured: vi.fn().mockReturnValue(true),
    getTwitterUserTweets: vi.fn().mockResolvedValue([]),
    getInstagramUserPosts: vi.fn().mockResolvedValue([]),
    getTikTokUserPosts: vi.fn().mockResolvedValue([]),
    getYouTubeChannelIdFromUsername: vi.fn().mockResolvedValue("UC_test123"),
    getYouTubeChannelVideos: vi.fn().mockResolvedValue([]),
    searchTwitter: vi.fn().mockResolvedValue([]),
    searchTikTok: vi.fn().mockResolvedValue([]),
    searchYouTube: vi.fn().mockResolvedValue([]),
    searchInstagramHashtag: vi.fn().mockResolvedValue([]),
    searchTikTokHashtag: vi.fn().mockResolvedValue([]),
  };

  return {
    prisma: mockPrisma,
    getEnsembleDataClient: () => mockEnsembleClient,
    config: {
      social: { maxAgeDays: 7 },
      socialComments: {
        enabled: true,
        tiktokMaxComments: 60,
        instagramMaxComments: 30,
        youtubeMaxComments: 30,
      },
    },
  };
});

// Importar después de los mocks
import { collectSocialForClient } from "../collectors/social";
import { getEnsembleDataClient, prisma } from "@mediabot/shared";

describe("collectSocialForClient", () => {
  const mockClient = getEnsembleDataClient();

  beforeEach(() => {
    vi.clearAllMocks();

    // Restaurar mocks por defecto del ensemble client
    (mockClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (mockClient.getYouTubeChannelIdFromUsername as ReturnType<typeof vi.fn>).mockResolvedValue("UC_test123");
    (mockClient.getYouTubeChannelVideos as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.getTwitterUserTweets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.getInstagramUserPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.getTikTokUserPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.searchTwitter as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.searchTikTok as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.searchYouTube as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.searchInstagramHashtag as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockClient.searchTikTokHashtag as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // Configurar cliente de prueba
    (prisma.client.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "client-1",
      name: "Test Client",
      socialAccounts: [
        { platform: "YOUTUBE", handle: "GoogleDevelopers", active: true },
        { platform: "TWITTER", handle: "testuser", active: true },
      ],
      keywords: [
        { word: "test keyword", type: "NAME" },
      ],
      socialHashtags: ["testhashtag"],
    });
  });

  describe("YouTube handle collection", () => {
    it("resuelve username → channelId y recolecta videos", async () => {
      const mockPosts = [
        {
          platform: "YOUTUBE" as const,
          postId: "vid1",
          postUrl: "https://youtube.com/watch?v=vid1",
          content: "Test Video",
          authorHandle: "UC_test123",
          authorName: "Google Developers",
          authorFollowers: null,
          likes: 100,
          comments: 10,
          shares: 0,
          views: 5000,
          postedAt: new Date(),
        },
      ];
      (mockClient.getYouTubeChannelVideos as ReturnType<typeof vi.fn>).mockResolvedValue(mockPosts);

      const result = await collectSocialForClient("client-1", {
        platforms: ["YOUTUBE"],
        collectHandles: true,
        collectHashtags: false,
      });

      expect(mockClient.getYouTubeChannelIdFromUsername).toHaveBeenCalledWith("GoogleDevelopers");
      expect(mockClient.getYouTubeChannelVideos).toHaveBeenCalledWith("UC_test123", 20, 7);
      expect(result.postsCollected).toBe(1);
    });

    it("no recolecta si channelId no se puede resolver", async () => {
      (mockClient.getYouTubeChannelIdFromUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await collectSocialForClient("client-1", {
        platforms: ["YOUTUBE"],
        collectHandles: true,
        collectHashtags: false,
      });

      expect(mockClient.getYouTubeChannelVideos).not.toHaveBeenCalled();
      expect(result.postsCollected).toBe(0);
    });
  });

  describe("maxAgeDays propagación", () => {
    it("pasa maxAgeDays personalizado a collectFromHandle", async () => {
      await collectSocialForClient("client-1", {
        platforms: ["TWITTER"],
        collectHandles: true,
        collectHashtags: false,
        maxAgeDays: 30,
      });

      expect(mockClient.getTwitterUserTweets).toHaveBeenCalledWith("testuser", 20, 30);
    });

    it("usa MAX_AGE_DAYS por defecto cuando no se pasa maxAgeDays", async () => {
      await collectSocialForClient("client-1", {
        platforms: ["TWITTER"],
        collectHandles: true,
        collectHashtags: false,
      });

      // Default de config.social.maxAgeDays = 7
      expect(mockClient.getTwitterUserTweets).toHaveBeenCalledWith("testuser", 20, 7);
    });

    it("pasa maxAgeDays a YouTube channel videos", async () => {
      // Asegurar que el mock de channelId retorna un valor para este test
      (mockClient.getYouTubeChannelIdFromUsername as ReturnType<typeof vi.fn>).mockResolvedValue("UC_test123");
      (mockClient.getYouTubeChannelVideos as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await collectSocialForClient("client-1", {
        platforms: ["YOUTUBE"],
        collectHandles: true,
        collectHashtags: false,
        maxAgeDays: 60,
      });

      expect(mockClient.getYouTubeChannelIdFromUsername).toHaveBeenCalledWith("GoogleDevelopers");
      expect(mockClient.getYouTubeChannelVideos).toHaveBeenCalledWith("UC_test123", 20, 60);
    });
  });

  describe("YouTube hashtag collection", () => {
    it("collectSocialForClient recolecta hashtags en plataformas soportadas", async () => {
      // collectSocialForClient solo hace handles y hashtags, no keywords
      // YouTube hashtags no están implementados (baja prioridad), verificamos que
      // las otras plataformas sí se llaman para hashtags
      (prisma.client.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "client-1",
        name: "Test Client",
        socialAccounts: [],
        keywords: [],
        socialHashtags: ["testhashtag"],
      });

      await collectSocialForClient("client-1", {
        collectHandles: false,
        collectHashtags: true,
        maxAgeDays: 30,
      });

      // Hashtags se buscan en Instagram y TikTok (YouTube hashtags no implementados)
      expect(mockClient.searchInstagramHashtag).toHaveBeenCalledWith("testhashtag", 20, 30);
      expect(mockClient.searchTikTokHashtag).toHaveBeenCalledWith("testhashtag", 20, 30);
    });
  });

  describe("filtra por plataforma", () => {
    it("solo recolecta plataformas seleccionadas", async () => {
      await collectSocialForClient("client-1", {
        platforms: ["YOUTUBE"],
        collectHandles: true,
        collectHashtags: false,
      });

      // Solo debe llamar YouTube, no Twitter
      expect(mockClient.getYouTubeChannelIdFromUsername).toHaveBeenCalled();
      expect(mockClient.getTwitterUserTweets).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("no falla si EnsembleData no está configurado", async () => {
      (mockClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await expect(
        collectSocialForClient("client-1", { platforms: ["YOUTUBE"] })
      ).rejects.toThrow("EnsembleData not configured");
    });

    it("cuenta errores sin crashear", async () => {
      (mockClient.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (mockClient.getYouTubeChannelIdFromUsername as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API timeout")
      );

      const result = await collectSocialForClient("client-1", {
        platforms: ["YOUTUBE"],
        collectHandles: true,
        collectHashtags: false,
      });

      expect(result.errors).toBe(1);
      expect(result.postsCollected).toBe(0);
    });
  });
});
