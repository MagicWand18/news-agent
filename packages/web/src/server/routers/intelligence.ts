import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";
import { Prisma } from "@prisma/client";

export const intelligenceRouter = router({
  /**
   * Obtiene el Share of Voice de un cliente vs sus competidores.
   */
  getSOV: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        days: z.number().min(7).max(90).default(30),
        includeCompetitors: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const { clientId, days, includeCompetitors } = input;

      // Super Admin puede ver cualquier cliente
      const client = ctx.user.isSuperAdmin
        ? await prisma.client.findFirst({
            where: { id: clientId },
            include: { keywords: true },
          })
        : await prisma.client.findFirst({
            where: { id: clientId, orgId: ctx.user.orgId! },
            include: { keywords: true },
          });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      // Usar el orgId del cliente para buscar competidores
      const orgId = client.orgId;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Obtener menciones del cliente con peso por tier
      const clientMentions = await getMentionsWithTier(clientId, startDate, endDate);

      // Obtener competidores del modelo Competitor
      const clientCompetitors = await prisma.clientCompetitor.findMany({
        where: { clientId },
        include: { competitor: true },
      });

      const competitorData: Array<{
        id: string;
        name: string;
        mentions: number;
        weighted: number;
        sov: number;
        weightedSov: number;
      }> = [];

      if (includeCompetitors && clientCompetitors.length > 0) {
        // Buscar clientes que coincidan con nombres de competidores
        const competitorClients = await prisma.client.findMany({
          where: {
            orgId,
            OR: clientCompetitors.map((cc) => ({
              name: { contains: cc.competitor.name, mode: "insensitive" as const },
            })),
            active: true,
            id: { not: clientId },
          },
        });

        for (const comp of competitorClients) {
          const mentions = await getMentionsWithTier(comp.id, startDate, endDate);
          competitorData.push({
            id: comp.id,
            name: comp.name,
            mentions: mentions.count,
            weighted: mentions.weighted,
            sov: 0,
            weightedSov: 0,
          });
        }
      }

      // Calcular totales y SOV
      const total = clientMentions.count + competitorData.reduce((s, c) => s + c.mentions, 0);
      const totalWeighted = clientMentions.weighted + competitorData.reduce((s, c) => s + c.weighted, 0);

      const clientSOV = {
        id: client.id,
        name: client.name,
        mentions: clientMentions.count,
        weighted: clientMentions.weighted,
        sov: total > 0 ? (clientMentions.count / total) * 100 : 0,
        weightedSov: totalWeighted > 0 ? (clientMentions.weighted / totalWeighted) * 100 : 0,
      };

      // Calcular SOV de cada competidor
      for (const comp of competitorData) {
        comp.sov = total > 0 ? (comp.mentions / total) * 100 : 0;
        comp.weightedSov = totalWeighted > 0 ? (comp.weighted / totalWeighted) * 100 : 0;
      }

      // Obtener histórico semanal
      const history = await getSOVHistory(clientId, orgId, 8);

      return {
        clientSOV,
        competitorSOV: competitorData,
        history,
        period: { start: startDate, end: endDate, days },
        total,
        totalWeighted,
      };
    }),

  /**
   * Obtiene temas detectados en menciones.
   */
  getTopics: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user);
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const clientFilter = input.clientId
        ? Prisma.sql`AND m."clientId" = ${input.clientId}`
        : Prisma.empty;

      // Si no hay orgId (SuperAdmin sin org seleccionada), no filtrar por org
      const orgFilter = orgId
        ? Prisma.sql`AND c."orgId" = ${orgId}`
        : Prisma.empty;

      // Obtener temas agrupados
      const topics = await prisma.$queryRaw<
        { topic: string; count: bigint; positive: bigint; negative: bigint; neutral: bigint }[]
      >`
        SELECT
          m.topic,
          COUNT(*) as count,
          SUM(CASE WHEN m.sentiment = 'POSITIVE' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN m.sentiment = 'NEGATIVE' THEN 1 ELSE 0 END) as negative,
          SUM(CASE WHEN m.sentiment = 'NEUTRAL' THEN 1 ELSE 0 END) as neutral
        FROM "Mention" m
        JOIN "Client" c ON m."clientId" = c.id
        WHERE m.topic IS NOT NULL
        AND m."createdAt" >= ${since}
        ${orgFilter}
        ${clientFilter}
        GROUP BY m.topic
        ORDER BY count DESC
        LIMIT 20
      `;

      // Detectar temas emergentes (>3 menciones en últimas 24h)
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const emergingTopics = await prisma.$queryRaw<{ topic: string; count: bigint }[]>`
        SELECT m.topic, COUNT(*) as count
        FROM "Mention" m
        JOIN "Client" c ON m."clientId" = c.id
        WHERE m.topic IS NOT NULL
        AND m."createdAt" >= ${last24h}
        ${orgFilter}
        ${clientFilter}
        GROUP BY m.topic
        HAVING COUNT(*) >= 3
        ORDER BY count DESC
      `;

      return {
        topics: topics.map((t) => ({
          name: t.topic,
          count: Number(t.count),
          sentiment: {
            positive: Number(t.positive),
            negative: Number(t.negative),
            neutral: Number(t.neutral),
          },
        })),
        emergingTopics: emergingTopics.map((t) => ({
          name: t.topic,
          count: Number(t.count),
        })),
      };
    }),

  /**
   * Obtiene insights semanales generados por IA.
   */
  getWeeklyInsights: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        limit: z.number().min(1).max(10).default(4),
      })
    )
    .query(async ({ input, ctx }) => {
      // Para Super Admin sin orgId, devolver vacío o todos según contexto
      const orgId = ctx.user.orgId;

      const insights = input.clientId
        ? await prisma.weeklyInsight.findMany({
            where: { clientId: input.clientId, client: { orgId: orgId ?? undefined } },
            include: { client: { select: { id: true, name: true } } },
            orderBy: { weekStart: "desc" },
            take: input.limit,
          })
        : orgId
          ? await prisma.weeklyInsight.findMany({
              where: { client: { orgId } },
              include: { client: { select: { id: true, name: true } } },
              orderBy: { weekStart: "desc" },
              take: input.limit,
            })
          : await prisma.weeklyInsight.findMany({
              include: { client: { select: { id: true, name: true } } },
              orderBy: { weekStart: "desc" },
              take: input.limit,
            });

      return {
        insights: insights.map((i) => ({
          id: i.id,
          clientId: i.clientId,
          clientName: i.client.name,
          weekStart: i.weekStart,
          insights: i.insights as string[],
          sovData: i.sovData as { sov: number; trend: string },
          topTopics: i.topTopics as { name: string; count: number }[],
          createdAt: i.createdAt,
        })),
      };
    }),

  /**
   * Obtiene las fuentes y sus tiers configurados.
   */
  getSourceTiers: protectedProcedure.query(async () => {
    const sources = await prisma.sourceTier.findMany({
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });

    return {
      sources: sources.map((s) => ({
        id: s.id,
        domain: s.domain,
        name: s.name,
        tier: s.tier,
        reach: s.reach,
      })),
      summary: {
        tier1: sources.filter((s) => s.tier === 1).length,
        tier2: sources.filter((s) => s.tier === 2).length,
        tier3: sources.filter((s) => s.tier === 3).length,
      },
    };
  }),

  /**
   * Genera datos de reporte semanal para un cliente.
   * Retorna datos estructurados que el frontend convierte a CSV o muestra en UI.
   * Para PDF, usar el cron job semanal existente en workers.
   */
  generateReport: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = ctx.user.isSuperAdmin
        ? await prisma.client.findFirst({
            where: { id: input.clientId },
            include: { keywords: true },
          })
        : await prisma.client.findFirst({
            where: { id: input.clientId, orgId: ctx.user.orgId! },
            include: { keywords: true },
          });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const [mentions, crisisCount, sovHistory, weeklyInsight] = await Promise.all([
        prisma.mention.findMany({
          where: {
            clientId: input.clientId,
            createdAt: { gte: startDate, lte: endDate },
          },
          include: { article: true },
          orderBy: { relevance: "desc" },
        }),
        prisma.crisisAlert.count({
          where: {
            clientId: input.clientId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        getMentionsWithTier(input.clientId, startDate, endDate),
        prisma.weeklyInsight.findFirst({
          where: { clientId: input.clientId },
          orderBy: { weekStart: "desc" },
        }),
      ]);

      const sentimentBreakdown = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      for (const m of mentions) {
        const key = m.sentiment.toLowerCase() as keyof typeof sentimentBreakdown;
        if (key in sentimentBreakdown) sentimentBreakdown[key]++;
      }

      const topMentions = mentions.slice(0, 10).map((m) => ({
        title: m.article.title,
        source: m.article.source,
        url: m.article.url,
        sentiment: m.sentiment,
        relevance: m.relevance,
        aiSummary: m.aiSummary,
        date: m.createdAt.toISOString(),
      }));

      return {
        clientName: client.name,
        period: { start: startDate.toISOString(), end: endDate.toISOString() },
        totalMentions: mentions.length,
        weightedMentions: sovHistory.weighted,
        sentimentBreakdown,
        crisisAlerts: crisisCount,
        topMentions,
        insights: weeklyInsight?.insights ?? [],
        topTopics: weeklyInsight?.topTopics ?? [],
        filename: `reporte-${client.name.toLowerCase().replace(/\s+/g, "-")}-${startDate.toISOString().split("T")[0]}.csv`,
      };
    }),

  /**
   * Obtiene action items de un cliente.
   */
  getActionItems: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "NOT_APPLICABLE"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verificar acceso al cliente
      const clientWhere = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({ where: clientWhere });
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      return prisma.actionItem.findMany({
        where: {
          clientId: input.clientId,
          ...(input.status && { status: input.status }),
        },
        include: {
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  /**
   * Actualiza el estado de un action item.
   */
  updateActionItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "NOT_APPLICABLE"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };
      const item = await prisma.actionItem.findFirst({
        where: { id: input.id, ...orgFilter },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Action item no encontrado" });
      }

      return prisma.actionItem.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === "COMPLETED" && { completedAt: new Date() }),
        },
      });
    }),

  /**
   * Obtiene KPIs de inteligencia para el dashboard.
   */
  getKPIs: protectedProcedure.query(async ({ ctx }) => {
    const orgId = getEffectiveOrgId(ctx.user);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Si no hay orgId (SuperAdmin sin org), retornar zeros
    if (!orgId) {
      return { topicsCount: 0, emergingTopics: 0, avgSOV: 0, weightedMentions: 0 };
    }

    const [topicsCount, emergingCount, avgSOV, weightedMentions] = await Promise.all([
      // Temas únicos esta semana
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT topic) as count
        FROM "Mention" m
        JOIN "Client" c ON m."clientId" = c.id
        WHERE c."orgId" = ${orgId}
        AND m."createdAt" >= ${last7d}
        AND m.topic IS NOT NULL
      `,
      // Temas emergentes (>3 menciones en 24h)
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT topic
          FROM "Mention" m
          JOIN "Client" c ON m."clientId" = c.id
          WHERE c."orgId" = ${orgId}
          AND m."createdAt" >= ${last24h}
          AND m.topic IS NOT NULL
          GROUP BY topic
          HAVING COUNT(*) >= 3
        ) subq
      `,
      // SOV promedio de clientes activos
      prisma.$queryRaw<[{ avg: number | null }]>`
        SELECT AVG(mention_count::float / NULLIF(total_count::float, 0) * 100) as avg
        FROM (
          SELECT c.id,
            (SELECT COUNT(*) FROM "Mention" WHERE "clientId" = c.id AND "createdAt" >= ${last7d}) as mention_count,
            (SELECT COUNT(*) FROM "Mention" m2 JOIN "Client" c2 ON m2."clientId" = c2.id WHERE c2."orgId" = ${orgId} AND m2."createdAt" >= ${last7d}) as total_count
          FROM "Client" c
          WHERE c."orgId" = ${orgId} AND c.active = true
        ) subq
        WHERE mention_count > 0
      `,
      // Menciones ponderadas por tier
      prisma.$queryRaw<[{ weighted: bigint }]>`
        SELECT COALESCE(SUM(
          CASE st.tier
            WHEN 1 THEN 3
            WHEN 2 THEN 2
            ELSE 1
          END
        ), 0) as weighted
        FROM "Mention" m
        JOIN "Article" a ON m."articleId" = a.id
        JOIN "Client" c ON m."clientId" = c.id
        LEFT JOIN "SourceTier" st ON LOWER(REGEXP_REPLACE(a.source, '^www\\.', '')) = st.domain
        WHERE c."orgId" = ${orgId}
        AND m."createdAt" >= ${last7d}
      `,
    ]);

    return {
      topicsCount: Number(topicsCount[0]?.count ?? 0),
      emergingTopics: Number(emergingCount[0]?.count ?? 0),
      avgSOV: avgSOV[0]?.avg ?? 0,
      weightedMentions: Number(weightedMentions[0]?.weighted ?? 0),
    };
  }),
});

