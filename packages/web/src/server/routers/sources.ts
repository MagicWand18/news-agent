import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";
import { TRPCError } from "@trpc/server";
import { SourceType, RequestStatus } from "@prisma/client";

/**
 * Verifica si el usuario es administrador.
 */
function requireAdmin(role: string) {
  if (role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo administradores pueden realizar esta acción",
    });
  }
}

export const sourcesRouter = router({
  /**
   * Lista fuentes RSS con filtros y paginación.
   */
  list: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(SourceType).optional(),
        state: z.string().optional(),
        tier: z.number().optional(),
        active: z.boolean().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const { type, state, tier, active, search, page, limit } = input;
      const skip = (page - 1) * limit;

      const where = {
        ...(type && { type }),
        ...(state && { state }),
        ...(tier && { tier }),
        ...(active !== undefined && { active }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { url: { contains: search, mode: "insensitive" as const } },
            { state: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [sources, total] = await Promise.all([
        prisma.rssSource.findMany({
          where,
          orderBy: [{ tier: "asc" }, { state: "asc" }, { name: "asc" }],
          skip,
          take: limit,
        }),
        prisma.rssSource.count({ where }),
      ]);

      return {
        sources,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Obtiene estadísticas de fuentes.
   */
  stats: protectedProcedure.query(async () => {
    const [total, active, byType, byTier, byState, failing, recentlyUpdated] =
      await Promise.all([
        prisma.rssSource.count(),
        prisma.rssSource.count({ where: { active: true } }),
        prisma.rssSource.groupBy({
          by: ["type"],
          _count: { id: true },
        }),
        prisma.rssSource.groupBy({
          by: ["tier"],
          _count: { id: true },
        }),
        prisma.rssSource.groupBy({
          by: ["state"],
          where: { state: { not: null } },
          _count: { id: true },
        }),
        prisma.rssSource.count({ where: { errorCount: { gte: 3 } } }),
        prisma.rssSource.count({
          where: {
            lastFetch: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

    return {
      total,
      active,
      inactive: total - active,
      failing,
      recentlyUpdated,
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count.id])),
      byTier: Object.fromEntries(byTier.map((t) => [t.tier, t._count.id])),
      byState: Object.fromEntries(
        byState.map((s) => [s.state || "Nacional", s._count.id])
      ),
    };
  }),

  /**
   * Obtiene una fuente por ID.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const source = await prisma.rssSource.findUnique({
        where: { id: input.id },
      });

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fuente no encontrada",
        });
      }

      return source;
    }),

  /**
   * Crea una nueva fuente (solo admin).
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        tier: z.number().min(1).max(3).default(3),
        type: z.nativeEnum(SourceType).default("NATIONAL"),
        state: z.string().optional(),
        city: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

      // Verificar que no exista
      const existing = await prisma.rssSource.findUnique({
        where: { url: input.url },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya existe una fuente con esta URL",
        });
      }

      return prisma.rssSource.create({
        data: {
          name: input.name,
          url: input.url,
          tier: input.tier,
          type: input.type,
          state: input.state,
          city: input.city,
          active: true,
        },
      });
    }),

  /**
   * Actualiza una fuente (solo admin).
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        url: z.string().url().optional(),
        tier: z.number().min(1).max(3).optional(),
        type: z.nativeEnum(SourceType).optional(),
        state: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

      const { id, ...data } = input;

      // Verificar URL única si se está actualizando
      if (data.url) {
        const existing = await prisma.rssSource.findFirst({
          where: { url: data.url, id: { not: id } },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ya existe otra fuente con esta URL",
          });
        }
      }

      return prisma.rssSource.update({
        where: { id },
        data,
      });
    }),

  /**
   * Elimina una fuente (solo admin).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

      return prisma.rssSource.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Activa/desactiva una fuente (solo admin).
   */
  toggleActive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

      const source = await prisma.rssSource.findUnique({
        where: { id: input.id },
      });

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fuente no encontrada",
        });
      }

      return prisma.rssSource.update({
        where: { id: input.id },
        data: { active: !source.active, errorCount: 0 },
      });
    }),

  /**
   * Resetea el contador de errores (solo admin).
   */
  resetErrors: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

      return prisma.rssSource.update({
        where: { id: input.id },
        data: { errorCount: 0, active: true },
      });
    }),

  /**
   * Lista de estados disponibles.
   */
  states: protectedProcedure.query(async () => {
    const states = await prisma.rssSource.findMany({
      where: { state: { not: null } },
      select: { state: true },
      distinct: ["state"],
      orderBy: { state: "asc" },
    });

    return states.map((s) => s.state).filter(Boolean) as string[];
  }),

  // ============ SOLICITUDES DE FUENTES ============

  /**
   * Solicita la inclusión de una nueva fuente.
   */
  requestSource: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        state: z.string().optional(),
        city: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verificar que no exista ya como fuente
      const existingSource = await prisma.rssSource.findUnique({
        where: { url: input.url },
      });

      if (existingSource) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta URL ya está registrada como fuente",
        });
      }

      // Verificar que no haya solicitud pendiente
      const existingRequest = await prisma.sourceRequest.findFirst({
        where: {
          url: input.url,
          status: { in: ["PENDING", "APPROVED"] },
        },
      });

      if (existingRequest) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya existe una solicitud pendiente para esta URL",
        });
      }

      return prisma.sourceRequest.create({
        data: {
          name: input.name,
          url: input.url,
          state: input.state,
          city: input.city,
          notes: input.notes,
          requestedBy: ctx.user.id,
        },
      });
    }),

  /**
   * Lista solicitudes de fuentes (admin: todas, usuario: propias).
   */
  listRequests: protectedProcedure
    .input(
      z.object({
        status: z.nativeEnum(RequestStatus).optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { status, page, limit } = input;
      const skip = (page - 1) * limit;
      const isAdmin = ctx.user.role === "ADMIN";

      const where = {
        ...(status && { status }),
        ...(!isAdmin && { requestedBy: ctx.user.id }),
      };

      const [requests, total] = await Promise.all([
        prisma.sourceRequest.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.sourceRequest.count({ where }),
      ]);

      return {
        requests,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Estadísticas de solicitudes (solo admin).
   */
  requestStats: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.user.role);

    const stats = await prisma.sourceRequest.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    return Object.fromEntries(
      stats.map((s) => [s.status, s._count.id])
    ) as Record<RequestStatus, number>;
  }),

  /**
   * Aprueba una solicitud (solo admin).
   */
  approveRequest: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

      return prisma.sourceRequest.update({
        where: { id: input.id },
        data: {
          status: "APPROVED",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        },
      });
    }),

  /**
   * Rechaza una solicitud (solo admin).
   */
  rejectRequest: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

      return prisma.sourceRequest.update({
        where: { id: input.id },
        data: {
          status: "REJECTED",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          notes: input.notes,
        },
      });
    }),

  /**
   * Integra una solicitud aprobada (crea la fuente y marca como integrada).
   */
  integrateRequest: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tier: z.number().min(1).max(3).default(3),
        type: z.nativeEnum(SourceType).default("MUNICIPAL"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

      const request = await prisma.sourceRequest.findUnique({
        where: { id: input.id },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Solicitud no encontrada",
        });
      }

      if (request.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo se pueden integrar solicitudes aprobadas",
        });
      }

      // Crear la fuente
      const source = await prisma.rssSource.create({
        data: {
          name: request.name,
          url: request.url,
          state: request.state,
          city: request.city,
          tier: input.tier,
          type: input.type,
          active: true,
        },
      });

      // Marcar solicitud como integrada
      await prisma.sourceRequest.update({
        where: { id: input.id },
        data: { status: "INTEGRATED" },
      });

      return source;
    }),
});
