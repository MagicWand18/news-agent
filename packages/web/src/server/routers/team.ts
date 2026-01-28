import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";
import bcrypt from "bcryptjs";

export const teamRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.user.findMany({
      where: { orgId: ctx.user.orgId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        telegramUserId: true,
        createdAt: true,
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const passwordHash = await bcrypt.hash(input.password, 12);
      return prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
          telegramUserId: input.telegramUserId || null,
          orgId: ctx.user.orgId,
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
      // Verify user belongs to same org
      const user = await prisma.user.findFirst({
        where: { id, orgId: ctx.user.orgId },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      return prisma.user.update({ where: { id }, data });
    }),
});
