import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockPrisma = {
  article: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  keyword: {
    findMany: vi.fn(),
  },
  mention: {
    create: vi.fn(),
  },
};

// Mock queue
const mockQueue = {
  add: vi.fn(),
};

vi.mock("@mediabot/shared", () => ({
  prisma: mockPrisma,
  config: {
    redis: { url: "redis://localhost:6379" },
    ai: { model: "gemini-2.0-flash" },
    google: { apiKey: "test" },
    telegram: { botToken: "test" },
    database: { url: "test" },
    jobs: { retryAttempts: 3, backoffDelayMs: 5000 },
    articles: { maxAgeDays: 30 },
  },
  getSettingNumber: vi.fn().mockResolvedValue(0.6),
}));

vi.mock("@mediabot/shared/src/realtime-publisher.js", () => ({
  publishRealtimeEvent: vi.fn(),
}));

vi.mock("@mediabot/shared/src/realtime-types.js", () => ({
  REALTIME_CHANNELS: {
    MENTION_NEW: "mediabot:mention:new",
    MENTION_ANALYZED: "mediabot:mention:analyzed",
    SOCIAL_NEW: "mediabot:social:new",
    CRISIS_NEW: "mediabot:crisis:new",
  },
}));

vi.mock("../queues.js", () => ({
  getQueue: () => mockQueue,
  QUEUE_NAMES: { ANALYZE_MENTION: "analyze-mention" },
}));

// Mock preFilterArticle to always pass by default
const mockPreFilterArticle = vi.fn().mockResolvedValue({
  relevant: true,
  reason: "Test - always relevant",
  confidence: 0.9,
});

vi.mock("../analysis/ai.js", () => ({
  preFilterArticle: mockPreFilterArticle,
}));

// Import after mocks
const { ingestArticle } = await import("../collectors/ingest.js");

/** Fecha reciente para tests (hace 1 hora) */
const recentDate = new Date(Date.now() - 60 * 60 * 1000);

