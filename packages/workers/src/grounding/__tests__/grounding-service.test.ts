import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de prisma antes de importar el módulo
vi.mock("@mediabot/shared", () => ({
  prisma: {
    article: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    mention: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    client: {
      update: vi.fn(),
    },
  },
  config: {
    google: {
      apiKey: "test-google-api-key",
      cseApiKey: "test-cse-api-key",
      cseCx: "test-cse-cx",
    },
  },
}));

// Mock de Google Generative AI
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
    }),
  })),
}));

import { prisma, config } from "@mediabot/shared";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Importar después de los mocks
import {
  executeGroundingSearch,
  checkLowMentions,
  type GroundingParams,
} from "../grounding-service";

describe("grounding-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("executeGroundingSearch", () => {
    const baseParams: GroundingParams = {
      clientId: "client-123",
      clientName: "Test Client",
      industry: "Technology",
      days: 30,
      articleCount: 10,
      trigger: "manual",
    };

    it("should return error when GOOGLE_API_KEY is not configured", async () => {
      // Simular que no hay API key
      vi.mocked(config).google = { apiKey: "", cseApiKey: "", cseCx: "" };

      const result = await executeGroundingSearch(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("GOOGLE_API_KEY");
      expect(result.articlesFound).toBe(0);
      expect(result.mentionsCreated).toBe(0);

      // Restaurar
      vi.mocked(config).google = { apiKey: "test-google-api-key", cseApiKey: "test-cse-api-key", cseCx: "test-cse-cx" };
    });

    it("should parse Gemini response and create articles", async () => {
      const mockGeminiResponse = {
        articles: [
          {
            title: "Test Article 1",
            source: "El Universal",
            url: "https://eluniversal.com.mx/article1",
            snippet: "This is a test snippet",
            date: "2024-01-15",
          },
          {
            title: "Test Article 2",
            source: "Milenio",
            url: "https://milenio.com/article2",
            snippet: "Another test snippet",
            date: "2024-01-14",
          },
        ],
      };

      // Mock de generateContent
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify(mockGeminiResponse),
          },
        }),
      };

      vi.mocked(GoogleGenerativeAI).mockImplementation(
        () =>
          ({
            getGenerativeModel: () => mockModel,
          }) as unknown as InstanceType<typeof GoogleGenerativeAI>
      );

      // Mock de prisma - artículos no existen
      vi.mocked(prisma.article.findFirst).mockResolvedValue(null);
      (prisma.article.create as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `article-${Math.random()}`,
        url: data.url as string,
        title: data.title as string,
        source: data.source as string,
        content: data.content as string | null,
        contentHash: null,
        publishedAt: data.publishedAt as Date | null,
        collectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        fetchedAt: null,
      }));

      // Mock de menciones - no existen
      vi.mocked(prisma.mention.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.mention.create).mockResolvedValue({
        id: "mention-123",
        articleId: "article-123",
        clientId: baseParams.clientId,
        keywordMatched: baseParams.clientName,
        sentiment: "NEUTRAL",
        relevance: 6,
        urgency: "MEDIUM",
        snippet: null,
        aiSummary: null,
        topic: null,
        parentMentionId: null,
        createdAt: new Date(),
      } as never);

      // Mock de artículos en DB (fallback)
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);

      vi.mocked(prisma.client.update).mockResolvedValue({} as never);

      const result = await executeGroundingSearch(baseParams);

      expect(result.success).toBe(true);
      expect(result.articlesFound).toBe(2);
      expect(result.mentionsCreated).toBe(2);
      expect(result.trigger).toBe("manual");
    });

    it("should skip duplicate articles by URL", async () => {
      const mockGeminiResponse = {
        articles: [
          {
            title: "Duplicate Article",
            source: "Source 1",
            url: "https://example.com/duplicate",
            snippet: "First occurrence",
          },
          {
            title: "Duplicate Article Copy",
            source: "Source 2",
            url: "https://example.com/duplicate", // Misma URL
            snippet: "Second occurrence",
          },
        ],
      };

      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify(mockGeminiResponse),
          },
        }),
      };

      vi.mocked(GoogleGenerativeAI).mockImplementation(
        () =>
          ({
            getGenerativeModel: () => mockModel,
          }) as unknown as InstanceType<typeof GoogleGenerativeAI>
      );

      vi.mocked(prisma.article.findFirst).mockResolvedValue(null);
      (prisma.article.create as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `article-${Math.random()}`,
        url: data.url as string,
        title: data.title as string,
        source: data.source as string,
        content: data.content as string | null,
        contentHash: null,
        publishedAt: data.publishedAt as Date | null,
        collectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        fetchedAt: null,
      }));
      vi.mocked(prisma.mention.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.mention.create).mockResolvedValue({} as never);
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);
      vi.mocked(prisma.client.update).mockResolvedValue({} as never);

      const result = await executeGroundingSearch(baseParams);

      // Solo debería crear 1 artículo (el duplicado se ignora)
      expect(result.articlesFound).toBe(1);
    });

    it("should handle Gemini API errors gracefully", async () => {
      const mockModel = {
        generateContent: vi.fn().mockRejectedValue(new Error("API rate limit exceeded")),
      };

      vi.mocked(GoogleGenerativeAI).mockImplementation(
        () =>
          ({
            getGenerativeModel: () => mockModel,
          }) as unknown as InstanceType<typeof GoogleGenerativeAI>
      );

      vi.mocked(prisma.client.update).mockResolvedValue({} as never);

      const result = await executeGroundingSearch(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("API rate limit exceeded");
      expect(result.articlesFound).toBe(0);
    });

    it("should handle malformed JSON from Gemini", async () => {
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => "This is not valid JSON",
          },
        }),
      };

      vi.mocked(GoogleGenerativeAI).mockImplementation(
        () =>
          ({
            getGenerativeModel: () => mockModel,
          }) as unknown as InstanceType<typeof GoogleGenerativeAI>
      );

      vi.mocked(prisma.client.update).mockResolvedValue({} as never);

      const result = await executeGroundingSearch(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("checkLowMentions", () => {
    it("should return true when all days have low mentions", async () => {
      // Simular 0 menciones cada día
      vi.mocked(prisma.mention.count).mockResolvedValue(0);

      const result = await checkLowMentions("client-123", 3, 5);

      expect(result).toBe(true);
      expect(prisma.mention.count).toHaveBeenCalledTimes(5);
    });

    it("should return false when any day meets the threshold", async () => {
      // Simular: día 0=0, día 1=5, día 2=0 (día 1 cumple threshold de 3)
      vi.mocked(prisma.mention.count)
        .mockResolvedValueOnce(0) // Día 0
        .mockResolvedValueOnce(5) // Día 1 - cumple threshold
        .mockResolvedValueOnce(0); // No debería llegar aquí

      const result = await checkLowMentions("client-123", 3, 3);

      expect(result).toBe(false);
      // Debería parar después de encontrar un día que cumple
      expect(prisma.mention.count).toHaveBeenCalledTimes(2);
    });

    it("should check consecutive days correctly", async () => {
      const minDailyMentions = 2;
      const consecutiveDays = 3;

      vi.mocked(prisma.mention.count).mockResolvedValue(1); // Siempre por debajo del umbral

      await checkLowMentions("client-123", minDailyMentions, consecutiveDays);

      // Debería verificar exactamente consecutiveDays días
      expect(prisma.mention.count).toHaveBeenCalledTimes(consecutiveDays);

      // Verificar que las fechas son correctas
      const calls = vi.mocked(prisma.mention.count).mock.calls;
      for (let i = 0; i < consecutiveDays; i++) {
        const call = calls[i]?.[0];
        expect(call?.where?.clientId).toBe("client-123");
        expect(call?.where?.createdAt).toBeDefined();
      }
    });

    it("should return true for exactly at threshold", async () => {
      // Si el umbral es 3 y hay exactamente 3, NO es "bajo"
      vi.mocked(prisma.mention.count).mockResolvedValue(3);

      const result = await checkLowMentions("client-123", 3, 3);

      // 3 >= 3, así que el primer día cumple y retorna false
      expect(result).toBe(false);
    });

    it("should return true when just below threshold", async () => {
      // Si el umbral es 3 y hay 2, ES "bajo"
      vi.mocked(prisma.mention.count).mockResolvedValue(2);

      const result = await checkLowMentions("client-123", 3, 3);

      expect(result).toBe(true);
    });
  });
});
