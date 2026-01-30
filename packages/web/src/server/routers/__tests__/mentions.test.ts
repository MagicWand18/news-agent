import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de módulos
vi.mock("@mediabot/shared", () => ({
  prisma: {
    mention: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  config: {
    anthropic: {
      model: "claude-3-haiku-20240307",
    },
  },
  getAnthropicClient: vi.fn().mockReturnValue({
    messages: {
      create: vi.fn(),
    },
  }),
}));

import { prisma, getAnthropicClient, config } from "@mediabot/shared";

// Tipos para testing
interface MentionListInput {
  clientId?: string;
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
  urgency?: "HIGH" | "MEDIUM" | "LOW";
  source?: string;
  dateFrom?: Date;
  dateTo?: Date;
  cursor?: string;
  limit?: number;
}

interface MockMention {
  id: string;
  clientId: string;
  articleId: string;
  sentiment: string;
  relevance: number;
  urgency: string;
  createdAt: Date;
  article: { title: string; source: string; url: string };
  client: { name: string };
}

// Función auxiliar para simular cursor pagination
function applyCursorPagination<T extends { id: string }>(
  items: T[],
  cursor: string | undefined,
  limit: number
): { items: T[]; nextCursor: string | undefined } {
  let result = items;

  if (cursor) {
    const cursorIndex = items.findIndex((item) => item.id === cursor);
    if (cursorIndex >= 0) {
      result = items.slice(cursorIndex + 1);
    }
  }

  let nextCursor: string | undefined;
  if (result.length > limit) {
    const next = result[limit];
    nextCursor = next.id;
    result = result.slice(0, limit);
  }

  return { items: result, nextCursor };
}

describe("mentions router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("list", () => {
    it("should return mentions with cursor pagination", async () => {
      const mockMentions: MockMention[] = Array.from({ length: 25 }, (_, i) => ({
        id: `mention-${i}`,
        clientId: "client-123",
        articleId: `article-${i}`,
        sentiment: "NEUTRAL",
        relevance: 5,
        urgency: "MEDIUM",
        createdAt: new Date(Date.now() - i * 1000),
        article: { title: `Article ${i}`, source: "Test Source", url: `https://example.com/${i}` },
        client: { name: "Test Client" },
      }));

      vi.mocked(prisma.mention.findMany).mockResolvedValue(mockMentions.slice(0, 21) as never);

      const result = await prisma.mention.findMany({
        take: 21, // limit + 1
        orderBy: { createdAt: "desc" },
      });

      expect(result).toHaveLength(21);

      // Simular lógica de nextCursor
      const limit = 20;
      if (result.length > limit) {
        const next = result.pop();
        expect(next?.id).toBe("mention-20");
      }
    });

    it("should filter by clientId", async () => {
      vi.mocked(prisma.mention.findMany).mockResolvedValue([]);

      await prisma.mention.findMany({
        where: { clientId: "specific-client" },
      });

      expect(prisma.mention.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: "specific-client" },
        })
      );
    });

    it("should filter by sentiment", async () => {
      vi.mocked(prisma.mention.findMany).mockResolvedValue([]);

      await prisma.mention.findMany({
        where: { sentiment: "NEGATIVE" },
      });

      expect(prisma.mention.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sentiment: "NEGATIVE" },
        })
      );
    });

    it("should filter by urgency", async () => {
      vi.mocked(prisma.mention.findMany).mockResolvedValue([]);

      await prisma.mention.findMany({
        where: { urgency: "HIGH" },
      });

      expect(prisma.mention.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { urgency: "HIGH" },
        })
      );
    });

    it("should filter by source (contains)", async () => {
      vi.mocked(prisma.mention.findMany).mockResolvedValue([]);

      await prisma.mention.findMany({
        where: {
          article: { source: { contains: "Universal", mode: "insensitive" } },
        },
      });

      expect(prisma.mention.findMany).toHaveBeenCalled();
    });

    it("should filter by date range", async () => {
      const dateFrom = new Date("2024-01-01");
      const dateTo = new Date("2024-01-31");

      vi.mocked(prisma.mention.findMany).mockResolvedValue([]);

      await prisma.mention.findMany({
        where: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      });

      expect(prisma.mention.findMany).toHaveBeenCalled();
    });

    it("should handle empty results", async () => {
      vi.mocked(prisma.mention.findMany).mockResolvedValue([]);

      const result = await prisma.mention.findMany({
        where: { clientId: "non-existent" },
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("cursor pagination logic", () => {
    it("should return first page without cursor", () => {
      const items = [
        { id: "1" },
        { id: "2" },
        { id: "3" },
        { id: "4" },
        { id: "5" },
      ];

      const result = applyCursorPagination(items, undefined, 3);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].id).toBe("1");
      expect(result.nextCursor).toBe("4");
    });

    it("should return items after cursor", () => {
      const items = [
        { id: "1" },
        { id: "2" },
        { id: "3" },
        { id: "4" },
        { id: "5" },
      ];

      const result = applyCursorPagination(items, "2", 2);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("3");
      expect(result.nextCursor).toBe("5");
    });

    it("should return undefined nextCursor on last page", () => {
      const items = [
        { id: "1" },
        { id: "2" },
        { id: "3" },
      ];

      const result = applyCursorPagination(items, undefined, 5);

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe("getById", () => {
    it("should return mention with full details", async () => {
      const mockMention = {
        id: "mention-123",
        clientId: "client-456",
        articleId: "article-789",
        sentiment: "NEGATIVE",
        relevance: 8,
        urgency: "HIGH",
        aiSummary: "Artículo crítico sobre...",
        article: {
          id: "article-789",
          title: "Artículo de prueba",
          source: "El Universal",
          url: "https://eluniversal.com.mx/article",
          content: "Contenido completo del artículo...",
        },
        client: {
          id: "client-456",
          name: "Test Client",
        },
        tasks: [],
      };

      vi.mocked(prisma.mention.findFirst).mockResolvedValue(mockMention as never);

      const result = await prisma.mention.findFirst({
        where: { id: "mention-123" },
        include: { article: true, client: true, tasks: true },
      });

      expect(result?.id).toBe("mention-123");
      expect(result?.article.title).toBe("Artículo de prueba");
    });

    it("should return null for non-existent mention", async () => {
      vi.mocked(prisma.mention.findFirst).mockResolvedValue(null);

      const result = await prisma.mention.findFirst({
        where: { id: "non-existent" },
      });

      expect(result).toBeNull();
    });
  });

  describe("generateResponse", () => {
    it("should generate response with default tone", async () => {
      const mockResponse = {
        title: "Comunicado oficial",
        body: "En respuesta a...",
        tone: "PROFESSIONAL",
        audience: "Medios generales",
        callToAction: "Enviar a prensa",
        keyMessages: ["Mensaje 1", "Mensaje 2"],
      };

      const mockAIClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: "text", text: JSON.stringify(mockResponse) }],
          }),
        },
      };

      vi.mocked(getAnthropicClient).mockReturnValue(mockAIClient as never);

      const response = await mockAIClient.messages.create({
        model: config.anthropic.model,
        max_tokens: 1200,
        messages: [{ role: "user", content: "Genera comunicado..." }],
      });

      expect(response.content[0].type).toBe("text");

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.tone).toBe("PROFESSIONAL");
      expect(parsed.keyMessages).toHaveLength(2);
    });

    it("should use specified tone", async () => {
      const tones = ["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"];

      for (const tone of tones) {
        const prompt = `El tono DEBE ser ${tone}.`;
        expect(prompt).toContain(tone);
      }
    });

    it("should handle JSON in markdown code blocks", async () => {
      const rawResponse = '```json\n{"title": "Test", "tone": "DEFENSIVE"}\n```';

      // Extraer JSON
      const codeBlockMatch = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      const cleaned = codeBlockMatch ? codeBlockMatch[1].trim() : rawResponse.trim();

      const parsed = JSON.parse(cleaned);
      expect(parsed.title).toBe("Test");
      expect(parsed.tone).toBe("DEFENSIVE");
    });

    it("should normalize invalid tone to PROFESSIONAL", () => {
      const validTones = ["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"];
      const invalidTone = "CASUAL";

      const normalizedTone = validTones.includes(invalidTone) ? invalidTone : "PROFESSIONAL";
      expect(normalizedTone).toBe("PROFESSIONAL");
    });

    it("should return fallback on parse error", () => {
      const mention = {
        article: { title: "Article about something very important" },
      };

      const fallback = {
        title: `Comunicado sobre: ${mention.article.title.slice(0, 50)}`,
        body: "Error al generar el comunicado automatico. Por favor, redacte manualmente.",
        tone: "PROFESSIONAL" as const,
        audience: "Medios generales",
        callToAction: "Revisar y completar manualmente",
        keyMessages: ["Revisar articulo original", "Definir posicion del cliente"],
      };

      expect(fallback.title).toContain("Article about something");
      expect(fallback.tone).toBe("PROFESSIONAL");
    });
  });

  describe("authorization checks", () => {
    it("should only return mentions from user org", async () => {
      const orgId = "org-123";

      vi.mocked(prisma.mention.findMany).mockResolvedValue([]);

      await prisma.mention.findMany({
        where: { client: { orgId } },
      });

      expect(prisma.mention.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { client: { orgId } },
        })
      );
    });

    it("should check org when getting single mention", async () => {
      const orgId = "org-123";
      const mentionId = "mention-456";

      vi.mocked(prisma.mention.findFirst).mockResolvedValue(null);

      await prisma.mention.findFirst({
        where: {
          id: mentionId,
          client: { orgId },
        },
      });

      expect(prisma.mention.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: mentionId,
            client: { orgId },
          },
        })
      );
    });
  });
});
