import { z } from "zod";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";

export const topicsRouter = router({
  /**
   * Lista de topic threads con paginación cursor y filtros.
   */
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        status: z.enum(["ACTIVE", "CLOSED", "ARCHIVED"]).optional().default("ACTIVE"),
        sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user);
      const orgFilter = orgId ? { client: { orgId } } : {};

      const threads = await prisma.topicThread.findMany({
        where: {
          ...orgFilter,
          ...(input.clientId ? { clientId: input.clientId } : {}),
          status: input.status,
          ...(input.sentiment ? { dominantSentiment: input.sentiment } : {}),
        },
        include: {
          client: { select: { name: true, id: true } },
        },
        orderBy: { lastMentionAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (threads.length > input.limit) {
        const nextItem = threads.pop();
        nextCursor = nextItem?.id;
      }

      return { threads, nextCursor };
    }),

  /**
   * Detalle de un topic thread con stats.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user);

      const thread = await prisma.topicThread.findUnique({
        where: { id: input.id },
        include: {
          client: { select: { name: true, id: true, orgId: true } },
        },
      });

      if (!thread) return null;

      // Verificar acceso por org
      if (orgId && thread.client.orgId !== orgId) return null;

      return thread;
    }),

  /**
   * Menciones de un topic thread (paginación infinita).
   * Combina Mention y SocialMention.
   */
  getMentions: protectedProcedure
    .input(
      z.object({
        topicThreadId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      const [mentions, socialMentions] = await Promise.all([
        prisma.mention.findMany({
          where: { topicThreadId: input.topicThreadId },
          include: {
            article: { select: { title: true, source: true, url: true, publishedAt: true } },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        }),
        prisma.socialMention.findMany({
          where: { topicThreadId: input.topicThreadId },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        }),
      ]);

      // Combinar y ordenar por fecha
      const combined = [
        ...mentions.map((m) => ({
          id: m.id,
          type: "mention" as const,
          title: m.article.title,
          source: m.article.source,
          url: m.article.url,
          sentiment: m.sentiment,
          relevance: m.relevance,
          date: m.publishedAt || m.createdAt,
          content: m.aiSummary,
        })),
        ...socialMentions.map((sm) => ({
          id: sm.id,
          type: "social" as const,
          title: sm.content?.slice(0, 100) || "",
          source: `@${sm.authorHandle}`,
          url: sm.postUrl,
          sentiment: sm.sentiment,
          relevance: sm.relevance,
          date: sm.postedAt || sm.createdAt,
          content: sm.content,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        items: combined.slice(0, input.limit),
        nextCursor: mentions.length === input.limit ? mentions[mentions.length - 1]?.id : undefined,
      };
    }),

  /**
   * Timeline de eventos del thread.
   */
  getEvents: protectedProcedure
    .input(
      z.object({
        topicThreadId: z.string(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      return prisma.topicThreadEvent.findMany({
        where: { topicThreadId: input.topicThreadId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  /**
   * Stats agregados: temas activos, distribución sentimiento, tendencias.
   */
  getStats: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        days: z.number().default(7),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user);
      const orgFilter = orgId ? { client: { orgId } } : {};
      const clientFilter = input.clientId ? { clientId: input.clientId } : {};
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const [activeCount, negativeCount, newToday, bySentiment] = await Promise.all([
        prisma.topicThread.count({
          where: { ...orgFilter, ...clientFilter, status: "ACTIVE" },
        }),
        prisma.topicThread.count({
          where: { ...orgFilter, ...clientFilter, status: "ACTIVE", dominantSentiment: "NEGATIVE" },
        }),
        prisma.topicThread.count({
          where: { ...orgFilter, ...clientFilter, status: "ACTIVE", firstSeenAt: { gte: since } },
        }),
        prisma.topicThread.groupBy({
          by: ["dominantSentiment"],
          where: { ...orgFilter, ...clientFilter, status: "ACTIVE" },
          _count: true,
        }),
      ]);

      return {
        activeTopics: activeCount,
        negativeTopics: negativeCount,
        newTopics: newToday,
        bySentiment: bySentiment.map((s) => ({
          sentiment: s.dominantSentiment || "UNKNOWN",
          count: s._count,
        })),
      };
    }),

  /**
   * Archivar un topic thread manualmente.
   */
  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const thread = await prisma.topicThread.update({
        where: { id: input.id },
        data: {
          status: "ARCHIVED",
          closedAt: new Date(),
        },
      });

      await prisma.topicThreadEvent.create({
        data: {
          topicThreadId: input.id,
          type: "CLOSED",
          data: { reason: "manual_archive" },
        },
      });

      return thread;
    }),

  /**
   * Conteo de temas negativos activos (para badge en sidebar).
   */
  getNegativeCount: protectedProcedure.query(async ({ ctx }) => {
    const orgId = getEffectiveOrgId(ctx.user);
    const orgFilter = orgId ? { client: { orgId } } : {};

    const count = await prisma.topicThread.count({
      where: {
        ...orgFilter,
        status: "ACTIVE",
        dominantSentiment: "NEGATIVE",
      },
    });

    return { count };
  }),
});
