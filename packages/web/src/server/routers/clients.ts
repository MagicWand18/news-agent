import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { prisma, getOnboardingQueue } from "@mediabot/shared";

export const clientsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.client.findMany({
      where: { orgId: ctx.user.orgId },
      include: {
        _count: {
          select: {
            keywords: { where: { active: true } },
            mentions: true,
            tasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.client.findFirst({
        where: { id: input.id, orgId: ctx.user.orgId },
        include: {
          keywords: { where: { active: true }, orderBy: { type: "asc" } },
          mentions: {
            include: { article: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          _count: { select: { mentions: true, tasks: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        industry: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = await prisma.client.create({
        data: {
          ...input,
          orgId: ctx.user.orgId,
        },
      });

      // Add client name as default keyword
      await prisma.keyword.create({
        data: {
          word: input.name,
          type: "NAME",
          clientId: client.id,
        },
      });

      // Trigger AI onboarding to generate additional keywords
      try {
        const onboardingQueue = getOnboardingQueue();
        await onboardingQueue.add(
          "onboard",
          { clientId: client.id },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
          }
        );
        console.log(`[Clients] Queued onboarding for client: ${client.name}`);
      } catch (err) {
        // Don't fail client creation if queue is unavailable
        console.error(`[Clients] Failed to queue onboarding:`, err);
      }

      return client;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        industry: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return prisma.client.update({
        where: { id, orgId: ctx.user.orgId },
        data,
      });
    }),

  addKeyword: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        word: z.string().min(1),
        type: z.enum(["NAME", "BRAND", "COMPETITOR", "TOPIC", "ALIAS"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify client belongs to user's org
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
      });
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }
      return prisma.keyword.create({
        data: input,
      });
    }),

  removeKeyword: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify keyword belongs to a client in user's org
      const keyword = await prisma.keyword.findFirst({
        where: { id: input.id, client: { orgId: ctx.user.orgId } },
      });
      if (!keyword) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keyword not found" });
      }
      return prisma.keyword.update({
        where: { id: input.id },
        data: { active: false },
      });
    }),

  compareCompetitors: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        include: { keywords: { where: { active: true } } },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      // Separate competitor keywords from client keywords
      const competitorKeywords = client.keywords.filter((k) => k.type === "COMPETITOR");
      const clientKeywords = client.keywords.filter((k) => k.type !== "COMPETITOR");

      // Get client's own mention count
      const clientMentions = await prisma.mention.count({
        where: {
          clientId: client.id,
          createdAt: { gte: since },
          keywordMatched: { in: clientKeywords.map((k) => k.word) },
        },
      });

      // Get client sentiment breakdown
      const clientSentiment = await prisma.mention.groupBy({
        by: ["sentiment"],
        where: {
          clientId: client.id,
          createdAt: { gte: since },
          keywordMatched: { in: clientKeywords.map((k) => k.word) },
        },
        _count: { id: true },
      });

      // Get stats for each competitor
      const competitorStats = await Promise.all(
        competitorKeywords.map(async (comp) => {
          const mentionCount = await prisma.mention.count({
            where: {
              clientId: client.id,
              createdAt: { gte: since },
              keywordMatched: comp.word,
            },
          });

          const sentimentBreakdown = await prisma.mention.groupBy({
            by: ["sentiment"],
            where: {
              clientId: client.id,
              keywordMatched: comp.word,
              createdAt: { gte: since },
            },
            _count: { id: true },
          });

          // Transform to object
          const sentiment = {
            positive: 0,
            negative: 0,
            neutral: 0,
            mixed: 0,
          };
          for (const s of sentimentBreakdown) {
            const key = s.sentiment.toLowerCase() as keyof typeof sentiment;
            if (key in sentiment) {
              sentiment[key] = s._count.id;
            }
          }

          return {
            name: comp.word,
            mentions: mentionCount,
            sentiment,
          };
        })
      );

      // Transform client sentiment
      const clientSentimentObj = {
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
      };
      for (const s of clientSentiment) {
        const key = s.sentiment.toLowerCase() as keyof typeof clientSentimentObj;
        if (key in clientSentimentObj) {
          clientSentimentObj[key] = s._count.id;
        }
      }

      return {
        client: {
          name: client.name,
          mentions: clientMentions,
          sentiment: clientSentimentObj,
        },
        competitors: competitorStats,
        period: { start: since, end: new Date() },
      };
    }),
});
