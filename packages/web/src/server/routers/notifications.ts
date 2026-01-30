import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";

export const notificationsRouter = router({
  /**
   * Lista notificaciones paginadas con filtros
   */
  list: protectedProcedure
    .input(
      z.object({
        type: z
          .enum([
            "MENTION_CRITICAL",
            "MENTION_HIGH",
            "CRISIS_ALERT",
            "WEEKLY_REPORT",
            "EMERGING_TOPIC",
            "SYSTEM",
          ])
          .optional(),
        read: z.boolean().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, type, read } = input;

      const notifications = await prisma.notification.findMany({
        where: {
          userId: ctx.user.id,
          ...(type && { type }),
          ...(read !== undefined && { read }),
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (notifications.length > limit) {
        const next = notifications.pop();
        nextCursor = next!.id;
      }

      return { notifications, nextCursor };
    }),

  /**
   * Obtiene el conteo de notificaciones no leídas
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.notification.count({
      where: {
        userId: ctx.user.id,
        read: false,
      },
    });

    return { count };
  }),

  /**
   * Marca una notificación como leída
   */
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const notification = await prisma.notification.updateMany({
        where: {
          id: input.id,
          userId: ctx.user.id,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return { success: notification.count > 0 };
    }),

  /**
   * Marca todas las notificaciones como leídas
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await prisma.notification.updateMany({
      where: {
        userId: ctx.user.id,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }),

  /**
   * Obtiene una notificación por ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.notification.findFirst({
        where: {
          id: input.id,
          userId: ctx.user.id,
        },
      });
    }),

  /**
   * Elimina una notificación
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await prisma.notification.deleteMany({
        where: {
          id: input.id,
          userId: ctx.user.id,
        },
      });

      return { success: result.count > 0 };
    }),

  /**
   * Elimina todas las notificaciones leídas
   */
  deleteAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await prisma.notification.deleteMany({
      where: {
        userId: ctx.user.id,
        read: true,
      },
    });

    return { count: result.count };
  }),
});