/**
 * Obtiene menciones con peso por tier de fuente.
 */
async function getMentionsWithTier(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<{ count: number; weighted: number }> {
  const result = await prisma.$queryRaw<[{ count: bigint; weighted: bigint }]>`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(
        CASE st.tier
          WHEN 1 THEN 3
          WHEN 2 THEN 2
          ELSE 1
        END
      ), COUNT(*)) as weighted
    FROM "Mention" m
    JOIN "Article" a ON m."articleId" = a.id
    LEFT JOIN "SourceTier" st ON LOWER(REGEXP_REPLACE(a.source, '^www\\.', '')) = st.domain
    WHERE m."clientId" = ${clientId}
    AND m."createdAt" >= ${startDate}
    AND m."createdAt" <= ${endDate}
  `;

  return {
    count: Number(result[0]?.count ?? 0),
    weighted: Number(result[0]?.weighted ?? 0),
  };
}

/**
 * Obtiene histórico de SOV por semana.
 */
async function getSOVHistory(
  clientId: string,
  orgId: string,
  weeks: number
): Promise<Array<{ week: Date; sov: number; mentions: number }>> {
  const history: Array<{ week: Date; sov: number; mentions: number }> = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const [clientCount, totalCount] = await Promise.all([
      prisma.mention.count({
        where: {
          clientId,
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      }),
      prisma.mention.count({
        where: {
          client: { orgId },
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      }),
    ]);

    history.push({
      week: weekStart,
      sov: totalCount > 0 ? (clientCount / totalCount) * 100 : 0,
      mentions: clientCount,
    });
  }

  return history;
}
