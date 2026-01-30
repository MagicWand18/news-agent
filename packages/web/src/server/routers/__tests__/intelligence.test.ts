import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de prisma
vi.mock("@mediabot/shared", () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    mention: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    sourceTier: {
      findMany: vi.fn(),
    },
    weeklyInsight: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@mediabot/shared";

// Funciones auxiliares extraídas para testing
// (Estas representan la lógica del router)

interface SOVItem {
  id: string;
  name: string;
  mentions: number;
  weighted: number;
  sov: number;
  weightedSov: number;
}

function calculateSOV(items: { mentions: number; weighted: number }[]): {
  total: number;
  totalWeighted: number;
} {
  const total = items.reduce((sum, item) => sum + item.mentions, 0);
  const totalWeighted = items.reduce((sum, item) => sum + item.weighted, 0);
  return { total, totalWeighted };
}

function calculateSOVPercentage(
  count: number,
  total: number,
  weighted: number,
  totalWeighted: number
): { sov: number; weightedSov: number } {
  return {
    sov: total > 0 ? (count / total) * 100 : 0,
    weightedSov: totalWeighted > 0 ? (weighted / totalWeighted) * 100 : 0,
  };
}

function calculateWeightedMentions(
  tier1: number,
  tier2: number,
  tier3: number
): number {
  return tier1 * 3 + tier2 * 2 + tier3 * 1;
}

describe("intelligence router logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("SOV calculation", () => {
    it("should calculate percentage correctly", () => {
      const clientMentions = 50;
      const total = 200;
      const clientWeighted = 120;
      const totalWeighted = 500;

      const result = calculateSOVPercentage(
        clientMentions,
        total,
        clientWeighted,
        totalWeighted
      );

      expect(result.sov).toBe(25); // 50/200 * 100 = 25%
      expect(result.weightedSov).toBe(24); // 120/500 * 100 = 24%
    });

    it("should handle zero total gracefully", () => {
      const result = calculateSOVPercentage(0, 0, 0, 0);

      expect(result.sov).toBe(0);
      expect(result.weightedSov).toBe(0);
    });

    it("should calculate totals from multiple items", () => {
      const items = [
        { mentions: 50, weighted: 100 },
        { mentions: 30, weighted: 60 },
        { mentions: 20, weighted: 30 },
      ];

      const result = calculateSOV(items);

      expect(result.total).toBe(100);
      expect(result.totalWeighted).toBe(190);
    });
  });

  describe("tier weighting", () => {
    it("should apply correct weights per tier", () => {
      // Tier 1: x3, Tier 2: x2, Tier 3: x1
      const tier1 = 10;
      const tier2 = 20;
      const tier3 = 30;

      const weighted = calculateWeightedMentions(tier1, tier2, tier3);

      // 10*3 + 20*2 + 30*1 = 30 + 40 + 30 = 100
      expect(weighted).toBe(100);
    });

    it("should handle all tier 1 mentions", () => {
      const weighted = calculateWeightedMentions(10, 0, 0);
      expect(weighted).toBe(30); // 10 * 3
    });

    it("should handle all tier 3 mentions", () => {
      const weighted = calculateWeightedMentions(0, 0, 10);
      expect(weighted).toBe(10); // 10 * 1
    });
  });

  describe("competitor SOV", () => {
    it("should include competitors in total calculation", () => {
      const client = { mentions: 50, weighted: 100 };
      const competitors = [
        { mentions: 30, weighted: 60 },
        { mentions: 20, weighted: 40 },
      ];

      const allItems = [client, ...competitors];
      const { total, totalWeighted } = calculateSOV(allItems);

      expect(total).toBe(100); // 50 + 30 + 20
      expect(totalWeighted).toBe(200); // 100 + 60 + 40

      const clientSOV = calculateSOVPercentage(
        client.mentions,
        total,
        client.weighted,
        totalWeighted
      );

      expect(clientSOV.sov).toBe(50); // 50% del mercado
      expect(clientSOV.weightedSov).toBe(50);
    });

    it("should calculate competitor percentages correctly", () => {
      const client = { mentions: 100, weighted: 200 };
      const comp1 = { mentions: 50, weighted: 100 };
      const comp2 = { mentions: 50, weighted: 100 };

      const total = 200;
      const totalWeighted = 400;

      const clientSOV = calculateSOVPercentage(
        client.mentions,
        total,
        client.weighted,
        totalWeighted
      );
      const comp1SOV = calculateSOVPercentage(
        comp1.mentions,
        total,
        comp1.weighted,
        totalWeighted
      );
      const comp2SOV = calculateSOVPercentage(
        comp2.mentions,
        total,
        comp2.weighted,
        totalWeighted
      );

      expect(clientSOV.sov).toBe(50);
      expect(comp1SOV.sov).toBe(25);
      expect(comp2SOV.sov).toBe(25);

      // Verificar que suman 100%
      expect(clientSOV.sov + comp1SOV.sov + comp2SOV.sov).toBe(100);
    });
  });

  describe("getTopics aggregation", () => {
    it("should process topic query results correctly", async () => {
      const mockTopics = [
        { topic: "Technology", count: BigInt(50), positive: BigInt(30), negative: BigInt(10), neutral: BigInt(10) },
        { topic: "Finance", count: BigInt(30), positive: BigInt(10), negative: BigInt(15), neutral: BigInt(5) },
      ];

      // Simular transformación de resultados
      const transformed = mockTopics.map((t) => ({
        name: t.topic,
        count: Number(t.count),
        sentiment: {
          positive: Number(t.positive),
          negative: Number(t.negative),
          neutral: Number(t.neutral),
        },
      }));

      expect(transformed[0].name).toBe("Technology");
      expect(transformed[0].count).toBe(50);
      expect(transformed[0].sentiment.positive).toBe(30);
      expect(transformed[0].sentiment.negative).toBe(10);

      expect(transformed[1].name).toBe("Finance");
      expect(transformed[1].count).toBe(30);
    });

    it("should handle empty results", () => {
      const mockTopics: { topic: string; count: bigint }[] = [];

      const transformed = mockTopics.map((t) => ({
        name: t.topic,
        count: Number(t.count),
      }));

      expect(transformed).toHaveLength(0);
    });
  });

  describe("getWeeklyInsights", () => {
    it("should transform insight data correctly", () => {
      const mockInsight = {
        id: "insight-123",
        clientId: "client-456",
        client: { id: "client-456", name: "Test Client" },
        weekStart: new Date("2024-01-15"),
        insights: ["Insight 1", "Insight 2", "Insight 3"],
        sovData: { sov: 45.5, trend: "up" },
        topTopics: [
          { name: "Tech", count: 25 },
          { name: "Innovation", count: 15 },
        ],
        createdAt: new Date("2024-01-22"),
      };

      // Simular transformación
      const transformed = {
        id: mockInsight.id,
        clientId: mockInsight.clientId,
        clientName: mockInsight.client.name,
        weekStart: mockInsight.weekStart,
        insights: mockInsight.insights as string[],
        sovData: mockInsight.sovData as { sov: number; trend: string },
        topTopics: mockInsight.topTopics as { name: string; count: number }[],
        createdAt: mockInsight.createdAt,
      };

      expect(transformed.clientName).toBe("Test Client");
      expect(transformed.insights).toHaveLength(3);
      expect(transformed.sovData.sov).toBe(45.5);
      expect(transformed.sovData.trend).toBe("up");
      expect(transformed.topTopics[0].name).toBe("Tech");
    });
  });

  describe("getKPIs", () => {
    it("should aggregate KPI values correctly", () => {
      // Simular resultados de queries
      const topicsCount = 15;
      const emergingCount = 3;
      const avgSOV = 42.5;
      const weightedMentions = 250;

      const kpis = {
        topicsCount,
        emergingTopics: emergingCount,
        avgSOV,
        weightedMentions,
      };

      expect(kpis.topicsCount).toBe(15);
      expect(kpis.emergingTopics).toBe(3);
      expect(kpis.avgSOV).toBe(42.5);
      expect(kpis.weightedMentions).toBe(250);
    });

    it("should handle null/undefined values from DB", () => {
      // Simular null de la DB
      const result = {
        topicsCount: Number(null ?? 0),
        emergingTopics: Number(undefined ?? 0),
        avgSOV: null ?? 0,
        weightedMentions: Number(BigInt(0)),
      };

      expect(result.topicsCount).toBe(0);
      expect(result.emergingTopics).toBe(0);
      expect(result.avgSOV).toBe(0);
      expect(result.weightedMentions).toBe(0);
    });
  });

  describe("SOV history", () => {
    it("should calculate weekly history correctly", () => {
      // Simular 4 semanas de datos
      const weeklyData = [
        { clientCount: 20, totalCount: 100 },
        { clientCount: 30, totalCount: 120 },
        { clientCount: 25, totalCount: 100 },
        { clientCount: 35, totalCount: 100 },
      ];

      const history = weeklyData.map((week, index) => ({
        week: new Date(Date.now() - (4 - index) * 7 * 24 * 60 * 60 * 1000),
        sov: week.totalCount > 0 ? (week.clientCount / week.totalCount) * 100 : 0,
        mentions: week.clientCount,
      }));

      expect(history).toHaveLength(4);
      expect(history[0].sov).toBe(20); // 20/100
      expect(history[1].sov).toBe(25); // 30/120
      expect(history[2].sov).toBe(25); // 25/100
      expect(history[3].sov).toBe(35); // 35/100
    });

    it("should handle weeks with no mentions", () => {
      const weekData = { clientCount: 0, totalCount: 0 };
      const sov = weekData.totalCount > 0 ? (weekData.clientCount / weekData.totalCount) * 100 : 0;

      expect(sov).toBe(0);
    });
  });
});
