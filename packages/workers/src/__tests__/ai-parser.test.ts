import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

vi.mock("@mediabot/shared", () => ({
  config: {
    ai: { model: "gemini-2.0-flash" },
    google: { apiKey: "test-key" },
    redis: { url: "redis://localhost:6379" },
    telegram: { botToken: "test" },
    database: { url: "test" },
  },
  getGeminiModel: vi.fn().mockReturnValue({
    generateContent: mockGenerateContent,
  }),
  cleanJsonResponse: (text: string) => {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    return match ? match[1].trim() : text.trim();
  },
}));

const { analyzeMention, generateDigestSummary, preFilterArticle } = await import("../analysis/ai.js");

describe("analyzeMention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse valid JSON response", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          summary: "Article mentions the client positively",
          sentiment: "POSITIVE",
          relevance: 8,
          suggestedAction: "Share with client",
        }),
      },
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
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          summary: "Test",
          sentiment: "NEUTRAL",
          relevance: 15,
          suggestedAction: "Review",
        }),
      },
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
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          summary: "Test",
          sentiment: "NEUTRAL",
          relevance: -5,
          suggestedAction: "Ignore",
        }),
      },
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
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          summary: "Test",
          sentiment: "VERY_POSITIVE",
          relevance: 5,
          suggestedAction: "OK",
        }),
      },
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
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "This is not JSON, sorry I cannot provide the analysis",
      },
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
});

describe("preFilterArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return relevant=true for matching content", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          relevant: true,
          reason: "El artículo menciona directamente a PEMEX como empresa petrolera",
          confidence: 0.95,
        }),
      },
    });

    const result = await preFilterArticle({
      articleTitle: "PEMEX anuncia nuevas inversiones",
      articleContent: "La empresa petrolera PEMEX confirmó hoy...",
      clientName: "PEMEX",
      clientDescription: "Empresa petrolera mexicana",
      keyword: "PEMEX",
    });

    expect(result.relevant).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toContain("PEMEX");
  });

  it("should return relevant=false for false positives", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          relevant: false,
          reason: "Presidencia se refiere al cargo en una empresa privada, no al cliente",
          confidence: 0.85,
        }),
      },
    });

    const result = await preFilterArticle({
      articleTitle: "Nuevo CEO asume la presidencia de la compañía",
      articleContent: "El ejecutivo tomó la presidencia de la junta directiva...",
      clientName: "Presidencia de México",
      clientDescription: "Gobierno federal mexicano",
      keyword: "presidencia",
    });

    expect(result.relevant).toBe(false);
    expect(result.confidence).toBe(0.85);
  });

  it("should clamp confidence to 0-1 range (max)", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          relevant: true,
          reason: "Match exacto",
          confidence: 1.5,
        }),
      },
    });

    const result = await preFilterArticle({
      articleTitle: "Test",
      articleContent: "Content",
      clientName: "Client",
      clientDescription: "",
      keyword: "test",
    });

    expect(result.confidence).toBe(1);
  });

  it("should clamp confidence to 0-1 range (min)", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          relevant: false,
          reason: "No match",
          confidence: -0.5,
        }),
      },
    });

    const result = await preFilterArticle({
      articleTitle: "Test",
      articleContent: "Content",
      clientName: "Client",
      clientDescription: "",
      keyword: "test",
    });

    expect(result.confidence).toBe(0);
  });

  it("should return fallback on JSON parse failure with confidence 1.0 to pass threshold", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "I cannot analyze this content properly",
      },
    });

    const result = await preFilterArticle({
      articleTitle: "Test",
      articleContent: "Content",
      clientName: "Client",
      clientDescription: "",
      keyword: "test",
    });

    // Default to relevant=true with confidence 1.0 to guarantee it passes threshold (0.6)
    expect(result.relevant).toBe(true);
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toContain("Error de parsing");
  });

  it("should return fallback on API 429 error with confidence 1.0", async () => {
    mockGenerateContent.mockRejectedValue(new Error("429 Resource has been exhausted"));

    const result = await preFilterArticle({
      articleTitle: "PEMEX inversiones",
      articleContent: "La petrolera anunció...",
      clientName: "PEMEX",
      clientDescription: "Petrolera",
      keyword: "PEMEX",
    });

    // Cuando Gemini falla (429, timeout), el fallback debe aceptar la mención
    expect(result.relevant).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  it("should handle JSON wrapped in markdown code blocks", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '```json\n{"relevant": true, "reason": "Match directo", "confidence": 0.9}\n```',
      },
    });

    const result = await preFilterArticle({
      articleTitle: "Test",
      articleContent: "Content",
      clientName: "Client",
      clientDescription: "",
      keyword: "test",
    });

    expect(result.relevant).toBe(true);
    expect(result.confidence).toBe(0.9);
  });

  it("should handle empty article content", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          relevant: true,
          reason: "Título coincide con cliente",
          confidence: 0.7,
        }),
      },
    });

    const result = await preFilterArticle({
      articleTitle: "PEMEX en las noticias",
      articleContent: "",
      clientName: "PEMEX",
      clientDescription: "Petrolera",
      keyword: "PEMEX",
    });

    expect(result.relevant).toBe(true);
  });
});

describe("generateDigestSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the text content from Gemini", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "Today there were 5 mentions, mostly positive. Focus on the El Pais article.",
      },
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

  it("should return fallback on error", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API Error"));

    const result = await generateDigestSummary({
      clientName: "Test",
      totalMentions: 0,
      sentimentBreakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
      topMentions: [],
    });

    expect(result).toBe("Resumen no disponible");
  });

  it("should accept optional socialStats parameter", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "Hoy se detectaron 5 menciones y 10 publicaciones en redes sociales.",
      },
    });

    const result = await generateDigestSummary({
      clientName: "Test Client",
      totalMentions: 5,
      sentimentBreakdown: { positive: 3, negative: 1, neutral: 1, mixed: 0 },
      topMentions: [],
      socialStats: {
        totalPosts: 10,
        platforms: { INSTAGRAM: 5, TIKTOK: 3, YOUTUBE: 2 },
        totalEngagement: 1500,
        topPost: {
          author: "influencer1",
          content: "Gran campaña de Test Client",
          likes: 500,
          platform: "INSTAGRAM",
        },
      },
    });

    expect(result).toContain("redes sociales");
    // Verificar que el prompt incluye contexto social
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents[0].parts[0].text;
    expect(promptText).toContain("Redes sociales");
    expect(promptText).toContain("INSTAGRAM");
    expect(promptText).toContain("influencer1");
  });

  it("should work without socialStats (backward compatible)", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "Resumen del día sin datos sociales.",
      },
    });

    const result = await generateDigestSummary({
      clientName: "Test",
      totalMentions: 3,
      sentimentBreakdown: { positive: 1, negative: 1, neutral: 1, mixed: 0 },
      topMentions: [],
    });

    expect(result).toBe("Resumen del día sin datos sociales.");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents[0].parts[0].text;
    // Sin socialStats, no debería incluir contexto de redes
    expect(promptText).not.toContain("Redes sociales:");
  });
});
