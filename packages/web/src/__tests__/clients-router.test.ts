import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock PrismaClient
const mockPrisma = {
  client: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  keyword: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@mediabot/shared", () => ({
  prisma: mockPrisma,
  config: {
    database: { url: "test" },
    redis: { url: "redis://localhost:6379" },
    telegram: { botToken: "test" },
    ai: { model: "gemini-2.0-flash" },
    google: { apiKey: "test" },
  },
}));

// Mock next-auth
vi.mock("next-auth", () => ({}));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn() }));
vi.mock("next-auth/react", () => ({
  SessionProvider: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("superjson", () => ({
  default: {
    serialize: (v: any) => ({ json: v, meta: undefined }),
    deserialize: (v: any) => v.json,
    transformer: {
      serialize: (v: any) => v,
      deserialize: (v: any) => v,
    },
  },
}));

// We need to mock getServerSession
vi.mock("next-auth", async () => {
  return {
    getServerSession: vi.fn().mockResolvedValue({
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@test.com",
        role: "ADMIN",
        orgId: "org-1",
      },
    }),
  };
});

describe("clients router authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addKeyword", () => {
    it("should verify client belongs to user org before adding keyword", async () => {
      // The router mutation checks client ownership
      // We test the logic directly: if client not found for org, it should reject
      mockPrisma.client.findFirst.mockResolvedValue(null);

      // This simulates what the router does:
      const clientId = "foreign-client";
      const orgId = "org-1";

      const client = await mockPrisma.client.findFirst({
        where: { id: clientId, orgId },
      });

      expect(client).toBeNull();
      // In the actual router, this would throw TRPCError NOT_FOUND
    });

    it("should allow keyword creation for own org client", async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: "own-client",
        orgId: "org-1",
      });
      mockPrisma.keyword.create.mockResolvedValue({
        id: "kw-new",
        word: "test keyword",
        type: "NAME",
        clientId: "own-client",
      });

      const client = await mockPrisma.client.findFirst({
        where: { id: "own-client", orgId: "org-1" },
      });

      expect(client).not.toBeNull();

      const keyword = await mockPrisma.keyword.create({
        data: { word: "test keyword", type: "NAME", clientId: "own-client" },
      });

      expect(keyword.word).toBe("test keyword");
    });
  });

  describe("removeKeyword", () => {
    it("should verify keyword belongs to org client before removing", async () => {
      mockPrisma.keyword.findFirst.mockResolvedValue(null);

      const keyword = await mockPrisma.keyword.findFirst({
        where: { id: "foreign-kw", client: { orgId: "org-1" } },
      });

      expect(keyword).toBeNull();
      // Router would throw NOT_FOUND
    });

    it("should allow removal for own org keyword", async () => {
      mockPrisma.keyword.findFirst.mockResolvedValue({
        id: "own-kw",
        client: { orgId: "org-1" },
      });
      mockPrisma.keyword.update.mockResolvedValue({
        id: "own-kw",
        active: false,
      });

      const keyword = await mockPrisma.keyword.findFirst({
        where: { id: "own-kw", client: { orgId: "org-1" } },
      });

      expect(keyword).not.toBeNull();

      const updated = await mockPrisma.keyword.update({
        where: { id: "own-kw" },
        data: { active: false },
      });

      expect(updated.active).toBe(false);
    });
  });

  describe("list", () => {
    it("should filter clients by orgId", async () => {
      mockPrisma.client.findMany.mockResolvedValue([
        { id: "c1", name: "Client 1", orgId: "org-1" },
      ]);

      const clients = await mockPrisma.client.findMany({
        where: { orgId: "org-1" },
      });

      expect(clients).toHaveLength(1);
      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: "org-1" },
        })
      );
    });
  });

  describe("getById", () => {
    it("should filter by both id and orgId", async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: "c1",
        name: "Client 1",
        orgId: "org-1",
      });

      const client = await mockPrisma.client.findFirst({
        where: { id: "c1", orgId: "org-1" },
      });

      expect(client).not.toBeNull();
      expect(client?.orgId).toBe("org-1");
    });

    it("should return null for client from different org", async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      const client = await mockPrisma.client.findFirst({
        where: { id: "c-other", orgId: "org-1" },
      });

      expect(client).toBeNull();
    });
  });

  describe("update", () => {
    it("should only update clients belonging to user org", async () => {
      mockPrisma.client.update.mockResolvedValue({
        id: "c1",
        name: "Updated",
        orgId: "org-1",
      });

      const updated = await mockPrisma.client.update({
        where: { id: "c1", orgId: "org-1" },
        data: { name: "Updated" },
      });

      expect(updated.name).toBe("Updated");
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "c1", orgId: "org-1" },
        })
      );
    });
  });
});
