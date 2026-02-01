import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";
import { Prisma } from "@prisma/client";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.orgId;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      clientCount,
      mentions24h,
      mentions7d,
      tasksPending,
      mentionsByDay,
      sentimentBreakdown,
    ] = await Promise.all([
      prisma.client.count({ where: { orgId, active: true } }),
      prisma.mention.count({
        where: { client: { orgId }, createdAt: { gte: last24h } },
      }),
      prisma.mention.count({
        where: { client: { orgId }, createdAt: { gte: last7d } },
      }),
      prisma.task.count({
        where: {
          client: { orgId },
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM "Mention"
        WHERE "clientId" IN (SELECT id FROM "Client" WHERE "orgId" = ${orgId})
        AND "createdAt" >= ${last7d}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      prisma.mention.groupBy({
        by: ["sentiment"],
        where: { client: { orgId }, createdAt: { gte: last7d } },
        _count: true,
      }),
    ]);

    return {
      clientCount,
      mentions24h,
      mentions7d,
      tasksPending,
      mentionsByDay: mentionsByDay.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
      sentimentBreakdown: sentimentBreakdown.map((s) => ({
        sentiment: s.sentiment,
        count: s._count,
      })),
    };
  }),

  recentMentions: protectedProcedure.query(async ({ ctx }) => {
    return prisma.mention.findMany({
      where: { client: { orgId: ctx.user.orgId } },
      include: {
        article: { select: { title: true, source: true, url: true } },
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }),

  analytics: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      // Build client filter
      const clientFilter = input.clientId
        ? Prisma.sql`AND m."clientId" = ${input.clientId}`
        : Prisma.empty;

      const clientWhereClause = input.clientId
        ? { clientId: input.clientId, client: { orgId } }
        : { client: { orgId } };

      const [mentionsByDay, sentimentByWeek, topSources, topKeywords, urgencyBreakdown] =
        await Promise.all([
          // 1. Mentions by day
          prisma.$queryRaw<{ date: string; count: bigint }[]>`
            SELECT DATE(m."createdAt") as date, COUNT(*) as count
            FROM "Mention" m
            JOIN "Client" c ON m."clientId" = c.id
            WHERE c."orgId" = ${orgId}
            AND m."createdAt" >= ${since}
            ${clientFilter}
            GROUP BY DATE(m."createdAt")
            ORDER BY date ASC
          `,

          // 2. Sentiment trend by week
          prisma.$queryRaw<{ week: Date; sentiment: string; count: bigint }[]>`
            SELECT DATE_TRUNC('week', m."createdAt") as week, m.sentiment, COUNT(*) as count
            FROM "Mention" m
            JOIN "Client" c ON m."clientId" = c.id
            WHERE c."orgId" = ${orgId}
            AND m."createdAt" >= ${since}
            ${clientFilter}
            GROUP BY DATE_TRUNC('week', m."createdAt"), m.sentiment
            ORDER BY week ASC
          `,

          // 3. Top sources
          prisma.$queryRaw<{ source: string; count: bigint }[]>`
            SELECT a.source, COUNT(*) as count
            FROM "Mention" m
            JOIN "Article" a ON m."articleId" = a.id
            JOIN "Client" c ON m."clientId" = c.id
            WHERE c."orgId" = ${orgId}
            AND m."createdAt" >= ${since}
            ${clientFilter}
            GROUP BY a.source
            ORDER BY count DESC
            LIMIT 10
          `,

          // 4. Top keywords
          prisma.mention.groupBy({
            by: ["keywordMatched"],
            where: {
              ...clientWhereClause,
              createdAt: { gte: since },
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
          }),

          // 5. Urgency breakdown
          prisma.mention.groupBy({
            by: ["urgency"],
            where: {
              ...clientWhereClause,
              createdAt: { gte: since },
            },
            _count: { id: true },
          }),
        ]);

      // Transform sentiment data into weekly grouped format
      const sentimentTrendMap = new Map<string, { positive: number; negative: number; neutral: number; mixed: number }>();
      for (const row of sentimentByWeek) {
        const weekKey = new Date(row.week).toISOString().split("T")[0];
        if (!sentimentTrendMap.has(weekKey)) {
          sentimentTrendMap.set(weekKey, { positive: 0, negative: 0, neutral: 0, mixed: 0 });
        }
        const entry = sentimentTrendMap.get(weekKey)!;
        const sentiment = row.sentiment.toLowerCase() as keyof typeof entry;
        if (sentiment in entry) {
          entry[sentiment] = Number(row.count);
        }
      }

      return {
        mentionsByDay: mentionsByDay.map((d) => ({
          date: d.date,
          count: Number(d.count),
        })),
        sentimentTrend: Array.from(sentimentTrendMap.entries()).map(([week, data]) => ({
          week,
          ...data,
        })),
        topSources: topSources.map((s) => ({
          source: s.source,
          count: Number(s.count),
        })),
        topKeywords: topKeywords.map((k) => ({
          keyword: k.keywordMatched,
          count: k._count.id,
        })),
        urgencyBreakdown: urgencyBreakdown.map((u) => ({
          urgency: u.urgency,
          count: u._count.id,
        })),
      };
    }),

  /**
   * Estadísticas de redes sociales para el dashboard principal.
   */
  getSocialDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.orgId;
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total7d, byPlatform] = await Promise.all([
      prisma.socialMention.count({
        where: {
          client: { orgId },
          createdAt: { gte: last7d },
        },
      }),
      prisma.socialMention.groupBy({
        by: ["platform"],
        where: {
          client: { orgId },
          createdAt: { gte: last7d },
        },
        _count: { id: true },
      }),
    ]);

    return {
      total7d,
      byPlatform: {
        TWITTER: byPlatform.find((p) => p.platform === "TWITTER")?._count.id ?? 0,
        INSTAGRAM: byPlatform.find((p) => p.platform === "INSTAGRAM")?._count.id ?? 0,
        TIKTOK: byPlatform.find((p) => p.platform === "TIKTOK")?._count.id ?? 0,
      },
    };
  }),

  /**
   * Analytics de redes sociales para la página de analytics.
   */
  getSocialAnalytics: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const clientFilter = input.clientId
        ? Prisma.sql`AND sm."clientId" = ${input.clientId}`
        : Prisma.empty;

      const clientWhereClause = input.clientId
        ? { clientId: input.clientId, client: { orgId } }
        : { client: { orgId } };

      const [mentionsByDay, byPlatform, bySentiment, topAuthors] = await Promise.all([
        // Menciones por día
        prisma.$queryRaw<{ date: string; count: bigint }[]>`
          SELECT DATE(sm."createdAt") as date, COUNT(*) as count
          FROM "SocialMention" sm
          JOIN "Client" c ON sm."clientId" = c.id
          WHERE c."orgId" = ${orgId}
          AND sm."createdAt" >= ${since}
          ${clientFilter}
          GROUP BY DATE(sm."createdAt")
          ORDER BY date ASC
        `,
        // Por plataforma
        prisma.socialMention.groupBy({
          by: ["platform"],
          where: {
            ...clientWhereClause,
            createdAt: { gte: since },
          },
          _count: { id: true },
        }),
        // Por sentimiento
        prisma.socialMention.groupBy({
          by: ["sentiment"],
          where: {
            ...clientWhereClause,
            createdAt: { gte: since },
          },
          _count: { id: true },
        }),
        // Top autores por engagement
        prisma.$queryRaw<{ handle: string; platform: string; count: bigint; totalEngagement: bigint }[]>`
          SELECT sm."authorHandle" as handle, sm.platform, COUNT(*) as count,
                 SUM(COALESCE(sm.likes, 0) + COALESCE(sm.comments, 0) + COALESCE(sm.shares, 0)) as "totalEngagement"
          FROM "SocialMention" sm
          JOIN "Client" c ON sm."clientId" = c.id
          WHERE c."orgId" = ${orgId}
          AND sm."createdAt" >= ${since}
          AND sm."authorHandle" IS NOT NULL
          ${clientFilter}
          GROUP BY sm."authorHandle", sm.platform
          ORDER BY "totalEngagement" DESC, count DESC
          LIMIT 10
        `,
      ]);

      return {
        mentionsByDay: mentionsByDay.map((d) => ({
          date: d.date,
          count: Number(d.count),
        })),
        byPlatform: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count.id])),
        bySentiment: Object.fromEntries(
          bySentiment.map((s) => [s.sentiment || "UNKNOWN", s._count.id])
        ),
        topAuthors: topAuthors.map((a) => ({
          handle: a.handle,
          platform: a.platform,
          count: Number(a.count),
          totalEngagement: Number(a.totalEngagement),
        })),
      };
    }),
});
