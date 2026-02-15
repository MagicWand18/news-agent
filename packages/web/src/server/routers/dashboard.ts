import { z } from "zod";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";

/**
 * Construye una query SQL dinámica con parámetros posicionales ($1, $2, ...).
 * Evita usar Prisma.empty que causa errores de sintaxis en $queryRaw.
 */
function buildRawQuery(
  baseSelect: string,
  baseFrom: string,
  baseWhere: string,
  filters: { sql: string; params: unknown[] }[],
  groupBy: string,
  orderBy: string,
  limit?: number
): { sql: string; params: unknown[] } {
  const allParams: unknown[] = [];
  let paramIndex = 1;
  let whereClause = baseWhere;

  for (const filter of filters) {
    // Reemplazar $N placeholders con el índice correcto
    let filterSql = filter.sql;
    for (const param of filter.params) {
      filterSql = filterSql.replace(`$P`, `$${paramIndex}`);
      allParams.push(param);
      paramIndex++;
    }
    whereClause += ` ${filterSql}`;
  }

  let sql = `${baseSelect} ${baseFrom} WHERE ${whereClause} ${groupBy} ${orderBy}`;
  if (limit) sql += ` LIMIT ${limit}`;

  return { sql, params: allParams };
}

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
        const filters: { sql: string; params: unknown[] }[] = [];
        if (orgId) {
          filters.push({ sql: `AND "clientId" IN (SELECT id FROM "Client" WHERE "orgId" = $P)`, params: [orgId] });
        }
        if (input?.clientId) {
          filters.push({ sql: `AND "clientId" = $P`, params: [input.clientId] });
        }
        const dateSince = since || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filters.push({ sql: `AND "createdAt" >= $P`, params: [dateSince] });

        const { sql, params } = buildRawQuery(
          `SELECT CAST(DATE("createdAt") AS TEXT) as date, CAST(COUNT(*) AS INTEGER) as count`,
          `FROM "Mention"`,
          `1=1`,
          filters,
          `GROUP BY DATE("createdAt")`,
          `ORDER BY date ASC`
        );
        return prisma.$queryRawUnsafe<{ date: string; count: number }[]>(sql, ...params);
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

      // Build where clause for Prisma ORM queries
      const clientWhereClause = input.clientId
        ? orgId
          ? { clientId: input.clientId, client: { orgId } }
          : { clientId: input.clientId }
        : orgId
          ? { client: { orgId } }
          : {};

      // Construir filtros SQL dinámicos
      const mentionFilters: { sql: string; params: unknown[] }[] = [
        { sql: `AND m."createdAt" >= $P`, params: [since] },
      ];
      if (orgId) {
        mentionFilters.push({ sql: `AND c."orgId" = $P`, params: [orgId] });
      }
      if (input.clientId) {
        mentionFilters.push({ sql: `AND m."clientId" = $P`, params: [input.clientId] });
      }

      try {
        const [mentionsByDay, sentimentByWeek, topSources, topKeywords, urgencyBreakdown] =
          await Promise.all([
            // 1. Mentions by day
            (() => {
              const { sql, params } = buildRawQuery(
                `SELECT CAST(DATE(m."createdAt") AS TEXT) as date, CAST(COUNT(*) AS INTEGER) as count`,
                `FROM "Mention" m JOIN "Client" c ON m."clientId" = c.id`,
                `1=1`,
                mentionFilters,
                `GROUP BY DATE(m."createdAt")`,
                `ORDER BY date ASC`
              );
              return prisma.$queryRawUnsafe<{ date: string; count: number }[]>(sql, ...params);
            })(),

            // 2. Sentiment trend by week
            (() => {
              const { sql, params } = buildRawQuery(
                `SELECT CAST(DATE_TRUNC('week', m."createdAt") AS TEXT) as week, m.sentiment, CAST(COUNT(*) AS INTEGER) as count`,
                `FROM "Mention" m JOIN "Client" c ON m."clientId" = c.id`,
                `1=1`,
                mentionFilters,
                `GROUP BY DATE_TRUNC('week', m."createdAt"), m.sentiment`,
                `ORDER BY week ASC`
              );
              return prisma.$queryRawUnsafe<{ week: string; sentiment: string; count: number }[]>(sql, ...params);
            })(),

            // 3. Top sources
            (() => {
              const sourceFilters: { sql: string; params: unknown[] }[] = [
                { sql: `AND m."createdAt" >= $P`, params: [since] },
              ];
              if (orgId) sourceFilters.push({ sql: `AND c."orgId" = $P`, params: [orgId] });
              if (input.clientId) sourceFilters.push({ sql: `AND m."clientId" = $P`, params: [input.clientId] });

              const { sql, params } = buildRawQuery(
                `SELECT a.source, CAST(COUNT(*) AS INTEGER) as count`,
                `FROM "Mention" m JOIN "Article" a ON m."articleId" = a.id JOIN "Client" c ON m."clientId" = c.id`,
                `1=1`,
                sourceFilters,
                `GROUP BY a.source`,
                `ORDER BY count DESC`,
                10
              );
              return prisma.$queryRawUnsafe<{ source: string; count: number }[]>(sql, ...params);
            })(),

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

      const clientWhereClause = input.clientId
        ? orgId
          ? { clientId: input.clientId, client: { orgId } }
          : { clientId: input.clientId }
        : orgId
          ? { client: { orgId } }
          : {};

      // Filtros SQL dinámicos para social
      const socialFilters: { sql: string; params: unknown[] }[] = [
        { sql: `AND sm."createdAt" >= $P`, params: [since] },
      ];
      if (orgId) socialFilters.push({ sql: `AND c."orgId" = $P`, params: [orgId] });
      if (input.clientId) socialFilters.push({ sql: `AND sm."clientId" = $P`, params: [input.clientId] });

      try {
      const [mentionsByDay, byPlatform, bySentiment, topAuthors] = await Promise.all([
        // Menciones por día
        (() => {
          const { sql, params } = buildRawQuery(
            `SELECT CAST(DATE(sm."createdAt") AS TEXT) as date, CAST(COUNT(*) AS INTEGER) as count`,
            `FROM "SocialMention" sm JOIN "Client" c ON sm."clientId" = c.id`,
            `1=1`,
            socialFilters,
            `GROUP BY DATE(sm."createdAt")`,
            `ORDER BY date ASC`
          );
          return prisma.$queryRawUnsafe<{ date: string; count: number }[]>(sql, ...params);
        })(),
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
        (() => {
          const authorFilters: { sql: string; params: unknown[] }[] = [
            { sql: `AND sm."createdAt" >= $P`, params: [since] },
            { sql: `AND sm."authorHandle" IS NOT NULL`, params: [] },
          ];
          if (orgId) authorFilters.push({ sql: `AND c."orgId" = $P`, params: [orgId] });
          if (input.clientId) authorFilters.push({ sql: `AND sm."clientId" = $P`, params: [input.clientId] });

          const { sql, params } = buildRawQuery(
            `SELECT sm."authorHandle" as handle, sm.platform, CAST(COUNT(*) AS INTEGER) as count, CAST(SUM(COALESCE(sm.likes, 0) + COALESCE(sm.comments, 0) + COALESCE(sm.shares, 0)) AS INTEGER) as "totalEngagement"`,
            `FROM "SocialMention" sm JOIN "Client" c ON sm."clientId" = c.id`,
            `1=1`,
            authorFilters,
            `GROUP BY sm."authorHandle", sm.platform`,
            `ORDER BY "totalEngagement" DESC, count DESC`,
            10
          );
          return prisma.$queryRawUnsafe<{ handle: string; platform: string; count: number; totalEngagement: number }[]>(sql, ...params);
        })(),
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
      } catch (error) {
        console.error("[Dashboard] getSocialAnalytics error:", error);
        return { mentionsByDay: [], byPlatform: {}, bySentiment: {}, topAuthors: [] };
      }
    }),
});
