import { z } from "zod";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";

export const briefsRouter = router({
  /**
   * Lista briefs por cliente con paginación cursor.
   */
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        orgId: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);
      const { limit, cursor, clientId } = input;

      const briefs = await prisma.dailyBrief.findMany({
        where: {
          ...(orgId && { client: { orgId } }),
          ...(clientId && { clientId }),
        },
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (briefs.length > limit) {
        const next = briefs.pop();
        nextCursor = next?.id;
      }

      return {
        briefs,
        nextCursor,
      };
    }),

  /**
   * Obtiene un brief por ID.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin
        ? {}
        : { client: { orgId: ctx.user.orgId! } };

      const brief = await prisma.dailyBrief.findFirst({
        where: { id: input.id, ...orgFilter },
        include: {
          client: { select: { id: true, name: true } },
        },
      });

      if (!brief) {
        throw new Error("Brief no encontrado");
      }

      return brief;
    }),

  /**
   * Obtiene el último brief de un cliente.
   */
  getLatest: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin
        ? {}
        : { client: { orgId: ctx.user.orgId! } };

      const brief = await prisma.dailyBrief.findFirst({
        where: {
          clientId: input.clientId,
          ...orgFilter,
        },
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
      });

      return brief;
    }),
});
