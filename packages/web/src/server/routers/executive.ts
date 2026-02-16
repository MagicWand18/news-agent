import { z } from "zod";
import { router, superAdminProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";

/**
 * Router del Executive Dashboard.
 * Todos los endpoints son exclusivos para Super Admin.
 * Provee KPIs globales, tarjetas por organización, health scores,
 * alertas de inactividad y heatmap de actividad.
 */
export const executiveRouter = router({
  /**
   * KPIs globales con deltas vs periodo anterior.
   */
  globalKPIs: superAdminProcedure
    .input(
      z
        .object({
          days: z.number().min(1).max(90).default(7),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const days = input?.days ?? 7;
      const now = new Date();
      const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

      try {
        const [
          mentionsCurrent,
          mentionsPrevious,
          socialCurrent,
          socialPrevious,
          crisesCurrent,
          crisesPrevious,
          activeClients,
          sentimentPositive,
          sentimentTotal,
        ] = await Promise.all([
          // Menciones periodo actual
          prisma.mention.count({
            where: { publishedAt: { gte: currentStart }, isLegacy: false },
          }),
          // Menciones periodo anterior
          prisma.mention.count({
            where: {
              publishedAt: { gte: previousStart, lt: currentStart },
              isLegacy: false,
            },
          }),
          // Social menciones periodo actual
          prisma.socialMention.count({
            where: { postedAt: { gte: currentStart } },
          }),
          // Social menciones periodo anterior
          prisma.socialMention.count({
            where: { postedAt: { gte: previousStart, lt: currentStart } },
          }),
          // Crisis activas periodo actual
          prisma.crisisAlert.count({
            where: { status: "ACTIVE" },
          }),
          // Crisis creadas en periodo anterior (para comparar)
          prisma.crisisAlert.count({
            where: {
              createdAt: { gte: previousStart, lt: currentStart },
              status: "ACTIVE",
            },
          }),
          // Clientes activos
          prisma.client.count({
            where: { active: true },
          }),
          // Sentimiento positivo (periodo actual)
          prisma.mention.count({
            where: {
              publishedAt: { gte: currentStart },
              isLegacy: false,
              sentiment: "POSITIVE",
            },
          }),
          // Total menciones para sentimiento (periodo actual)
          prisma.mention.count({
            where: { publishedAt: { gte: currentStart }, isLegacy: false },
          }),
        ]);

        // Calcular deltas: ((current - previous) / previous * 100)
        const calcDelta = (current: number, previous: number): number => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return Math.round(((current - previous) / previous) * 100);
        };

        const avgSentiment =
          sentimentTotal > 0
            ? Math.round((sentimentPositive / sentimentTotal) * 100)
            : 0;

        return {
          totalMentions: mentionsCurrent,
          totalSocialMentions: socialCurrent,
          activeCrises: crisesCurrent,
          activeClients,
          avgSentiment,
          mentionsDelta: calcDelta(mentionsCurrent, mentionsPrevious),
          socialDelta: calcDelta(socialCurrent, socialPrevious),
          crisesDelta: calcDelta(crisesCurrent, crisesPrevious),
        };
      } catch (error) {
        console.error("[Executive] globalKPIs error:", error);
        return {
          totalMentions: 0,
          totalSocialMentions: 0,
          activeCrises: 0,
          activeClients: 0,
          avgSentiment: 0,
          mentionsDelta: 0,
          socialDelta: 0,
          crisesDelta: 0,
        };
      }
    }),

  /**
   * Tarjetas por organización con métricas resumidas.
   */
  orgCards: superAdminProcedure
    .input(
      z
        .object({
          days: z.number().min(1).max(90).default(7),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const days = input?.days ?? 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      try {
        const orgs = await prisma.organization.findMany({
          select: {
            id: true,
            name: true,
            clients: {
              where: { active: true },
              select: { id: true, name: true },
            },
          },
        });

        const cards = await Promise.all(
          orgs.map(async (org) => {
            const clientIds = org.clients.map((c) => c.id);

            if (clientIds.length === 0) {
              return {
                orgId: org.id,
                orgName: org.name,
                clientCount: 0,
                mentionCount: 0,
                socialMentionCount: 0,
                activeCrises: 0,
                avgSentiment: 0,
                topClient: null,
              };
            }

            const [mentionCount, socialMentionCount, activeCrises, positiveMentions, totalMentions, topClientData] =
              await Promise.all([
                // Menciones en el periodo
                prisma.mention.count({
                  where: {
                    clientId: { in: clientIds },
                    isLegacy: false,
                    publishedAt: { gte: since },
                  },
                }),
                // Social menciones en el periodo
                prisma.socialMention.count({
                  where: {
                    clientId: { in: clientIds },
                    postedAt: { gte: since },
                  },
                }),
                // Crisis activas
                prisma.crisisAlert.count({
                  where: {
                    clientId: { in: clientIds },
                    status: "ACTIVE",
                  },
                }),
                // Positivas para sentimiento
                prisma.mention.count({
                  where: {
                    clientId: { in: clientIds },
                    isLegacy: false,
                    publishedAt: { gte: since },
                    sentiment: "POSITIVE",
                  },
                }),
                // Total para sentimiento
                prisma.mention.count({
                  where: {
                    clientId: { in: clientIds },
                    isLegacy: false,
                    publishedAt: { gte: since },
                  },
                }),
                // Top client por menciones
                prisma.mention.groupBy({
                  by: ["clientId"],
                  where: {
                    clientId: { in: clientIds },
                    isLegacy: false,
                    publishedAt: { gte: since },
                  },
                  _count: { id: true },
                  orderBy: { _count: { id: "desc" } },
                  take: 1,
                }),
              ]);

            // Resolver top client
            let topClient: { id: string; name: string; mentionCount: number } | null = null;
            if (topClientData.length > 0) {
              const clientInfo = org.clients.find((c) => c.id === topClientData[0].clientId);
              if (clientInfo) {
                topClient = {
                  id: clientInfo.id,
                  name: clientInfo.name,
                  mentionCount: topClientData[0]._count.id,
                };
              }
            }

            const avgSentiment =
              totalMentions > 0
                ? Math.round((positiveMentions / totalMentions) * 100)
                : 0;

            return {
              orgId: org.id,
              orgName: org.name,
              clientCount: org.clients.length,
              mentionCount,
              socialMentionCount,
              activeCrises,
              avgSentiment,
              topClient,
            };
          })
        );

        return cards;
      } catch (error) {
        console.error("[Executive] orgCards error:", error);
        return [];
      }
    }),

  /**
   * Health scores por cliente con componentes desglosados y tendencia.
   */
  clientHealthScores: superAdminProcedure
    .input(
      z
        .object({
          orgId: z.string().optional(),
          limit: z.number().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const orgId = input?.orgId;
      const limit = input?.limit ?? 20;
      const now = new Date();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prev7d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      try {
        // Obtener clientes activos
        const clients = await prisma.client.findMany({
          where: {
            active: true,
            ...(orgId ? { orgId } : {}),
          },
          select: {
            id: true,
            name: true,
            org: { select: { name: true } },
          },
        });

        if (clients.length === 0) return [];

        const allClientIds = clients.map((c) => c.id);

        // Obtener datos globales para normalización
        const totalMentionsAll = await prisma.mention.count({
          where: {
            clientId: { in: allClientIds },
            isLegacy: false,
            publishedAt: { gte: last7d },
          },
        });

        const avgMentionsPerClient =
          clients.length > 0 ? totalMentionsAll / clients.length : 1;

        // Calcular score para cada cliente
        const scores = await Promise.all(
          clients.map(async (client) => {
            // Periodo actual (7d)
            const [
              mentionCount,
              positiveMentions,
              negativeMentions,
              totalClientMentions,
              activeCrisisCount,
              lastCrisis,
              responseDraftCount,
              socialEngaged,
              totalSocial,
              // Periodo anterior (7d previos) para tendencia
              prevMentionCount,
              prevPositiveMentions,
              prevTotalMentions,
              prevActiveCrisis,
              prevResponseDraftCount,
              prevSocialEngaged,
              prevTotalSocial,
            ] = await Promise.all([
              // --- Periodo actual ---
              prisma.mention.count({
                where: { clientId: client.id, isLegacy: false, publishedAt: { gte: last7d } },
              }),
              prisma.mention.count({
                where: { clientId: client.id, isLegacy: false, publishedAt: { gte: last7d }, sentiment: "POSITIVE" },
              }),
              prisma.mention.count({
                where: { clientId: client.id, isLegacy: false, publishedAt: { gte: last7d }, sentiment: "NEGATIVE" },
              }),
              prisma.mention.count({
                where: { clientId: client.id, isLegacy: false, publishedAt: { gte: last7d } },
              }),
              prisma.crisisAlert.count({
                where: { clientId: client.id, status: "ACTIVE" },
              }),
              prisma.crisisAlert.findFirst({
                where: { clientId: client.id },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
              }),
              prisma.responseDraft.count({
                where: {
                  OR: [
                    { mention: { clientId: client.id } },
                    { socialMention: { clientId: client.id } },
                  ],
                  createdAt: { gte: last7d },
                },
              }),
              // Social con engagement > 10
              prisma.socialMention.count({
                where: {
                  clientId: client.id,
                  postedAt: { gte: last7d },
                  OR: [
                    { likes: { gte: 10 } },
                    { comments: { gte: 10 } },
                    { shares: { gte: 10 } },
                  ],
                },
              }),
              prisma.socialMention.count({
                where: { clientId: client.id, postedAt: { gte: last7d } },
              }),
              // --- Periodo anterior ---
              prisma.mention.count({
                where: { clientId: client.id, isLegacy: false, publishedAt: { gte: prev7d, lt: last7d } },
              }),
              prisma.mention.count({
                where: { clientId: client.id, isLegacy: false, publishedAt: { gte: prev7d, lt: last7d }, sentiment: "POSITIVE" },
              }),
              prisma.mention.count({
                where: { clientId: client.id, isLegacy: false, publishedAt: { gte: prev7d, lt: last7d } },
              }),
              prisma.crisisAlert.count({
                where: { clientId: client.id, status: "ACTIVE", createdAt: { gte: prev7d, lt: last7d } },
              }),
              prisma.responseDraft.count({
                where: {
                  OR: [
                    { mention: { clientId: client.id } },
                    { socialMention: { clientId: client.id } },
                  ],
                  createdAt: { gte: prev7d, lt: last7d },
                },
              }),
              prisma.socialMention.count({
                where: {
                  clientId: client.id,
                  postedAt: { gte: prev7d, lt: last7d },
                  OR: [
                    { likes: { gte: 10 } },
                    { comments: { gte: 10 } },
                    { shares: { gte: 10 } },
                  ],
                },
              }),
              prisma.socialMention.count({
                where: { clientId: client.id, postedAt: { gte: prev7d, lt: last7d } },
              }),
            ]);

            // --- Calcular componentes del score ---

            // Volume (20%): menciones / promedio entre clientes
            const volumeRatio = avgMentionsPerClient > 0
              ? mentionCount / avgMentionsPerClient
              : 0;
            const volume = volumeRatio >= 1.5 ? 100
              : volumeRatio <= 0.5 ? 30
              : 30 + ((volumeRatio - 0.5) / (1.5 - 0.5)) * 70;

            // Sentiment (25%): positivas / total * 100
            const sentimentRatio = totalClientMentions > 0
              ? positiveMentions / totalClientMentions
              : 0.5;
            const sentiment = sentimentRatio >= 0.7 ? 100
              : sentimentRatio <= 0.3 ? 20
              : 20 + ((sentimentRatio - 0.3) / (0.7 - 0.3)) * 80;

            // SOV (15%): menciones cliente / total menciones * 100
            const sovRatio = totalMentionsAll > 0
              ? (mentionCount / totalMentionsAll) * 100
              : 0;
            const sov = sovRatio >= 40 ? 100
              : sovRatio <= 5 ? 20
              : 20 + ((sovRatio - 5) / (40 - 5)) * 80;

            // CrisisFree (20%): sin crisis = 100, sino días desde última / 30
            let crisisFree = 100;
            if (activeCrisisCount > 0) {
              crisisFree = 0;
            } else if (lastCrisis) {
              const daysSince = Math.floor(
                (now.getTime() - lastCrisis.createdAt.getTime()) / (24 * 60 * 60 * 1000)
              );
              crisisFree = Math.min(100, Math.round((daysSince / 30) * 100));
            }

            // ResponseRate (10%): borradores / menciones negativas, capped 100
            const responseRate = negativeMentions > 0
              ? Math.min(100, Math.round((responseDraftCount / negativeMentions) * 100))
              : 100;

            // Engagement (10%): social con engagement > 10 / total social
            const engagement = totalSocial > 0
              ? Math.min(100, Math.round((socialEngaged / totalSocial) * 100))
              : 50;

            // Score ponderado
            const currentScore = Math.round(
              volume * 0.2 +
              sentiment * 0.25 +
              sov * 0.15 +
              crisisFree * 0.2 +
              responseRate * 0.1 +
              engagement * 0.1
            );

            // --- Calcular score del periodo anterior para tendencia ---
            const prevAvgMentions = avgMentionsPerClient > 0 ? avgMentionsPerClient : 1;
            const prevVolumeRatio = prevAvgMentions > 0
              ? prevMentionCount / prevAvgMentions
              : 0;
            const prevVolume = prevVolumeRatio >= 1.5 ? 100
              : prevVolumeRatio <= 0.5 ? 30
              : 30 + ((prevVolumeRatio - 0.5) / (1.5 - 0.5)) * 70;

            const prevSentimentRatio = prevTotalMentions > 0
              ? prevPositiveMentions / prevTotalMentions
              : 0.5;
            const prevSentiment = prevSentimentRatio >= 0.7 ? 100
              : prevSentimentRatio <= 0.3 ? 20
              : 20 + ((prevSentimentRatio - 0.3) / (0.7 - 0.3)) * 80;

            const prevSov = sov; // Simplificación: usar mismo SOV
            const prevCrisisFree = prevActiveCrisis > 0 ? 0 : 100;

            const prevNegative = prevTotalMentions > 0
              ? prevTotalMentions - prevPositiveMentions
              : 0;
            const prevResponseRate = prevNegative > 0
              ? Math.min(100, Math.round((prevResponseDraftCount / prevNegative) * 100))
              : 100;

            const prevEngagement = prevTotalSocial > 0
              ? Math.min(100, Math.round((prevSocialEngaged / prevTotalSocial) * 100))
              : 50;

            const prevScore = Math.round(
              prevVolume * 0.2 +
              prevSentiment * 0.25 +
              prevSov * 0.15 +
              prevCrisisFree * 0.2 +
              prevResponseRate * 0.1 +
              prevEngagement * 0.1
            );

            const diff = currentScore - prevScore;
            const trend: "up" | "down" | "stable" =
              diff > 5 ? "up" : diff < -5 ? "down" : "stable";

            return {
              clientId: client.id,
              clientName: client.name,
              orgName: client.org.name,
              score: currentScore,
              components: {
                volume: Math.round(volume),
                sentiment: Math.round(sentiment),
                sov: Math.round(sov),
                crisisFree: Math.round(crisisFree),
                responseRate: Math.round(responseRate),
                engagement: Math.round(engagement),
              },
              trend,
            };
          })
        );

        // Ordenar por score descendente y limitar
        return scores
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      } catch (error) {
        console.error("[Executive] clientHealthScores error:", error);
        return [];
      }
    }),

  /**
   * Alertas de inactividad: clientes sin menciones recientes.
   */
  inactivityAlerts: superAdminProcedure
    .input(
      z
        .object({
          thresholdDays: z.number().min(1).max(90).default(3),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const thresholdDays = input?.thresholdDays ?? 3;
      const threshold = new Date(
        Date.now() - thresholdDays * 24 * 60 * 60 * 1000
      );

      try {
        // Obtener todos los clientes activos con su última actividad
        const clients = await prisma.client.findMany({
          where: { active: true },
          select: {
            id: true,
            name: true,
            org: { select: { name: true } },
          },
        });

        if (clients.length === 0) return [];

        // Para cada cliente, obtener última mención y última social mention
        const alerts = await Promise.all(
          clients.map(async (client) => {
            const [lastMention, lastSocialMention] = await Promise.all([
              prisma.mention.findFirst({
                where: { clientId: client.id, isLegacy: false },
                orderBy: { publishedAt: "desc" },
                select: { publishedAt: true },
              }),
              prisma.socialMention.findFirst({
                where: { clientId: client.id },
                orderBy: { postedAt: "desc" },
                select: { postedAt: true },
              }),
            ]);

            const lastMentionAt = lastMention?.publishedAt ?? null;
            const lastSocialMentionAt = lastSocialMention?.postedAt ?? null;

            // Determinar la actividad más reciente
            const latestActivity = [lastMentionAt, lastSocialMentionAt]
              .filter((d): d is Date => d !== null)
              .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

            // Calcular días sin actividad
            const daysSinceActivity = latestActivity
              ? Math.floor(
                  (Date.now() - latestActivity.getTime()) / (24 * 60 * 60 * 1000)
                )
              : 999; // Sin actividad nunca

            return {
              clientId: client.id,
              clientName: client.name,
              orgName: client.org.name,
              lastMentionAt,
              lastSocialMentionAt,
              daysSinceActivity,
            };
          })
        );

        // Filtrar solo los que superan el umbral y ordenar
        return alerts
          .filter((a) => {
            // Ambos deben ser anteriores al umbral (o null)
            const mentionOld = !a.lastMentionAt || a.lastMentionAt < threshold;
            const socialOld = !a.lastSocialMentionAt || a.lastSocialMentionAt < threshold;
            return mentionOld && socialOld;
          })
          .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
      } catch (error) {
        console.error("[Executive] inactivityAlerts error:", error);
        return [];
      }
    }),

  /**
   * Heatmap de actividad: menciones agrupadas por día de semana y hora.
   */
  activityHeatmap: superAdminProcedure
    .input(
      z
        .object({
          days: z.number().min(1).max(90).default(30),
          orgId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const days = input?.days ?? 30;
      const orgId = input?.orgId;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      try {
        // Construir query dinámica para menciones + social mentions
        const params: unknown[] = [];
        let paramIdx = 1;

        // Filtro de fecha para menciones
        let mentionWhere = `WHERE COALESCE(m."publishedAt", m."createdAt") >= $${paramIdx} AND m."isLegacy" = false`;
        params.push(since);
        paramIdx++;

        let socialWhere = `WHERE COALESCE(sm."postedAt", sm."createdAt") >= $${paramIdx}`;
        params.push(since);
        paramIdx++;

        // Filtro de organización
        if (orgId) {
          mentionWhere += ` AND m."clientId" IN (SELECT id FROM "Client" WHERE "orgId" = $${paramIdx})`;
          params.push(orgId);
          paramIdx++;

          socialWhere += ` AND sm."clientId" IN (SELECT id FROM "Client" WHERE "orgId" = $${paramIdx})`;
          params.push(orgId);
          paramIdx++;
        }

        const sql = `
          SELECT
            CAST(combined."dt" AS TEXT) as "date",
            CAST(EXTRACT(HOUR FROM combined."ts") AS INTEGER) as "hour",
            CAST(COUNT(*) AS INTEGER) as "count"
          FROM (
            SELECT
              DATE(COALESCE(m."publishedAt", m."createdAt")) as "dt",
              COALESCE(m."publishedAt", m."createdAt") as "ts"
            FROM "Mention" m
            ${mentionWhere}
            UNION ALL
            SELECT
              DATE(COALESCE(sm."postedAt", sm."createdAt")) as "dt",
              COALESCE(sm."postedAt", sm."createdAt") as "ts"
            FROM "SocialMention" sm
            ${socialWhere}
          ) combined
          GROUP BY combined."dt", EXTRACT(HOUR FROM combined."ts")
          ORDER BY combined."dt" ASC, "hour" ASC
        `;

        const rows = await prisma.$queryRawUnsafe<
          { date: string; hour: number; count: number }[]
        >(sql, ...params);

        return rows.map((r) => ({
          date: String(r.date),
          hour: Number(r.hour),
          count: Number(r.count),
        }));
      } catch (error) {
        console.error("[Executive] activityHeatmap error:", error);
        return [];
      }
    }),
});
