import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";

export const tasksRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
        assigneeId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.task.findMany({
        where: {
          client: { orgId: ctx.user.orgId },
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.status && { status: input.status }),
          ...(input.assigneeId && { assigneeId: input.assigneeId }),
        },
        include: {
          client: { select: { name: true } },
          assignee: { select: { name: true } },
          mention: {
            select: { article: { select: { title: true } } },
          },
        },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
        clientId: z.string().optional(),
        assigneeId: z.string().optional(),
        deadline: z.date().optional(),
        mentionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify client belongs to user's org if provided
      if (input.clientId) {
        const client = await prisma.client.findFirst({
          where: { id: input.clientId, orgId: ctx.user.orgId },
        });
        if (!client) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
        }
      }
      // Verify assignee belongs to user's org if provided
      if (input.assigneeId) {
        const assignee = await prisma.user.findFirst({
          where: { id: input.assigneeId, orgId: ctx.user.orgId },
        });
        if (!assignee) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Assignee not found" });
        }
      }
      return prisma.task.create({ data: input });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
        priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
        assigneeId: z.string().nullable().optional(),
        deadline: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      // Verify task belongs to user's org
      const task = await prisma.task.findFirst({
        where: { id, client: { orgId: ctx.user.orgId } },
      });
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      return prisma.task.update({
        where: { id },
        data: {
          ...data,
          ...(data.status === "COMPLETED" ? { completedAt: new Date() } : {}),
        },
      });
    }),
});
