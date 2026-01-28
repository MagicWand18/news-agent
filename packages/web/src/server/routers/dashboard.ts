import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";

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
});
