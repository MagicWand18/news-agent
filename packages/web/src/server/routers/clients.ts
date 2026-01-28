import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";

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
});
