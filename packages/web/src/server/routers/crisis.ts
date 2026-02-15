import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";

const CrisisStatusEnum = z.enum(["ACTIVE", "MONITORING", "RESOLVED", "DISMISSED"]);
const CrisisSeverityEnum = z.enum(["CRITICAL", "HIGH", "MEDIUM"]);

export const crisisRouter = router({
  /**
   * Lista alertas de crisis con filtros.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: CrisisStatusEnum.optional(),
        severity: CrisisSeverityEnum.optional(),
        clientId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};

      const crises = await prisma.crisisAlert.findMany({
        where: {
          ...clientOrgFilter,
          ...(input.status && { status: input.status }),
          ...(input.severity && { severity: input.severity }),
          ...(input.clientId && { clientId: input.clientId }),
        },
        include: {
          client: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { crisisNotes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (crises.length > input.limit) {
        const next = crises.pop();
        nextCursor = next!.id;
      }

      return { crises, nextCursor };
    }),

  /**
   * Obtiene una crisis por ID con todas las relaciones.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };
      const crisis = await prisma.crisisAlert.findFirst({
        where: { id: input.id, ...orgFilter },
        include: {
          client: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          crisisNotes: {
            include: {
              user: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!crisis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Crisis no encontrada" });
      }

      // Buscar menciones negativas del cliente alrededor del momento de la crisis
      const timeWindow = 24 * 60 * 60 * 1000; // 24 horas
      const relatedMentions = await prisma.mention.findMany({
        where: {
          clientId: crisis.clientId,
          sentiment: "NEGATIVE",
          createdAt: {
            gte: new Date(crisis.createdAt.getTime() - timeWindow),
            lte: new Date(crisis.createdAt.getTime() + timeWindow),
          },
        },
        include: {
          article: { select: { title: true, source: true, url: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return { ...crisis, relatedMentions };
    }),

  /**
   * Actualiza el estado de una crisis. Solo ADMIN/SUPERVISOR.
   * Crea automáticamente una CrisisNote con el cambio de estado.
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: CrisisStatusEnum,
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "ADMIN" && ctx.user.role !== "SUPERVISOR" && !ctx.user.isSuperAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo ADMIN o SUPERVISOR pueden cambiar el estado de una crisis",
        });
      }

      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };
      const crisis = await prisma.crisisAlert.findFirst({
        where: { id: input.id, ...orgFilter },
      });

      if (!crisis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Crisis no encontrada" });
      }

      const oldStatus = crisis.status;

      const [updatedCrisis] = await prisma.$transaction([
        prisma.crisisAlert.update({
          where: { id: input.id },
          data: {
            status: input.status,
            ...(input.status === "RESOLVED" && {
              resolvedAt: new Date(),
              resolvedBy: ctx.user.id,
            }),
          },
        }),
        // Registrar el cambio de estado como nota
        prisma.crisisNote.create({
          data: {
            crisisAlertId: input.id,
            userId: ctx.user.id,
            content: `Estado cambiado de ${oldStatus} a ${input.status}`,
            type: "STATUS_CHANGE",
          },
        }),
      ]);

      return updatedCrisis;
    }),

  /**
   * Agrega una nota a una crisis.
   */
  addNote: protectedProcedure
    .input(
      z.object({
        crisisAlertId: z.string(),
        content: z.string().min(1),
        type: z.enum(["NOTE", "ACTION", "STATUS_CHANGE"]).default("NOTE"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };
      const crisis = await prisma.crisisAlert.findFirst({
        where: { id: input.crisisAlertId, ...orgFilter },
      });

      if (!crisis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Crisis no encontrada" });
      }

      return prisma.crisisNote.create({
        data: {
          crisisAlertId: input.crisisAlertId,
          userId: ctx.user.id,
          content: input.content,
          type: input.type,
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });
    }),

  /**
   * Asigna un responsable a una crisis. Solo ADMIN/SUPERVISOR.
   */
  assignResponsible: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        assignedToId: z.string().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "ADMIN" && ctx.user.role !== "SUPERVISOR" && !ctx.user.isSuperAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo ADMIN o SUPERVISOR pueden asignar responsables",
        });
      }

      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };
      const crisis = await prisma.crisisAlert.findFirst({
        where: { id: input.id, ...orgFilter },
      });

      if (!crisis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Crisis no encontrada" });
      }

      // Validar que el usuario asignado existe
      if (input.assignedToId) {
        const assignee = await prisma.user.findFirst({
          where: { id: input.assignedToId },
        });
        if (!assignee) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
        }
      }

      return prisma.crisisAlert.update({
        where: { id: input.id },
        data: { assignedToId: input.assignedToId },
        include: {
          assignedTo: { select: { id: true, name: true } },
        },
      });
    }),

  /**
   * Cuenta las crisis activas (para badge en sidebar).
   */
  getActiveCrisisCount: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input?.orgId);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};

      const count = await prisma.crisisAlert.count({
        where: {
          ...clientOrgFilter,
          status: { in: ["ACTIVE", "MONITORING"] },
        },
      });

      return { count };
    }),
});
