import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";
import { generateCampaignPDF } from "@/lib/pdf/campaign-pdf";
import { generateBriefPDF } from "@/lib/pdf/brief-pdf";
import { generateClientPDF } from "@/lib/pdf/client-pdf";

const ReportTypeEnum = z.enum(["CAMPAIGN", "BRIEF", "CLIENT_SUMMARY"]);

export const reportsRouter = router({
  /**
   * Genera PDF de una campaña y retorna como base64 data URL.
   */
  generateCampaignPDF: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: {
          client: { select: { name: true } },
          notes: {
            include: { author: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaña no encontrada" });
      }

      // Obtener menciones vinculadas para stats
      const linkedMentions = await prisma.campaignMention.findMany({
        where: { campaignId: input.campaignId },
        include: {
          mention: {
            select: { sentiment: true, article: { select: { source: true } } },
          },
        },
      });

      const linkedSocial = await prisma.campaignSocialMention.findMany({
        where: { campaignId: input.campaignId },
        include: {
          socialMention: {
            select: { sentiment: true, likes: true, comments: true, shares: true, views: true },
          },
        },
      });

      // Calcular stats
      const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };
      const sourceCounts: Record<string, number> = {};
      for (const lm of linkedMentions) {
        const s = lm.mention.sentiment as keyof typeof sentimentCounts;
        if (sentimentCounts[s] !== undefined) sentimentCounts[s]++;
        const src = lm.mention.article.source;
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      }

      let totalLikes = 0, totalComments = 0, totalShares = 0, totalViews = 0;
      for (const lsm of linkedSocial) {
        totalLikes += lsm.socialMention.likes || 0;
        totalComments += lsm.socialMention.comments || 0;
        totalShares += lsm.socialMention.shares || 0;
        totalViews += lsm.socialMention.views || 0;
      }

      const topSources = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([source, count]) => ({ source, count }));

      const totalMentions = linkedMentions.length;
      const totalSocialMentions = linkedSocial.length;

      // Pre-campaign stats
      let preCampaignStats = null;
      if (campaign.startDate) {
        const campaignEnd = campaign.endDate || new Date();
        const durationMs = campaignEnd.getTime() - campaign.startDate.getTime();
        const preStart = new Date(campaign.startDate.getTime() - durationMs);
        const preEnd = campaign.startDate;

        const [preMentions, preSocial, prePositive, preNegative] = await Promise.all([
          prisma.mention.count({ where: { clientId: campaign.clientId, publishedAt: { gte: preStart, lt: preEnd } } }),
          prisma.socialMention.count({ where: { clientId: campaign.clientId, postedAt: { gte: preStart, lt: preEnd } } }),
          prisma.mention.count({ where: { clientId: campaign.clientId, publishedAt: { gte: preStart, lt: preEnd }, sentiment: "POSITIVE" } }),
          prisma.mention.count({ where: { clientId: campaign.clientId, publishedAt: { gte: preStart, lt: preEnd }, sentiment: "NEGATIVE" } }),
        ]);

        preCampaignStats = {
          mentions: preMentions,
          socialMentions: preSocial,
          positiveRatio: preMentions > 0 ? Math.round((prePositive / preMentions) * 100) : 0,
          negativeRatio: preMentions > 0 ? Math.round((preNegative / preMentions) * 100) : 0,
        };
      }

      const currentPositiveRatio = totalMentions > 0 ? Math.round((sentimentCounts.POSITIVE / totalMentions) * 100) : 0;
      const currentNegativeRatio = totalMentions > 0 ? Math.round((sentimentCounts.NEGATIVE / totalMentions) * 100) : 0;

      const pdfBuffer = await generateCampaignPDF({
        campaignName: campaign.name,
        clientName: campaign.client.name,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        description: campaign.description,
        totalMentions,
        totalSocialMentions,
        currentPositiveRatio,
        currentNegativeRatio,
        engagement: { likes: totalLikes, comments: totalComments, shares: totalShares, views: totalViews },
        preCampaignStats,
        topSources,
        notes: campaign.notes.map((n) => ({
          content: n.content,
          authorName: n.author.name,
          createdAt: n.createdAt,
        })),
      });

      const base64 = pdfBuffer.toString("base64");
      return { url: `data:application/pdf;base64,${base64}`, filename: `campana-${campaign.name.replace(/\s+/g, "-").toLowerCase()}.pdf` };
    }),

  /**
   * Genera PDF de un brief diario.
   */
  generateBriefPDF: protectedProcedure
    .input(z.object({ briefId: z.string() }))
    .mutation(async ({ input }) => {
      const brief = await prisma.dailyBrief.findUnique({
        where: { id: input.briefId },
        include: { client: { select: { name: true } } },
      });

      if (!brief) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brief no encontrado" });
      }

      const content = brief.content as {
        highlights: string[];
        comparison: { mentionsDelta: number; sentimentShift: string; sovChange: string };
        watchList: string[];
        emergingTopics: string[];
        pendingActions: string[];
      };

      const stats = brief.stats as {
        mentions: number;
        sentiment: { positive: number; negative: number; neutral: number; mixed: number };
        sov: number;
        socialPosts: number;
        engagement: number;
      };

      const pdfBuffer = await generateBriefPDF({
        clientName: brief.client.name,
        date: brief.date,
        content,
        stats,
      });

      const dateStr = new Date(brief.date).toISOString().split("T")[0];
      const base64 = pdfBuffer.toString("base64");
      return { url: `data:application/pdf;base64,${base64}`, filename: `brief-${brief.client.name.replace(/\s+/g, "-").toLowerCase()}-${dateStr}.pdf` };
    }),

  /**
   * Genera PDF resumen de un cliente.
   */
  generateClientPDF: protectedProcedure
    .input(z.object({ clientId: z.string(), days: z.number().min(1).max(365).default(30) }))
    .mutation(async ({ input }) => {
      const client = await prisma.client.findUnique({
        where: { id: input.clientId },
        select: { id: true, name: true, industry: true },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const [
        mentions,
        socialCount,
        sentimentGroups,
        topSourcesRaw,
        crises,
        campaigns,
      ] = await Promise.all([
        prisma.mention.count({ where: { clientId: input.clientId, publishedAt: { gte: since } } }),
        prisma.socialMention.count({ where: { clientId: input.clientId, postedAt: { gte: since } } }),
        prisma.mention.groupBy({
          by: ["sentiment"],
          where: { clientId: input.clientId, publishedAt: { gte: since } },
          _count: true,
        }),
        prisma.$queryRawUnsafe<{ source: string; count: number }[]>(
          `SELECT a.source, CAST(COUNT(*) AS INTEGER) as count
           FROM "Mention" m JOIN "Article" a ON m."articleId" = a.id
           WHERE m."clientId" = $1 AND COALESCE(m."publishedAt", m."createdAt") >= $2
           GROUP BY a.source ORDER BY count DESC LIMIT 10`,
          input.clientId,
          since
        ),
        prisma.crisisAlert.findMany({
          where: { clientId: input.clientId, createdAt: { gte: since } },
          select: { id: true, severity: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.campaign.findMany({
          where: { clientId: input.clientId, status: { in: ["ACTIVE", "DRAFT"] } },
          select: { name: true, status: true },
        }),
      ]);

      // Mentions by week
      const mentionsByWeek = await prisma.$queryRawUnsafe<{ week: string; count: number }[]>(
        `SELECT CAST(DATE_TRUNC('week', COALESCE("publishedAt", "createdAt")) AS TEXT) as week, CAST(COUNT(*) AS INTEGER) as count
         FROM "Mention" WHERE "clientId" = $1 AND COALESCE("publishedAt", "createdAt") >= $2
         GROUP BY DATE_TRUNC('week', COALESCE("publishedAt", "createdAt")) ORDER BY week ASC`,
        input.clientId,
        since
      );

      const sentimentBreakdown = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      for (const sg of sentimentGroups) {
        const key = sg.sentiment.toLowerCase() as keyof typeof sentimentBreakdown;
        if (key in sentimentBreakdown) sentimentBreakdown[key] = sg._count;
      }

      const totalSentiment = Object.values(sentimentBreakdown).reduce((a, b) => a + b, 0);
      const avgSentiment = totalSentiment > 0 ? Math.round((sentimentBreakdown.positive / totalSentiment) * 100) : 0;

      const pdfBuffer = await generateClientPDF({
        clientName: client.name,
        industry: client.industry,
        days: input.days,
        totalMentions: mentions,
        totalSocialMentions: socialCount,
        sentimentBreakdown,
        avgSentiment,
        topSources: topSourcesRaw.map((s) => ({ source: s.source, count: Number(s.count) })),
        mentionsByWeek: mentionsByWeek.map((w) => ({ week: String(w.week).split("T")[0], count: Number(w.count) })),
        crises,
        campaigns,
      });

      const base64 = pdfBuffer.toString("base64");
      return { url: `data:application/pdf;base64,${base64}`, filename: `resumen-${client.name.replace(/\s+/g, "-").toLowerCase()}.pdf` };
    }),

  /**
   * Crea un link compartido para un reporte.
   */
  createSharedLink: protectedProcedure
    .input(
      z.object({
        type: ReportTypeEnum,
        referenceId: z.string(),
        expiresInDays: z.number().min(1).max(30).default(7),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let clientId: string;
      let title: string;
      let data: unknown;

      switch (input.type) {
        case "CAMPAIGN": {
          const campaign = await prisma.campaign.findUnique({
            where: { id: input.referenceId },
            include: {
              client: { select: { id: true, name: true } },
              notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
              _count: { select: { mentions: true, socialMentions: true } },
            },
          });
          if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
          clientId = campaign.clientId;
          title = `Campaña: ${campaign.name}`;
          data = { campaign, type: "CAMPAIGN" };
          break;
        }
        case "BRIEF": {
          const brief = await prisma.dailyBrief.findUnique({
            where: { id: input.referenceId },
            include: { client: { select: { id: true, name: true } } },
          });
          if (!brief) throw new TRPCError({ code: "NOT_FOUND" });
          clientId = brief.clientId;
          title = `Brief: ${brief.client.name} — ${new Date(brief.date).toLocaleDateString("es-ES")}`;
          data = { brief, type: "BRIEF" };
          break;
        }
        case "CLIENT_SUMMARY": {
          const client = await prisma.client.findUnique({
            where: { id: input.referenceId },
            select: { id: true, name: true, industry: true },
          });
          if (!client) throw new TRPCError({ code: "NOT_FOUND" });
          clientId = client.id;
          title = `Resumen: ${client.name}`;

          // Snapshot de datos del último mes
          const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const [mentionCount, socialCount, sentimentGroups] = await Promise.all([
            prisma.mention.count({ where: { clientId: client.id, publishedAt: { gte: since } } }),
            prisma.socialMention.count({ where: { clientId: client.id, postedAt: { gte: since } } }),
            prisma.mention.groupBy({
              by: ["sentiment"],
              where: { clientId: client.id, publishedAt: { gte: since } },
              _count: true,
            }),
          ]);

          data = {
            client,
            type: "CLIENT_SUMMARY",
            stats: {
              mentionCount,
              socialCount,
              sentiment: Object.fromEntries(sentimentGroups.map((s) => [s.sentiment, s._count])),
            },
          };
          break;
        }
      }

      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

      const report = await prisma.sharedReport.create({
        data: {
          clientId,
          type: input.type,
          title,
          data: JSON.parse(JSON.stringify(data)),
          createdBy: ctx.user.id,
          expiresAt,
        },
      });

      return {
        publicId: report.publicId,
        url: `/shared/${report.publicId}`,
        expiresAt: report.expiresAt,
      };
    }),

  /**
   * Obtiene un reporte compartido público (sin auth).
   */
  getSharedReport: publicProcedure
    .input(z.object({ publicId: z.string() }))
    .query(async ({ input }) => {
      const report = await prisma.sharedReport.findUnique({
        where: { publicId: input.publicId },
        include: {
          client: { select: { name: true } },
        },
      });

      if (!report) {
        return { error: "not_found" as const, report: null };
      }

      if (report.expiresAt < new Date()) {
        return { error: "expired" as const, report: null };
      }

      return { error: null, report };
    }),
});
