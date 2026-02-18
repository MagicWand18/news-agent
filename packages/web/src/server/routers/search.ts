/**
 * Router de búsqueda global.
 * Busca en clientes, menciones (por AI summary) y menciones sociales (por contenido).
 */

import { z } from "zod";
import { router, protectedProcedure, buildOrgCondition, buildClientOrgCondition } from "../trpc";
import { prisma } from "@mediabot/shared";

export const searchRouter = router({
  /**
   * Búsqueda global en clientes, menciones y menciones sociales.
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgCondition = buildClientOrgCondition(ctx.user);
      const { query, limit } = input;

      // Buscar clientes por nombre
      const clients = await prisma.client.findMany({
        where: {
          ...buildOrgCondition(ctx.user),
          name: { contains: query, mode: "insensitive" },
        },
        take: limit,
        select: { id: true, name: true, industry: true },
      });

      // Buscar menciones por AI summary
      const mentions = await prisma.mention.findMany({
        where: {
          ...orgCondition,
          aiSummary: { contains: query, mode: "insensitive" },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          aiSummary: true,
          sentiment: true,
          article: { select: { title: true, source: true } },
          client: { select: { name: true } },
        },
      });

      // Buscar menciones sociales por contenido
      const socialMentions = await prisma.socialMention.findMany({
        where: {
          ...orgCondition,
          content: { contains: query, mode: "insensitive" },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          platform: true,
          authorHandle: true,
          client: { select: { name: true } },
        },
      });

      return { clients, mentions, socialMentions };
    }),
});
