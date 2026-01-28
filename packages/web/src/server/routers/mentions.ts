import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";

export const mentionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, clientId, sentiment, dateFrom, dateTo } = input;

      const mentions = await prisma.mention.findMany({
        where: {
          client: { orgId: ctx.user.orgId },
          ...(clientId && { clientId }),
          ...(sentiment && { sentiment }),
          ...(dateFrom || dateTo
            ? {
                createdAt: {
                  ...(dateFrom && { gte: dateFrom }),
                  ...(dateTo && { lte: dateTo }),
                },
              }
            : {}),
        },
        include: {
          article: { select: { title: true, source: true, url: true, publishedAt: true } },
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (mentions.length > limit) {
        const next = mentions.pop();
        nextCursor = next!.id;
      }

      return { mentions, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.mention.findFirst({
        where: {
          id: input.id,
          client: { orgId: ctx.user.orgId },
        },
        include: {
          article: true,
          client: true,
          tasks: true,
        },
      });
    }),
});
