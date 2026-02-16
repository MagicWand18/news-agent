import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";

const CampaignStatusEnum = z.enum([
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
]);

export const campaignsRouter = router({
  /**
   * Lista campañas con filtros por cliente y status.
   */
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        status: CampaignStatusEnum.optional(),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);

      const campaigns = await prisma.campaign.findMany({
        where: {
          ...(orgId && { client: { orgId } }),
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.status && { status: input.status }),
        },
        include: {
          client: { select: { id: true, name: true } },
          crisisAlert: { select: { id: true, severity: true, status: true } },
          _count: {
            select: {
              mentions: true,
              socialMentions: true,
              notes: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return campaigns;
    }),

  /**
   * Obtiene una campaña por ID con notas y conteos.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin
        ? {}
        : { client: { orgId: ctx.user.orgId! } };

      const campaign = await prisma.campaign.findFirst({
        where: { id: input.id, ...orgFilter },
        include: {
          client: { select: { id: true, name: true } },
          crisisAlert: {
            select: {
              id: true,
              severity: true,
              status: true,
              triggerType: true,
              mentionCount: true,
              createdAt: true,
            },
          },
          notes: {
            include: {
              author: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: {
              mentions: true,
              socialMentions: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaña no encontrada",
        });
      }

      return campaign;
    }),

  /**
   * Crea una nueva campaña.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        clientId: z.string(),
        description: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        objectives: z
          .object({ goals: z.array(z.string()) })
          .optional(),
        tags: z.array(z.string()).optional(),
        crisisAlertId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clientWhere = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({ where: clientWhere });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente no encontrado",
        });
      }

      return prisma.campaign.create({
        data: {
          name: input.name,
          clientId: input.clientId,
          description: input.description,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          objectives: input.objectives
            ? JSON.parse(JSON.stringify(input.objectives))
            : undefined,
          tags: input.tags || [],
          crisisAlertId: input.crisisAlertId || undefined,
        },
        include: {
          client: { select: { id: true, name: true } },
        },
      });
    }),

  /**
   * Actualiza una campaña existente.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        status: CampaignStatusEnum.optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        objectives: z
          .object({ goals: z.array(z.string()) })
          .nullable()
          .optional(),
        tags: z.array(z.string()).optional(),
        crisisAlertId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, startDate, endDate, objectives, ...rest } = input;
      const orgFilter = ctx.user.isSuperAdmin
        ? {}
        : { client: { orgId: ctx.user.orgId! } };

      const campaign = await prisma.campaign.findFirst({
        where: { id, ...orgFilter },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaña no encontrada",
        });
      }

      return prisma.campaign.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate !== undefined && {
            startDate: startDate ? new Date(startDate) : null,
          }),
          ...(endDate !== undefined && {
            endDate: endDate ? new Date(endDate) : null,
          }),
          ...(objectives !== undefined && {
            objectives: objectives
              ? JSON.parse(JSON.stringify(objectives))
              : null,
          }),
        },
        include: {
          client: { select: { id: true, name: true } },
        },
      });
    }),

  /**
   * Elimina una campaña.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin
        ? {}
        : { client: { orgId: ctx.user.orgId! } };

      const campaign = await prisma.campaign.findFirst({
        where: { id: input.id, ...orgFilter },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaña no encontrada",
        });
      }

      await prisma.campaign.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /**
   * Agrega una nota a la campaña.
   */
  addNote: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return prisma.campaignNote.create({
        data: {
          campaignId: input.campaignId,
          content: input.content,
          authorId: ctx.user.id,
        },
        include: {
          author: { select: { id: true, name: true } },
        },
      });
    }),

  /**
   * Vincula menciones de medios a la campaña (auto por fecha o manual).
   */
  addMentions: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        mentionIds: z.array(z.string()).min(1).max(200),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.campaignMention.createMany({
        data: input.mentionIds.map((mentionId) => ({
          campaignId: input.campaignId,
          mentionId,
        })),
        skipDuplicates: true,
      });

      return { success: true, count: input.mentionIds.length };
    }),

  /**
   * Desvincula una mención de la campaña.
   */
  removeMention: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        mentionId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.campaignMention.deleteMany({
        where: {
          campaignId: input.campaignId,
          mentionId: input.mentionId,
        },
      });
      return { success: true };
    }),

  /**
   * Vincula menciones sociales a la campaña.
   */
  addSocialMentions: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        socialMentionIds: z.array(z.string()).min(1).max(200),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.campaignSocialMention.createMany({
        data: input.socialMentionIds.map((socialMentionId) => ({
          campaignId: input.campaignId,
          socialMentionId,
        })),
        skipDuplicates: true,
      });

      return { success: true, count: input.socialMentionIds.length };
    }),

  /**
   * Desvincula una mención social de la campaña.
   */
  removeSocialMention: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        socialMentionId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.campaignSocialMention.deleteMany({
        where: {
          campaignId: input.campaignId,
          socialMentionId: input.socialMentionId,
        },
      });
      return { success: true };
    }),

  /**
   * Auto-vincula menciones del cliente en el periodo de la campaña.
   */
  autoLinkMentions: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign || !campaign.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La campaña debe tener fecha de inicio para auto-vincular",
        });
      }

      const mentionDateFilter = {
        publishedAt: {
          gte: campaign.startDate,
          ...(campaign.endDate && { lte: campaign.endDate }),
        },
      };

      // Vincular menciones de medios del periodo
      const mentions = await prisma.mention.findMany({
        where: { clientId: campaign.clientId, ...mentionDateFilter },
        select: { id: true },
      });

      if (mentions.length > 0) {
        await prisma.campaignMention.createMany({
          data: mentions.map((m) => ({
            campaignId: input.campaignId,
            mentionId: m.id,
          })),
          skipDuplicates: true,
        });
      }

      // Vincular menciones sociales del periodo
      const socialDateFilter = {
        postedAt: {
          gte: campaign.startDate,
          ...(campaign.endDate && { lte: campaign.endDate }),
        },
      };
      const socialMentions = await prisma.socialMention.findMany({
        where: { clientId: campaign.clientId, ...socialDateFilter },
        select: { id: true },
      });

      if (socialMentions.length > 0) {
        await prisma.campaignSocialMention.createMany({
          data: socialMentions.map((sm) => ({
            campaignId: input.campaignId,
            socialMentionId: sm.id,
          })),
          skipDuplicates: true,
        });
      }

      return {
        success: true,
        linkedMentions: mentions.length,
        linkedSocialMentions: socialMentions.length,
      };
    }),

  /**
   * Obtiene estadísticas y métricas de impacto de la campaña.
   * Compara el periodo de la campaña vs un periodo equivalente antes.
   */
  getStats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaña no encontrada",
        });
      }

      // Menciones vinculadas con datos
      const linkedMentions = await prisma.campaignMention.findMany({
        where: { campaignId: input.id },
        include: {
          mention: {
            select: {
              id: true,
              sentiment: true,
              relevance: true,
              publishedAt: true,
              createdAt: true,
              article: { select: { source: true, title: true } },
            },
          },
        },
      });

      const linkedSocialMentions = await prisma.campaignSocialMention.findMany({
        where: { campaignId: input.id },
        include: {
          socialMention: {
            select: {
              id: true,
              sentiment: true,
              platform: true,
              likes: true,
              comments: true,
              shares: true,
              views: true,
              createdAt: true,
            },
          },
        },
      });

      // Sentiment breakdown de menciones media
      const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };
      for (const lm of linkedMentions) {
        const s = lm.mention.sentiment as keyof typeof sentimentCounts;
        if (sentimentCounts[s] !== undefined) sentimentCounts[s]++;
      }

      // Sentiment de menciones sociales
      const socialSentiment = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalViews = 0;

      for (const lsm of linkedSocialMentions) {
        const s = lsm.socialMention.sentiment as keyof typeof socialSentiment;
        if (socialSentiment[s] !== undefined) socialSentiment[s]++;
        totalLikes += lsm.socialMention.likes || 0;
        totalComments += lsm.socialMention.comments || 0;
        totalShares += lsm.socialMention.shares || 0;
        totalViews += lsm.socialMention.views || 0;
      }

      // Top fuentes (media)
      const sourceCounts: Record<string, number> = {};
      for (const lm of linkedMentions) {
        const src = lm.mention.article.source;
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      }
      const topSources = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([source, count]) => ({ source, count }));

      // Plataformas sociales
      const platformCounts: Record<string, number> = {};
      for (const lsm of linkedSocialMentions) {
        const p = lsm.socialMention.platform;
        platformCounts[p] = (platformCounts[p] || 0) + 1;
      }

      // Comparativa pre-campaña (si hay fechas)
      let preCampaignStats = null;
      if (campaign.startDate) {
        const campaignEnd = campaign.endDate || new Date();
        const durationMs =
          campaignEnd.getTime() - campaign.startDate.getTime();
        const preStart = new Date(campaign.startDate.getTime() - durationMs);
        const preEnd = campaign.startDate;

        const preMentions = await prisma.mention.count({
          where: {
            clientId: campaign.clientId,
            publishedAt: { gte: preStart, lt: preEnd },
          },
        });

        const preSocialMentions = await prisma.socialMention.count({
          where: {
            clientId: campaign.clientId,
            postedAt: { gte: preStart, lt: preEnd },
          },
        });

        const preNegative = await prisma.mention.count({
          where: {
            clientId: campaign.clientId,
            publishedAt: { gte: preStart, lt: preEnd },
            sentiment: "NEGATIVE",
          },
        });

        const prePositive = await prisma.mention.count({
          where: {
            clientId: campaign.clientId,
            publishedAt: { gte: preStart, lt: preEnd },
            sentiment: "POSITIVE",
          },
        });

        preCampaignStats = {
          mentions: preMentions,
          socialMentions: preSocialMentions,
          negative: preNegative,
          positive: prePositive,
          negativeRatio:
            preMentions > 0
              ? Math.round((preNegative / preMentions) * 100)
              : 0,
          positiveRatio:
            preMentions > 0
              ? Math.round((prePositive / preMentions) * 100)
              : 0,
        };
      }

      // Sentimiento por día (para gráfica de tendencia)
      const dailySentiment: Record<
        string,
        { date: string; positive: number; negative: number; neutral: number; total: number }
      > = {};

      for (const lm of linkedMentions) {
        const day = (lm.mention.publishedAt || lm.mention.createdAt).toISOString().split("T")[0];
        if (!dailySentiment[day]) {
          dailySentiment[day] = { date: day, positive: 0, negative: 0, neutral: 0, total: 0 };
        }
        dailySentiment[day].total++;
        if (lm.mention.sentiment === "POSITIVE") dailySentiment[day].positive++;
        else if (lm.mention.sentiment === "NEGATIVE") dailySentiment[day].negative++;
        else dailySentiment[day].neutral++;
      }

      const sentimentTimeline = Object.values(dailySentiment).sort(
        (a, b) => a.date.localeCompare(b.date)
      );

      const totalMentions = linkedMentions.length;
      const totalSocialMentions = linkedSocialMentions.length;

      return {
        totalMentions,
        totalSocialMentions,
        sentimentCounts,
        socialSentiment,
        engagement: {
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          views: totalViews,
        },
        topSources,
        platformCounts,
        preCampaignStats,
        sentimentTimeline,
        // Ratios actuales
        currentNegativeRatio:
          totalMentions > 0
            ? Math.round((sentimentCounts.NEGATIVE / totalMentions) * 100)
            : 0,
        currentPositiveRatio:
          totalMentions > 0
            ? Math.round((sentimentCounts.POSITIVE / totalMentions) * 100)
            : 0,
      };
    }),

  /**
   * Lista menciones vinculadas a la campaña (paginadas).
   */
  getMentions: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const items = await prisma.campaignMention.findMany({
        where: { campaignId: input.campaignId },
        include: {
          mention: {
            include: {
              article: { select: { title: true, source: true, url: true } },
            },
          },
        },
        orderBy: { assignedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop()!;
        nextCursor = next.id;
      }

      return { items, nextCursor };
    }),

  /**
   * Lista menciones sociales vinculadas a la campaña (paginadas).
   */
  getSocialMentions: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const items = await prisma.campaignSocialMention.findMany({
        where: { campaignId: input.campaignId },
        include: {
          socialMention: {
            select: {
              id: true,
              platform: true,
              postUrl: true,
              content: true,
              authorHandle: true,
              likes: true,
              comments: true,
              shares: true,
              sentiment: true,
              createdAt: true,
            },
          },
        },
        orderBy: { assignedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop()!;
        nextCursor = next.id;
      }

      return { items, nextCursor };
    }),
});
