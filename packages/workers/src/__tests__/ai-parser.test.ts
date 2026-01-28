import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock("@mediabot/shared", () => ({
  config: {
    anthropic: { apiKey: "test-key", model: "test-model" },
    redis: { url: "redis://localhost:6379" },
    telegram: { botToken: "test" },
    database: { url: "test" },
  },
}));

const { analyzeMention, generateDigestSummary } = await import("../analysis/ai.js");

describe("analyzeMention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse valid JSON response", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          summary: "Article mentions the client positively",
          sentiment: "POSITIVE",
          relevance: 8,
          suggestedAction: "Share with client",
        }),
      }],
    });

    const result = await analyzeMention({
      articleTitle: "Company wins award",
      articleContent: "The company was awarded...",
      source: "EFE",
      clientName: "Company",
      clientDescription: "Tech company",
      clientIndustry: "Technology",
      keyword: "Company",
    });

    expect(result.sentiment).toBe("POSITIVE");
    expect(result.relevance).toBe(8);
    expect(result.summary).toBe("Article mentions the client positively");
    expect(result.suggestedAction).toBe("Share with client");
  });

  it("should clamp relevance to 1-10 range", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          summary: "Test",
          sentiment: "NEUTRAL",
          relevance: 15,
          suggestedAction: "Review",
        }),
      }],
    });

    const result = await analyzeMention({
      articleTitle: "Test",
      articleContent: "Content",
      source: "Source",
      clientName: "Client",
      clientDescription: "",
      clientIndustry: "",
      keyword: "test",
    });

    expect(result.relevance).toBe(10);
  });

  it("should clamp relevance minimum to 1", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          summary: "Test",
          sentiment: "NEUTRAL",
          relevance: -5,
          suggestedAction: "Ignore",
        }),
      }],
    });

    const result = await analyzeMention({
      articleTitle: "Test",
      articleContent: "Content",
      source: "Source",
      clientName: "Client",
      clientDescription: "",
      clientIndustry: "",
      keyword: "test",
    });

    expect(result.relevance).toBe(1);
  });

  it("should default to NEUTRAL for invalid sentiment", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          summary: "Test",
          sentiment: "VERY_POSITIVE",
          relevance: 5,
          suggestedAction: "OK",
        }),
      }],
    });

    const result = await analyzeMention({
      articleTitle: "Test",
      articleContent: "Content",
      source: "Source",
      clientName: "Client",
      clientDescription: "",
      clientIndustry: "",
      keyword: "test",
    });

    expect(result.sentiment).toBe("NEUTRAL");
  });

  it("should return fallback on JSON parse failure", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: "This is not JSON, sorry I cannot provide the analysis",
      }],
    });

    const result = await analyzeMention({
      articleTitle: "Test",
      articleContent: "Content",
      source: "Source",
      clientName: "Client",
      clientDescription: "",
      clientIndustry: "",
      keyword: "test",
    });

    expect(result.sentiment).toBe("NEUTRAL");
    expect(result.relevance).toBe(5);
    expect(result.suggestedAction).toBe("Revisar manualmente");
  });

  it("should handle non-text response type", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "image",
        source: {},
      }],
    });

    await expect(analyzeMention({
      articleTitle: "Test",
      articleContent: "Content",
      source: "Source",
      clientName: "Client",
      clientDescription: "",
      clientIndustry: "",
      keyword: "test",
    })).rejects.toThrow("Unexpected response type from Claude");
  });
});

describe("generateDigestSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the text content from Claude", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: "Today there were 5 mentions, mostly positive. Focus on the El Pais article.",
      }],
    });

    const result = await generateDigestSummary({
      clientName: "Test Client",
      totalMentions: 5,
      sentimentBreakdown: { positive: 3, negative: 1, neutral: 1, mixed: 0 },
      topMentions: [{
        title: "Test Client wins award",
        source: "El Pais",
        sentiment: "POSITIVE",
        relevance: 9,
      }],
    });

    expect(result).toContain("5 mentions");
  });

  it("should return fallback for non-text response", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "image",
        source: {},
      }],
    });

    const result = await generateDigestSummary({
      clientName: "Test",
      totalMentions: 0,
      sentimentBreakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
      topMentions: [],
    });

    expect(result).toBe("Resumen no disponible");
  });
});
