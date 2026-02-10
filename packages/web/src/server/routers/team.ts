import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";
import bcrypt from "bcryptjs";

export const teamRouter = router({
  list: protectedProcedure
    .input(z.object({ orgId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = getEffectiveOrgId(ctx.user, input?.orgId);
      const orgFilter = orgId ? { orgId } : {};

      return prisma.user.findMany({
        where: orgFilter,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuperAdmin: true,
          telegramUserId: true,
          createdAt: true,
          org: ctx.user.isSuperAdmin ? { select: { id: true, name: true } } : false,
          _count: {
            select: {
              assignedTasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8).regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
          "Password must contain at least one uppercase letter, one lowercase letter, and one digit"
        ),
        role: z.enum(["ADMIN", "SUPERVISOR", "ANALYST"]).default("ANALYST"),
        telegramUserId: z.string().optional(),
        orgId: z.string().optional(), // Super Admin puede especificar org
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Determinar orgId: Super Admin puede especificar, usuario normal usa el suyo
      const targetOrgId = getEffectiveOrgId(ctx.user, input.orgId) || ctx.user.orgId;
      if (!targetOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debe especificar una organización",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      return prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
          telegramUserId: input.telegramUserId || null,
          orgId: targetOrgId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        role: z.enum(["ADMIN", "SUPERVISOR", "ANALYST"]).optional(),
        telegramUserId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      // Super Admin puede actualizar cualquier usuario
      const whereClause = ctx.user.isSuperAdmin
        ? { id }
        : { id, orgId: ctx.user.orgId! };
      const user = await prisma.user.findFirst({ where: whereClause });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      return prisma.user.update({ where: { id }, data });
    }),
});
