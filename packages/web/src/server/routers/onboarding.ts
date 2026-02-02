import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";

const OnboardingStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"]);

export const onboardingRouter = router({
  /**
   * Obtiene el estado actual del onboarding del usuario
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        onboardingStatus: true,
        onboardingCompletedAt: true,
      },
    });

    return {
      status: user?.onboardingStatus ?? "PENDING",
      completedAt: user?.onboardingCompletedAt ?? null,
    };
  }),

  /**
   * Actualiza el estado del onboarding del usuario
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        status: OnboardingStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: {
        onboardingStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
        onboardingCompletedAt?: Date | null;
      } = {
        onboardingStatus: input.status,
      };

      // Marcar fecha de completado si corresponde
      if (input.status === "COMPLETED") {
        updateData.onboardingCompletedAt = new Date();
      } else if (input.status === "PENDING") {
        updateData.onboardingCompletedAt = null;
      }

      const user = await prisma.user.update({
        where: { id: ctx.user.id },
        data: updateData,
        select: {
          onboardingStatus: true,
          onboardingCompletedAt: true,
        },
      });

      return {
        status: user.onboardingStatus,
        completedAt: user.onboardingCompletedAt,
      };
    }),

  /**
   * Reinicia el onboarding del usuario para repetir el tour
   */
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await prisma.user.update({
      where: { id: ctx.user.id },
      data: {
        onboardingStatus: "PENDING",
        onboardingCompletedAt: null,
      },
      select: {
        onboardingStatus: true,
        onboardingCompletedAt: true,
      },
    });

    return {
      status: user.onboardingStatus,
      completedAt: user.onboardingCompletedAt,
    };
  }),

  /**
   * Reactiva el tutorial para otro usuario (solo superadmin)
   */
  resetForUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar que el usuario actual es superadmin
      const currentUser = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { isSuperAdmin: true },
      });

      if (!currentUser?.isSuperAdmin) {
        throw new Error("Solo los super administradores pueden reactivar el tutorial de otros usuarios");
      }

      const user = await prisma.user.update({
        where: { id: input.userId },
        data: {
          onboardingStatus: "PENDING",
          onboardingCompletedAt: null,
        },
        select: {
          id: true,
          name: true,
          onboardingStatus: true,
        },
      });

      return {
        userId: user.id,
        userName: user.name,
        status: user.onboardingStatus,
      };
    }),
});
