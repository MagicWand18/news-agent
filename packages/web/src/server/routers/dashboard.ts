import { z } from "zod";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";
import { Prisma } from "@prisma/client";

export const dashboardRouter = router({
  stats: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        clientId: z.string().optional(),
        days: z.number().min(0).max(90).default(7),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const orgId = getEffectiveOrgId(ctx.user, input?.orgId);
      const days = input?.days ?? 7;
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      // days=0 significa "todo" (sin filtro de fecha)
      const since = days > 0 ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

    // Construir filtros
    const orgFilter = orgId ? { orgId } : {};
    const clientOrgFilter = orgId ? { client: { orgId } } : {};
    const clientIdFilter = input?.clientId ? { clientId: input.clientId } : {};
    const clientIdOrgFilter = { ...clientOrgFilter, ...clientIdFilter };

    // Filtro de fecha para el periodo seleccionado
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    const [
      clientCount,
      mentions24h,
      mentionsPeriod,
      tasksPending,
      mentionsByDay,
      sentimentBreakdown,
    ] = await Promise.all([
      prisma.client.count({ where: { ...orgFilter, active: true } }),
      prisma.mention.count({
        where: { ...clientIdOrgFilter, isLegacy: false, createdAt: { gte: last24h } },
      }),
      prisma.mention.count({
        where: { ...clientIdOrgFilter, isLegacy: false, ...dateFilter },
      }),
      prisma.task.count({
        where: {
          ...clientIdOrgFilter,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),
      // Query raw para menciones por día
      (() => {
        const orgSql = orgId ? Prisma.sql`AND "clientId" IN (SELECT id FROM "Client" WHERE "orgId" = ${orgId})` : Prisma.empty;
        const clientSql = input?.clientId ? Prisma.sql`AND "clientId" = ${input.clientId}` : Prisma.empty;
        const dateSql = since ? Prisma.sql`AND "createdAt" >= ${since}` : Prisma.sql`AND "createdAt" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}`;

        return prisma.$queryRaw<{ date: string; count: number }[]>`
          SELECT DATE("createdAt")::TEXT as date, COUNT(*)::INTEGER as count
          FROM "Mention"
          WHERE 1=1
          ${orgSql}
          ${clientSql}
          ${dateSql}
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `;
      })(),
      prisma.mention.groupBy({
        by: ["sentiment"],
        where: { ...clientIdOrgFilter, ...dateFilter },
        _count: true,
      }),
    ]);

    return {
      clientCount,
      mentions24h,
      mentions7d: mentionsPeriod,
      tasksPending,
      mentionsByDay: mentionsByDay.map((d) => ({
        date: String(d.date),
        count: Number(d.count),
      })),
      sentimentBreakdown: sentimentBreakdown.map((s) => ({
        sentiment: s.sentiment,
        count: s._count,
      })),
    };
  }),

  recentMentions: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        clientId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const orgId = getEffectiveOrgId(ctx.user, input?.orgId);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};
      const clientIdFilter = input?.clientId ? { clientId: input.clientId } : {};

      return prisma.mention.findMany({
        where: { ...clientOrgFilter, ...clientIdFilter, isLegacy: false },
        include: {
          article: { select: { title: true, source: true, url: true, publishedAt: true } },
          client: { select: { name: true, org: ctx.user.isSuperAdmin ? { select: { name: true } } : false } },
        },
        orderBy: [{ article: { publishedAt: "desc" } }, { createdAt: "desc" }],
        take: 10,
      });
    }),

  analytics: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        days: z.number().min(0).max(90).default(30),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);
      // days=0 significa "todo" - usar 365 días como máximo razonable
      const effectiveDays = input.days === 0 ? 365 : input.days;
      const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000);

      // Build client filter
      const clientFilter = input.clientId
        ? Prisma.sql`AND m."clientId" = ${input.clientId}`
        : Prisma.empty;

      // Build where clause depending on whether we have orgId filter
      const clientWhereClause = input.clientId
        ? orgId
          ? { clientId: input.clientId, client: { orgId } }
          : { clientId: input.clientId }
        : orgId
          ? { client: { orgId } }
          : {};

      // Filtro de organización para raw queries (vacío si Super Admin ve todo)
      const orgFilterSql = orgId
        ? Prisma.sql`AND c."orgId" = ${orgId}`
        : Prisma.empty;

      try {
        const [mentionsByDay, sentimentByWeek, topSources, topKeywords, urgencyBreakdown] =
          await Promise.all([
            // 1. Mentions by day
            prisma.$queryRaw<{ date: string; count: number }[]>`
              SELECT DATE(m."createdAt")::TEXT as date, COUNT(*)::INTEGER as count
              FROM "Mention" m
              JOIN "Client" c ON m."clientId" = c.id
              WHERE m."createdAt" >= ${since}
              ${orgFilterSql}
              ${clientFilter}
              GROUP BY DATE(m."createdAt")
              ORDER BY date ASC
            `,

            // 2. Sentiment trend by week
            prisma.$queryRaw<{ week: string; sentiment: string; count: number }[]>`
              SELECT DATE_TRUNC('week', m."createdAt")::TEXT as week, m.sentiment, COUNT(*)::INTEGER as count
              FROM "Mention" m
              JOIN "Client" c ON m."clientId" = c.id
              WHERE m."createdAt" >= ${since}
              ${orgFilterSql}
              ${clientFilter}
              GROUP BY DATE_TRUNC('week', m."createdAt"), m.sentiment
              ORDER BY week ASC
            `,

            // 3. Top sources
            prisma.$queryRaw<{ source: string; count: number }[]>`
              SELECT a.source, COUNT(*)::INTEGER as count
              FROM "Mention" m
              JOIN "Article" a ON m."articleId" = a.id
              JOIN "Client" c ON m."clientId" = c.id
              WHERE m."createdAt" >= ${since}
              ${orgFilterSql}
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
            date: String(d.date),
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
      } catch (error) {
        console.error("[Dashboard] analytics error:", error);
        return { mentionsByDay: [], sentimentTrend: [], topSources: [], topKeywords: [], urgencyBreakdown: [] };
      }
    }),

  /**
   * Estadísticas de redes sociales para el dashboard principal.
   */
  getSocialDashboardStats: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        clientId: z.string().optional(),
        days: z.number().min(0).max(90).default(7),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const orgId = getEffectiveOrgId(ctx.user, input?.orgId);
      const days = input?.days ?? 7;
      const effectiveDays = days === 0 ? 365 : days;
      const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};
      const clientIdFilter = input?.clientId ? { clientId: input.clientId } : {};

      const [totalPeriod, byPlatform] = await Promise.all([
        prisma.socialMention.count({
          where: {
            ...clientOrgFilter,
            ...clientIdFilter,
            createdAt: { gte: since },
          },
        }),
        prisma.socialMention.groupBy({
          by: ["platform"],
          where: {
            ...clientOrgFilter,
            ...clientIdFilter,
            createdAt: { gte: since },
          },
          _count: { id: true },
        }),
      ]);

    return {
      total7d: totalPeriod,
      byPlatform: {
        TWITTER: byPlatform.find((p) => p.platform === "TWITTER")?._count.id ?? 0,
        INSTAGRAM: byPlatform.find((p) => p.platform === "INSTAGRAM")?._count.id ?? 0,
        TIKTOK: byPlatform.find((p) => p.platform === "TIKTOK")?._count.id ?? 0,
        YOUTUBE: byPlatform.find((p) => p.platform === "YOUTUBE")?._count.id ?? 0,
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
        days: z.number().min(0).max(90).default(30),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);
      const effectiveDays = input.days === 0 ? 365 : input.days;
      const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000);

      const clientFilter = input.clientId
        ? Prisma.sql`AND sm."clientId" = ${input.clientId}`
        : Prisma.empty;

      // Filtro de organización para raw queries
      const orgFilterSql = orgId
        ? Prisma.sql`AND c."orgId" = ${orgId}`
        : Prisma.empty;

      const clientWhereClause = input.clientId
        ? orgId
          ? { clientId: input.clientId, client: { orgId } }
          : { clientId: input.clientId }
        : orgId
          ? { client: { orgId } }
          : {};

      const [mentionsByDay, byPlatform, bySentiment, topAuthors] = await Promise.all([
        // Menciones por día
        prisma.$queryRaw<{ date: string; count: number }[]>`
          SELECT DATE(sm."createdAt")::TEXT as date, COUNT(*)::INTEGER as count
          FROM "SocialMention" sm
          JOIN "Client" c ON sm."clientId" = c.id
          WHERE sm."createdAt" >= ${since}
          ${orgFilterSql}
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
        prisma.$queryRaw<{ handle: string; platform: string; count: number; totalEngagement: number }[]>`
          SELECT sm."authorHandle" as handle, sm.platform, COUNT(*)::INTEGER as count,
                 SUM(COALESCE(sm.likes, 0) + COALESCE(sm.comments, 0) + COALESCE(sm.shares, 0))::INTEGER as "totalEngagement"
          FROM "SocialMention" sm
          JOIN "Client" c ON sm."clientId" = c.id
          WHERE sm."createdAt" >= ${since}
          AND sm."authorHandle" IS NOT NULL
          ${orgFilterSql}
          ${clientFilter}
          GROUP BY sm."authorHandle", sm.platform
          ORDER BY "totalEngagement" DESC, count DESC
          LIMIT 10
        `,
      ]);

      return {
        mentionsByDay: mentionsByDay.map((d) => ({
          date: String(d.date),
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
