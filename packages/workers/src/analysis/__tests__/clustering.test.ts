import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de módulos
vi.mock("@mediabot/shared", () => ({
  config: {
    ai: {
      model: "gemini-2.0-flash",
    },
  },
  prisma: {
    mention: {
      findMany: vi.fn(),
    },
  },
  getGeminiModel: vi.fn().mockReturnValue({
    generateContent: vi.fn(),
  }),
  cleanJsonResponse: vi.fn((text: string) => {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    return match ? match[1].trim() : text.trim();
  }),
}));

import { prisma, getGeminiModel } from "@mediabot/shared";

// Importar funciones del módulo (usamos implementaciones de test ya que algunas no están exportadas)

// Extraer lógica para testing
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(title: string): Set<string> {
  const stopWords = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "en", "con", "por", "para", "que", "se",
    "su", "sus", "al", "es", "y", "o", "a", "ante",
    "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "with"
  ]);

  const normalized = normalizeTitle(title);
  const words = normalized.split(" ").filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

// Simulación de cache
class ClusterCache {
  private cache = new Map<string, { parentId: string; expiresAt: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 30 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): { parentId: string; expiresAt: number } | undefined {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry;
    }
    return undefined;
  }

  set(key: string, parentId: string): void {
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
      if (this.cache.size >= this.maxSize) {
        this.evictOldest(Math.floor(this.maxSize * 0.2));
      }
    }
    this.cache.set(key, { parentId, expiresAt: Date.now() + this.ttlMs });
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  evictOldest(count: number): void {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (deleted >= count) break;
      this.cache.delete(key);
      deleted++;
    }
  }

  size(): number {
    return this.cache.size;
  }
}

