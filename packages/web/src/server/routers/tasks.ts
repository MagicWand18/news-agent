import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";

export const tasksRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
        priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
        assigneeId: z.string().optional(),
        orgId: z.string().optional(), // Super Admin puede especificar org
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};

      return prisma.task.findMany({
        where: {
          ...clientOrgFilter,
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.status && { status: input.status }),
          ...(input.priority && { priority: input.priority }),
          ...(input.assigneeId && { assigneeId: input.assigneeId }),
        },
        include: {
          client: { select: { name: true, org: ctx.user.isSuperAdmin ? { select: { name: true } } : false } },
          assignee: { select: { name: true } },
          mention: {
            select: { article: { select: { title: true } } },
          },
          socialMention: {
            select: { platform: true, authorHandle: true, postUrl: true },
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
        socialMentionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Super Admin puede crear tareas para cualquier cliente/usuario
      if (input.clientId && !ctx.user.isSuperAdmin) {
        const client = await prisma.client.findFirst({
          where: { id: input.clientId, orgId: ctx.user.orgId! },
        });
        if (!client) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
        }
      }
      if (input.assigneeId && !ctx.user.isSuperAdmin) {
        const assignee = await prisma.user.findFirst({
          where: { id: input.assigneeId, orgId: ctx.user.orgId! },
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
      // Super Admin puede actualizar cualquier tarea
      const whereClause = ctx.user.isSuperAdmin
        ? { id }
        : { id, client: { orgId: ctx.user.orgId! } };
      const task = await prisma.task.findFirst({ where: whereClause });
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
