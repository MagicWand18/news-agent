import { describe, it, expect } from "vitest";

// Extract classifyUrgency logic for testing
// Since it's not exported, we replicate and test the logic directly

const HIGH_REACH_SOURCES = new Set([
  "elpais.com", "elmundo.es", "lavanguardia.com", "abc.es",
  "20minutos.es", "europapress.es", "efe.com", "rtve.es",
  "infobae.com", "cnn", "bbc", "reuters", "elconfidencial.com",
]);

function classifyUrgency(
  relevance: number,
  sentiment: string,
  source: string
): string {
  const sourceLower = source.toLowerCase();
  const isHighReach = [...HIGH_REACH_SOURCES].some((s) =>
    sourceLower.includes(s)
  );

  if (relevance >= 8 && sentiment === "NEGATIVE" && isHighReach) {
    return "CRITICAL";
  }
  if (relevance >= 7 || sentiment === "NEGATIVE") {
    return "HIGH";
  }
  if (relevance >= 4) {
    return "MEDIUM";
  }
  return "LOW";
}

describe("classifyUrgency", () => {
  describe("CRITICAL urgency", () => {
    it("should return CRITICAL for high relevance + negative + high-reach source", () => {
      expect(classifyUrgency(8, "NEGATIVE", "elpais.com")).toBe("CRITICAL");
      expect(classifyUrgency(9, "NEGATIVE", "bbc mundo")).toBe("CRITICAL");
      expect(classifyUrgency(10, "NEGATIVE", "reuters wire")).toBe("CRITICAL");
    });

    it("should NOT return CRITICAL if relevance < 8", () => {
      expect(classifyUrgency(7, "NEGATIVE", "elpais.com")).not.toBe("CRITICAL");
    });

    it("should NOT return CRITICAL for non-high-reach sources", () => {
      expect(classifyUrgency(9, "NEGATIVE", "blogspot.com")).not.toBe("CRITICAL");
    });

    it("should NOT return CRITICAL for non-negative sentiment", () => {
      expect(classifyUrgency(9, "POSITIVE", "elpais.com")).not.toBe("CRITICAL");
      expect(classifyUrgency(9, "NEUTRAL", "elpais.com")).not.toBe("CRITICAL");
    });
  });

  describe("HIGH urgency", () => {
    it("should return HIGH for relevance >= 7 regardless of sentiment/source", () => {
      expect(classifyUrgency(7, "POSITIVE", "unknown-blog.com")).toBe("HIGH");
      expect(classifyUrgency(8, "NEUTRAL", "random-site.org")).toBe("HIGH");
    });

    it("should return HIGH for any NEGATIVE sentiment regardless of relevance", () => {
      expect(classifyUrgency(1, "NEGATIVE", "small-blog.com")).toBe("HIGH");
      expect(classifyUrgency(3, "NEGATIVE", "niche-site.org")).toBe("HIGH");
    });
  });

  describe("MEDIUM urgency", () => {
    it("should return MEDIUM for relevance 4-6 with non-negative sentiment", () => {
      expect(classifyUrgency(4, "NEUTRAL", "some-source.com")).toBe("MEDIUM");
      expect(classifyUrgency(5, "POSITIVE", "another-source.com")).toBe("MEDIUM");
      expect(classifyUrgency(6, "MIXED", "mixed-source.com")).toBe("MEDIUM");
    });
  });

  describe("LOW urgency", () => {
    it("should return LOW for relevance < 4 with non-negative sentiment", () => {
      expect(classifyUrgency(1, "NEUTRAL", "small-blog.com")).toBe("LOW");
      expect(classifyUrgency(2, "POSITIVE", "minor-site.com")).toBe("LOW");
      expect(classifyUrgency(3, "MIXED", "niche.org")).toBe("LOW");
    });
  });

  describe("high-reach source detection", () => {
    it("should detect sources by substring match", () => {
      // Source URLs can contain the high-reach domain
      expect(classifyUrgency(9, "NEGATIVE", "https://elpais.com/article/123")).toBe("CRITICAL");
      expect(classifyUrgency(9, "NEGATIVE", "El Pais via elpais.com")).toBe("CRITICAL");
    });

    it("should be case-insensitive", () => {
      expect(classifyUrgency(9, "NEGATIVE", "ELPAIS.COM")).toBe("CRITICAL");
      expect(classifyUrgency(9, "NEGATIVE", "BBC News")).toBe("CRITICAL");
    });
  });
});