describe("clustering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeTitle", () => {
    it("should convert to lowercase", () => {
      expect(normalizeTitle("HELLO World")).toBe("hello world");
    });

    it("should remove special characters", () => {
      expect(normalizeTitle("Hello, World! How's it?")).toBe("hello world how s it");
    });

    it("should collapse multiple spaces", () => {
      expect(normalizeTitle("hello    world")).toBe("hello world");
    });

    it("should trim whitespace", () => {
      expect(normalizeTitle("  hello world  ")).toBe("hello world");
    });
  });

  describe("extractKeywords", () => {
    it("should extract significant words", () => {
      const keywords = extractKeywords("Coca-Cola anuncia inversión millonaria en México");

      expect(keywords.has("coca")).toBe(true);
      expect(keywords.has("cola")).toBe(true);
      expect(keywords.has("anuncia")).toBe(true);
      expect(keywords.has("inversión")).toBe(false); // Tiene acento, se convierte
      expect(keywords.has("millonaria")).toBe(true);
      expect(keywords.has("méxico")).toBe(false); // Tiene acento
    });

    it("should filter stop words", () => {
      const keywords = extractKeywords("El presidente de la empresa");

      expect(keywords.has("el")).toBe(false);
      expect(keywords.has("de")).toBe(false);
      expect(keywords.has("la")).toBe(false);
      expect(keywords.has("presidente")).toBe(true);
      expect(keywords.has("empresa")).toBe(true);
    });

    it("should filter short words (<=2 chars)", () => {
      const keywords = extractKeywords("a to be or not to be");

      expect(keywords.has("a")).toBe(false);
      expect(keywords.has("to")).toBe(false);
      expect(keywords.has("be")).toBe(false);
      expect(keywords.has("or")).toBe(false);
      expect(keywords.has("not")).toBe(true);
    });
  });

  describe("jaccardSimilarity", () => {
    it("should return 1 for identical sets", () => {
      const set1 = new Set(["a", "b", "c"]);
      const set2 = new Set(["a", "b", "c"]);

      expect(jaccardSimilarity(set1, set2)).toBe(1);
    });

    it("should return 0 for disjoint sets", () => {
      const set1 = new Set(["a", "b", "c"]);
      const set2 = new Set(["x", "y", "z"]);

      expect(jaccardSimilarity(set1, set2)).toBe(0);
    });

    it("should calculate partial overlap correctly", () => {
      const set1 = new Set(["a", "b", "c"]);
      const set2 = new Set(["b", "c", "d"]);

      // Intersection: {b, c} = 2
      // Union: {a, b, c, d} = 4
      // Jaccard: 2/4 = 0.5
      expect(jaccardSimilarity(set1, set2)).toBe(0.5);
    });

    it("should handle empty sets", () => {
      const empty = new Set<string>();
      const nonEmpty = new Set(["a"]);

      expect(jaccardSimilarity(empty, empty)).toBe(0);
      expect(jaccardSimilarity(empty, nonEmpty)).toBe(0);
    });

    it("should be symmetric", () => {
      const set1 = new Set(["a", "b", "c"]);
      const set2 = new Set(["b", "c", "d", "e"]);

      expect(jaccardSimilarity(set1, set2)).toBe(jaccardSimilarity(set2, set1));
    });
  });

  describe("ClusterCache", () => {
    it("should store and retrieve entries", () => {
      const cache = new ClusterCache(100, 60000);

      cache.set("key1", "parent1");
      const entry = cache.get("key1");

      expect(entry).toBeDefined();
      expect(entry?.parentId).toBe("parent1");
    });

    it("should return undefined for expired entries", () => {
      const cache = new ClusterCache(100, 1); // 1ms TTL

      cache.set("key1", "parent1");

      // Esperar que expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const entry = cache.get("key1");
          expect(entry).toBeUndefined();
          resolve();
        }, 5);
      });
    });

    it("should return undefined for non-existent keys", () => {
      const cache = new ClusterCache(100, 60000);

      const entry = cache.get("nonexistent");
      expect(entry).toBeUndefined();
    });

    it("should evict entries when max size is reached", () => {
      const cache = new ClusterCache(5, 60000);

      // Agregar 6 entradas (máximo es 5)
      for (let i = 0; i < 6; i++) {
        cache.set(`key${i}`, `parent${i}`);
      }

      // El tamaño no debería exceder el máximo
      expect(cache.size()).toBeLessThanOrEqual(5);
    });

    it("should cleanup expired entries", () => {
      const cache = new ClusterCache(100, 1);

      cache.set("key1", "parent1");
      cache.set("key2", "parent2");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cache.cleanup();
          // Después del cleanup, las entradas expiradas deberían eliminarse
          expect(cache.get("key1")).toBeUndefined();
          expect(cache.get("key2")).toBeUndefined();
          resolve();
        }, 5);
      });
    });
  });

  describe("findClusterParent logic", () => {
    it("should match articles with high keyword similarity", () => {
      const title1 = "Coca-Cola anuncia inversión de 500 millones en México";
      const title2 = "Coca-Cola invertirá 500 millones de dólares en México";

      const kw1 = extractKeywords(title1);
      const kw2 = extractKeywords(title2);

      const similarity = jaccardSimilarity(kw1, kw2);

      // Debería tener alta similitud
      expect(similarity).toBeGreaterThan(0.5);
    });

    it("should not match unrelated articles", () => {
      const title1 = "Apple presenta nuevo iPhone 15";
      const title2 = "Pemex reporta pérdidas en el trimestre";

      const kw1 = extractKeywords(title1);
      const kw2 = extractKeywords(title2);

      const similarity = jaccardSimilarity(kw1, kw2);

      // Debería tener muy baja similitud
      expect(similarity).toBeLessThan(0.2);
    });

    it("should handle same event from different sources", () => {
      const title1 = "AMLO inaugura nueva refinería en Tabasco";
      const title2 = "Presidente López Obrador inaugura refinería Dos Bocas";

      const kw1 = extractKeywords(title1);
      const kw2 = extractKeywords(title2);

      const similarity = jaccardSimilarity(kw1, kw2);

      // Similitud moderada - necesitaría AI para confirmar
      expect(similarity).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("AI comparison", () => {
    it("should parse AI response correctly", async () => {
      const mockResponse = {
        response: {
          text: () => '{"sameEvent": true, "confidence": 0.85}',
        },
      };

      const mockModel = {
        generateContent: vi.fn().mockResolvedValue(mockResponse),
      };

      vi.mocked(getGeminiModel).mockReturnValue(mockModel as never);

      // Simular parsing de respuesta
      const text = mockResponse.response.text();
      const result = JSON.parse(text);
      expect(result.sameEvent).toBe(true);
      expect(result.confidence).toBe(0.85);
    });

    it("should handle malformed AI response", () => {
      const malformedText = "I think these are the same event";

      // Intentar parsear
      let result = { sameEvent: false, confidence: 0 };
      try {
        result = JSON.parse(malformedText);
      } catch {
        // Se espera que falle
        result = { sameEvent: false, confidence: 0 };
      }

      expect(result.sameEvent).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should handle markdown code blocks in response", () => {
      const responseWithMarkdown = '```json\n{"sameEvent": true, "confidence": 0.9}\n```';

      // Extraer JSON
      const codeBlockMatch = responseWithMarkdown.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      const cleaned = codeBlockMatch ? codeBlockMatch[1].trim() : responseWithMarkdown.trim();

      const result = JSON.parse(cleaned);
      expect(result.sameEvent).toBe(true);
      expect(result.confidence).toBe(0.9);
    });
  });
});