describe("ingestArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreFilterArticle.mockResolvedValue({
      relevant: true,
      reason: "Test - always relevant",
      confidence: 0.9,
    });
  });

  it("should skip articles that already exist by URL", async () => {
    mockPrisma.article.findUnique.mockResolvedValue({ id: "existing" });

    await ingestArticle({
      url: "https://example.com/article",
      title: "Test Article",
      source: "Test Source",
      publishedAt: recentDate,
    });

    expect(mockPrisma.article.findUnique).toHaveBeenCalledWith({
      where: { url: "https://example.com/article" },
    });
    expect(mockPrisma.article.create).not.toHaveBeenCalled();
  });

  it("should skip articles with duplicate content hash", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue({ id: "hash-match" });

    await ingestArticle({
      url: "https://example.com/new-article",
      title: "Test Article",
      source: "Test Source",
      content: "Some duplicate content",
      publishedAt: recentDate,
    });

    expect(mockPrisma.article.findFirst).toHaveBeenCalled();
    expect(mockPrisma.article.create).not.toHaveBeenCalled();
  });

  it("should create article and match keywords", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "new-article-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([
      {
        id: "kw1",
        word: "Test Company",
        type: "NAME",
        clientId: "client1",
        active: true,
        client: { id: "client1", active: true, name: "Test Company", description: "Tech company", orgId: "org1" },
      },
    ]);
    mockPrisma.mention.create.mockResolvedValue({ id: "mention1" });

    await ingestArticle({
      url: "https://example.com/article-with-match",
      title: "Test Company launches new product",
      source: "News Source",
      content: "Test Company announced today...",
      publishedAt: recentDate,
    });

    expect(mockPrisma.article.create).toHaveBeenCalled();
    expect(mockPrisma.mention.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          articleId: "new-article-id",
          clientId: "client1",
          keywordMatched: "Test Company",
        }),
      })
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      "analyze",
      { mentionId: "mention1" },
      expect.any(Object)
    );
  });

  it("should not create mentions for inactive clients", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "new-article-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([
      {
        id: "kw1",
        word: "Inactive Corp",
        type: "NAME",
        clientId: "client-inactive",
        active: true,
        client: { id: "client-inactive", active: false, name: "Inactive Corp", description: "" },
      },
    ]);

    await ingestArticle({
      url: "https://example.com/inactive-client",
      title: "Inactive Corp news",
      source: "News",
      content: "Inactive Corp story",
      publishedAt: recentDate,
    });

    expect(mockPrisma.mention.create).not.toHaveBeenCalled();
  });

  it("should handle articles without content (no hash dedup)", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "no-content-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([]);

    await ingestArticle({
      url: "https://example.com/2026/02/18/no-content",
      title: "Article without body",
      source: "RSS Source",
    });

    // URL con fecha, así que extrae fecha y pasa validación
    expect(mockPrisma.article.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.article.create).toHaveBeenCalled();
  });

  it("should match keywords with accent normalization", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "accent-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([
      {
        id: "kw-accent",
        word: "Telefonica",
        type: "NAME",
        clientId: "client-tel",
        active: true,
        client: { id: "client-tel", active: true, name: "Telefonica", description: "Telecoms", orgId: "org1" },
      },
    ]);
    mockPrisma.mention.create.mockResolvedValue({ id: "mention-accent" });

    await ingestArticle({
      url: "https://example.com/accent-test",
      title: "Telefonica expands operations",
      source: "EFE",
      content: "Telefonica announced new plans",
      publishedAt: recentDate,
    });

    expect(mockPrisma.mention.create).toHaveBeenCalled();
  });

  it("should group matches by client (one mention per client per article)", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "multi-kw-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([
      {
        id: "kw-a",
        word: "Company",
        type: "NAME",
        clientId: "client-multi",
        active: true,
        client: { id: "client-multi", active: true, name: "Company", description: "", orgId: "org1" },
      },
      {
        id: "kw-b",
        word: "Company Inc",
        type: "BRAND",
        clientId: "client-multi",
        active: true,
        client: { id: "client-multi", active: true, name: "Company", description: "", orgId: "org1" },
      },
    ]);
    mockPrisma.mention.create.mockResolvedValue({ id: "mention-multi" });

    await ingestArticle({
      url: "https://example.com/multi-keyword",
      title: "Company Inc latest news",
      source: "Reuters",
      content: "Company announced, Company Inc confirmed",
      publishedAt: recentDate,
    });

    expect(mockPrisma.mention.create).toHaveBeenCalledTimes(1);
  });

  it("should skip mention creation when pre-filter returns not relevant", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "prefilter-skip-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([
      {
        id: "kw-pres",
        word: "presidencia",
        type: "NAME",
        clientId: "client-pres",
        active: true,
        client: { id: "client-pres", active: true, name: "Presidencia de México", description: "Gobierno", orgId: "org1" },
      },
    ]);

    mockPreFilterArticle.mockResolvedValue({
      relevant: false,
      reason: "Se refiere a presidencia de empresa privada",
      confidence: 0.85,
    });

    await ingestArticle({
      url: "https://example.com/false-positive",
      title: "CEO asume presidencia de la junta",
      source: "Business News",
      content: "El ejecutivo tomó la presidencia de la compañía",
      publishedAt: recentDate,
    });

    expect(mockPrisma.article.create).toHaveBeenCalled();
    expect(mockPrisma.mention.create).not.toHaveBeenCalled();
  });

  it("should skip mention when pre-filter confidence is below threshold", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "low-conf-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([
      {
        id: "kw-low",
        word: "Test Corp",
        type: "NAME",
        clientId: "client-low",
        active: true,
        client: { id: "client-low", active: true, name: "Test Corp", description: "", orgId: "org1" },
      },
    ]);

    mockPreFilterArticle.mockResolvedValue({
      relevant: true,
      reason: "Posible match pero incierto",
      confidence: 0.4,
    });

    await ingestArticle({
      url: "https://example.com/low-confidence",
      title: "Test Corp mentioned somewhere",
      source: "News",
      content: "Something about test corp maybe",
      publishedAt: recentDate,
    });

    expect(mockPrisma.mention.create).not.toHaveBeenCalled();
  });

  it("should create mention when pre-filter passes with high confidence", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "high-conf-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([
      {
        id: "kw-high",
        word: "PEMEX",
        type: "NAME",
        clientId: "client-pemex",
        active: true,
        client: { id: "client-pemex", active: true, name: "PEMEX", description: "Petrolera mexicana", orgId: "org1" },
      },
    ]);
    mockPrisma.mention.create.mockResolvedValue({ id: "mention-pemex" });

    mockPreFilterArticle.mockResolvedValue({
      relevant: true,
      reason: "Mención directa de PEMEX como empresa",
      confidence: 0.95,
    });

    await ingestArticle({
      url: "https://example.com/pemex-news",
      title: "PEMEX anuncia inversiones",
      source: "Reuters",
      content: "La petrolera PEMEX confirmó nuevas inversiones",
      publishedAt: recentDate,
    });

    expect(mockPreFilterArticle).toHaveBeenCalledWith({
      articleTitle: "PEMEX anuncia inversiones",
      articleContent: "La petrolera PEMEX confirmó nuevas inversiones",
      clientName: "PEMEX",
      clientDescription: "Petrolera mexicana",
      keyword: "PEMEX",
    });
    expect(mockPrisma.mention.create).toHaveBeenCalled();
  });

  it("should create mention when pre-filter throws error (fail-open)", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.findFirst.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "error-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([
      {
        id: "kw-err",
        word: "Error Corp",
        type: "NAME",
        clientId: "client-err",
        active: true,
        client: { id: "client-err", active: true, name: "Error Corp", description: "", orgId: "org1" },
      },
    ]);
    mockPrisma.mention.create.mockResolvedValue({ id: "mention-err" });

    mockPreFilterArticle.mockRejectedValue(new Error("API timeout"));

    await ingestArticle({
      url: "https://example.com/api-error",
      title: "Error Corp news",
      source: "News",
      content: "Error Corp did something",
      publishedAt: recentDate,
    });

    expect(mockPrisma.mention.create).toHaveBeenCalled();
  });

  // ============ Sprint 20: Validación robusta de fechas ============

  describe("Sprint 20 - URL filter", () => {
    it("should skip tag pages", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      await ingestArticle({
        url: "https://example.com/tags/politica",
        title: "Política",
        source: "News",
        publishedAt: recentDate,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should skip category pages", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      await ingestArticle({
        url: "https://example.com/categoria/nacional",
        title: "Nacional",
        source: "News",
        publishedAt: recentDate,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should skip author pages", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      await ingestArticle({
        url: "https://example.com/author/juan-perez",
        title: "Juan Perez",
        source: "News",
        publishedAt: recentDate,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should skip RSS feed URLs", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      await ingestArticle({
        url: "https://example.com/feed/",
        title: "RSS Feed",
        source: "News",
        publishedAt: recentDate,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should skip search pages", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      await ingestArticle({
        url: "https://example.com/search?q=test",
        title: "Search Results",
        source: "News",
        publishedAt: recentDate,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should skip landing pages (domain only)", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      await ingestArticle({
        url: "https://example.com/",
        title: "Example",
        source: "News",
        publishedAt: recentDate,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });
  });

  describe("Sprint 20 - Date from URL fallback", () => {
    it("should extract date from URL pattern /YYYY/MM/DD/", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);
      mockPrisma.article.create.mockResolvedValue({ id: "url-date-id" });
      mockPrisma.keyword.findMany.mockResolvedValue([]);

      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");

      await ingestArticle({
        url: `https://example.com/${y}/${m}/${d}/some-article`,
        title: "Article with date in URL",
        source: "News",
        // Sin publishedAt — se extrae de la URL
      });

      expect(mockPrisma.article.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publishedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe("Sprint 20 - No-date rejection", () => {
    it("should skip articles without date (non-YouTube)", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);
      mockPrisma.article.findFirst.mockResolvedValue(null);

      await ingestArticle({
        url: "https://example.com/no-date-article",
        title: "Article without any date",
        source: "Unknown Source",
        // Sin publishedAt, URL sin patrón de fecha
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should allow YouTube articles without date", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);
      mockPrisma.article.findFirst.mockResolvedValue(null);
      mockPrisma.article.create.mockResolvedValue({ id: "yt-id" });
      mockPrisma.keyword.findMany.mockResolvedValue([]);

      await ingestArticle({
        url: "https://youtube.com/watch?v=abc123",
        title: "YouTube video",
        source: "YouTube",
        // Sin publishedAt — permitido porque es YouTube
      });

      expect(mockPrisma.article.create).toHaveBeenCalled();
    });

    it("should allow youtu.be articles without date", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);
      mockPrisma.article.findFirst.mockResolvedValue(null);
      mockPrisma.article.create.mockResolvedValue({ id: "ytbe-id" });
      mockPrisma.keyword.findMany.mockResolvedValue([]);

      await ingestArticle({
        url: "https://youtu.be/abc123",
        title: "YouTube short link",
        source: "YouTube",
      });

      expect(mockPrisma.article.create).toHaveBeenCalled();
    });
  });

  describe("Sprint 20 - Date validation", () => {
    it("should skip articles with future dates (>24h)", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);
      mockPrisma.article.findFirst.mockResolvedValue(null);

      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 días

      await ingestArticle({
        url: "https://example.com/future-article",
        title: "Future Article",
        source: "News",
        publishedAt: futureDate,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should skip articles older than 5 years", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);
      mockPrisma.article.findFirst.mockResolvedValue(null);

      const veryOldDate = new Date("2015-01-01");

      await ingestArticle({
        url: "https://example.com/old-article",
        title: "Very Old Article",
        source: "News",
        publishedAt: veryOldDate,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should skip articles older than 48h", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);
      mockPrisma.article.findFirst.mockResolvedValue(null);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      await ingestArticle({
        url: "https://example.com/stale-article",
        title: "Stale Article",
        source: "News",
        publishedAt: threeDaysAgo,
      });

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it("should accept articles within 48h window", async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);
      mockPrisma.article.findFirst.mockResolvedValue(null);
      mockPrisma.article.create.mockResolvedValue({ id: "recent-id" });
      mockPrisma.keyword.findMany.mockResolvedValue([]);

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      await ingestArticle({
        url: "https://example.com/recent-article",
        title: "Recent Article",
        source: "News",
        publishedAt: oneHourAgo,
      });

      expect(mockPrisma.article.create).toHaveBeenCalled();
    });
  });
});
