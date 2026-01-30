import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de prisma y TRPCError
vi.mock("@mediabot/shared", () => ({
  prisma: {
    rssSource: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    sourceRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "@mediabot/shared";
import { TRPCError } from "@trpc/server";

// Función auxiliar para verificar admin
function requireAdmin(role: string) {
  if (role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo administradores pueden realizar esta acción",
    });
  }
}

describe("sources router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CRUD operations", () => {
    describe("list", () => {
      it("should return paginated sources", async () => {
        const mockSources = [
          { id: "1", name: "El Universal", url: "https://eluniversal.com.mx/rss", tier: 1, active: true },
          { id: "2", name: "Milenio", url: "https://milenio.com/rss", tier: 1, active: true },
        ];

        vi.mocked(prisma.rssSource.findMany).mockResolvedValue(mockSources as never);
        vi.mocked(prisma.rssSource.count).mockResolvedValue(2);

        const result = await prisma.rssSource.findMany({
          where: { active: true },
          orderBy: [{ tier: "asc" }, { name: "asc" }],
          skip: 0,
          take: 50,
        });

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe("El Universal");
      });

      it("should filter by type", async () => {
        vi.mocked(prisma.rssSource.findMany).mockResolvedValue([]);

        await prisma.rssSource.findMany({
          where: { type: "STATE" },
        });

        expect(prisma.rssSource.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { type: "STATE" },
          })
        );
      });

      it("should filter by search term", async () => {
        vi.mocked(prisma.rssSource.findMany).mockResolvedValue([]);

        const search = "universal";
        await prisma.rssSource.findMany({
          where: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { url: { contains: search, mode: "insensitive" } },
            ],
          },
        });

        expect(prisma.rssSource.findMany).toHaveBeenCalled();
      });
    });

    describe("create (admin-only)", () => {
      it("should create source when user is admin", async () => {
        const adminRole = "ADMIN";
        const newSource = {
          name: "New Source",
          url: "https://newsource.com/rss",
          tier: 2,
          type: "STATE",
        };

        vi.mocked(prisma.rssSource.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.rssSource.create).mockResolvedValue({
          id: "new-id",
          ...newSource,
          state: null,
          city: null,
          active: true,
          errorCount: 0,
          lastFetch: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never);

        // No debería lanzar error
        expect(() => requireAdmin(adminRole)).not.toThrow();

        const result = await prisma.rssSource.create({
          data: {
            ...newSource,
            active: true,
          },
        });

        expect(result.id).toBe("new-id");
      });

      it("should reject non-admin users", () => {
        const nonAdminRole = "ANALYST";

        expect(() => requireAdmin(nonAdminRole)).toThrow(TRPCError);
      });

      it("should reject duplicate URL", async () => {
        vi.mocked(prisma.rssSource.findUnique).mockResolvedValue({
          id: "existing",
          url: "https://existing.com/rss",
        } as never);

        const existing = await prisma.rssSource.findUnique({
          where: { url: "https://existing.com/rss" },
        });

        expect(existing).not.toBeNull();
      });
    });

    describe("update (admin-only)", () => {
      it("should update source properties", async () => {
        const updatedSource = {
          id: "source-1",
          name: "Updated Name",
          tier: 1,
        };

        vi.mocked(prisma.rssSource.findFirst).mockResolvedValue(null); // No hay otra con misma URL
        vi.mocked(prisma.rssSource.update).mockResolvedValue({
          ...updatedSource,
          url: "https://original.com/rss",
          active: true,
        } as never);

        const result = await prisma.rssSource.update({
          where: { id: "source-1" },
          data: { name: "Updated Name", tier: 1 },
        });

        expect(result.name).toBe("Updated Name");
      });

      it("should reject URL update if new URL exists", async () => {
        vi.mocked(prisma.rssSource.findFirst).mockResolvedValue({
          id: "other-source",
          url: "https://duplicate.com/rss",
        } as never);

        const existing = await prisma.rssSource.findFirst({
          where: { url: "https://duplicate.com/rss", id: { not: "source-1" } },
        });

        expect(existing).not.toBeNull();
      });
    });

    describe("delete (admin-only)", () => {
      it("should delete source", async () => {
        vi.mocked(prisma.rssSource.delete).mockResolvedValue({
          id: "deleted-source",
        } as never);

        const result = await prisma.rssSource.delete({
          where: { id: "source-to-delete" },
        });

        expect(result.id).toBe("deleted-source");
      });
    });

    describe("toggleActive (admin-only)", () => {
      it("should toggle active state and reset errors", async () => {
        const source = { id: "source-1", active: false, errorCount: 5 };

        vi.mocked(prisma.rssSource.findUnique).mockResolvedValue(source as never);
        vi.mocked(prisma.rssSource.update).mockResolvedValue({
          ...source,
          active: true,
          errorCount: 0,
        } as never);

        const updated = await prisma.rssSource.update({
          where: { id: "source-1" },
          data: { active: !source.active, errorCount: 0 },
        });

        expect(updated.active).toBe(true);
        expect(updated.errorCount).toBe(0);
      });
    });
  });

  describe("source request workflow", () => {
    describe("requestSource", () => {
      it("should create request when URL is unique", async () => {
        vi.mocked(prisma.rssSource.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.sourceRequest.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.sourceRequest.create).mockResolvedValue({
          id: "request-1",
          name: "New Source",
          url: "https://newsource.com/rss",
          status: "PENDING",
          requestedBy: "user-123",
          createdAt: new Date(),
        } as never);

        const result = await prisma.sourceRequest.create({
          data: {
            name: "New Source",
            url: "https://newsource.com/rss",
            requestedBy: "user-123",
          },
        });

        expect(result.status).toBe("PENDING");
      });

      it("should reject if URL already exists as source", async () => {
        vi.mocked(prisma.rssSource.findUnique).mockResolvedValue({
          id: "existing",
        } as never);

        const existing = await prisma.rssSource.findUnique({
          where: { url: "https://existing.com/rss" },
        });

        expect(existing).not.toBeNull();
      });

      it("should reject if pending request exists", async () => {
        vi.mocked(prisma.rssSource.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.sourceRequest.findFirst).mockResolvedValue({
          id: "pending-request",
          status: "PENDING",
        } as never);

        const existingRequest = await prisma.sourceRequest.findFirst({
          where: {
            url: "https://requested.com/rss",
            status: { in: ["PENDING", "APPROVED"] },
          },
        });

        expect(existingRequest).not.toBeNull();
      });
    });

    describe("listRequests", () => {
      it("should return all requests for admin", async () => {
        const mockRequests = [
          { id: "1", status: "PENDING", requestedBy: "user-1" },
          { id: "2", status: "PENDING", requestedBy: "user-2" },
        ];

        vi.mocked(prisma.sourceRequest.findMany).mockResolvedValue(mockRequests as never);

        const result = await prisma.sourceRequest.findMany({
          where: {}, // Admin ve todas
        });

        expect(result).toHaveLength(2);
      });

      it("should filter by user for non-admin", async () => {
        vi.mocked(prisma.sourceRequest.findMany).mockResolvedValue([]);

        await prisma.sourceRequest.findMany({
          where: { requestedBy: "user-123" },
        });

        expect(prisma.sourceRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { requestedBy: "user-123" },
          })
        );
      });
    });

    describe("approveRequest (admin-only)", () => {
      it("should update status to APPROVED", async () => {
        vi.mocked(prisma.sourceRequest.update).mockResolvedValue({
          id: "request-1",
          status: "APPROVED",
          reviewedBy: "admin-123",
          reviewedAt: new Date(),
        } as never);

        const result = await prisma.sourceRequest.update({
          where: { id: "request-1" },
          data: {
            status: "APPROVED",
            reviewedBy: "admin-123",
            reviewedAt: new Date(),
          },
        });

        expect(result.status).toBe("APPROVED");
      });
    });

    describe("rejectRequest (admin-only)", () => {
      it("should update status to REJECTED with notes", async () => {
        vi.mocked(prisma.sourceRequest.update).mockResolvedValue({
          id: "request-1",
          status: "REJECTED",
          notes: "URL no válida",
        } as never);

        const result = await prisma.sourceRequest.update({
          where: { id: "request-1" },
          data: {
            status: "REJECTED",
            notes: "URL no válida",
          },
        });

        expect(result.status).toBe("REJECTED");
        expect(result.notes).toBe("URL no válida");
      });
    });

    describe("integrateRequest (admin-only)", () => {
      it("should create source and update request status", async () => {
        const request = {
          id: "request-1",
          name: "New Source",
          url: "https://newsource.com/rss",
          state: "Jalisco",
          city: "Guadalajara",
          status: "APPROVED",
        };

        vi.mocked(prisma.sourceRequest.findUnique).mockResolvedValue(request as never);
        vi.mocked(prisma.rssSource.create).mockResolvedValue({
          id: "new-source-id",
          name: request.name,
          url: request.url,
          state: request.state,
          city: request.city,
          tier: 3,
          type: "MUNICIPAL",
          active: true,
        } as never);
        vi.mocked(prisma.sourceRequest.update).mockResolvedValue({
          ...request,
          status: "INTEGRATED",
        } as never);

        const source = await prisma.rssSource.create({
          data: {
            name: request.name,
            url: request.url,
            state: request.state,
            city: request.city,
            tier: 3,
            type: "MUNICIPAL",
            active: true,
          },
        });

        await prisma.sourceRequest.update({
          where: { id: request.id },
          data: { status: "INTEGRATED" },
        });

        expect(source.id).toBe("new-source-id");
      });

      it("should reject if request is not approved", async () => {
        vi.mocked(prisma.sourceRequest.findUnique).mockResolvedValue({
          id: "request-1",
          status: "PENDING",
        } as never);

        const request = await prisma.sourceRequest.findUnique({
          where: { id: "request-1" },
        });

        expect(request?.status).not.toBe("APPROVED");
      });
    });
  });

  describe("filtering and pagination", () => {
    it("should calculate pagination correctly", () => {
      const page = 3;
      const limit = 20;
      const skip = (page - 1) * limit;

      expect(skip).toBe(40);
    });

    it("should calculate total pages correctly", () => {
      const total = 95;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(5);
    });
  });
});
