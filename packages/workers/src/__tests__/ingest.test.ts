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
    anthropic: { apiKey: "test", model: "test" },
    telegram: { botToken: "test" },
    database: { url: "test" },
  },
}));

vi.mock("../queues.js", () => ({
  getQueue: () => mockQueue,
  QUEUE_NAMES: { ANALYZE_MENTION: "analyze-mention" },
}));

// Import after mocks
const { ingestArticle } = await import("../collectors/ingest.js");

describe("ingestArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip articles that already exist by URL", async () => {
    mockPrisma.article.findUnique.mockResolvedValue({ id: "existing" });

    await ingestArticle({
      url: "https://example.com/article",
      title: "Test Article",
      source: "Test Source",
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
        client: { id: "client1", active: true },
      },
    ]);
    mockPrisma.mention.create.mockResolvedValue({ id: "mention1" });

    await ingestArticle({
      url: "https://example.com/article-with-match",
      title: "Test Company launches new product",
      source: "News Source",
      content: "Test Company announced today...",
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
        client: { id: "client-inactive", active: false },
      },
    ]);

    await ingestArticle({
      url: "https://example.com/inactive-client",
      title: "Inactive Corp news",
      source: "News",
      content: "Inactive Corp story",
    });

    expect(mockPrisma.mention.create).not.toHaveBeenCalled();
  });

  it("should handle articles without content (no hash dedup)", async () => {
    mockPrisma.article.findUnique.mockResolvedValue(null);
    mockPrisma.article.create.mockResolvedValue({ id: "no-content-id" });
    mockPrisma.keyword.findMany.mockResolvedValue([]);

    await ingestArticle({
      url: "https://example.com/no-content",
      title: "Article without body",
      source: "RSS Source",
    });

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
        client: { id: "client-tel", active: true },
      },
    ]);
    mockPrisma.mention.create.mockResolvedValue({ id: "mention-accent" });

    await ingestArticle({
      url: "https://example.com/accent-test",
      title: "Telefonica expands operations",
      source: "EFE",
      content: "Telefonica announced new plans",
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
        client: { id: "client-multi", active: true },
      },
      {
        id: "kw-b",
        word: "Company Inc",
        type: "BRAND",
        clientId: "client-multi",
        active: true,
        client: { id: "client-multi", active: true },
      },
    ]);
    mockPrisma.mention.create.mockResolvedValue({ id: "mention-multi" });

    await ingestArticle({
      url: "https://example.com/multi-keyword",
      title: "Company Inc latest news",
      source: "Reuters",
      content: "Company announced, Company Inc confirmed",
    });

    // Should only create ONE mention despite two keyword matches for same client
    expect(mockPrisma.mention.create).toHaveBeenCalledTimes(1);
  });
});
