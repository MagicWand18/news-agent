import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma } from "@mediabot/shared";

const AlertRuleTypeEnum = z.enum([
  "NEGATIVE_SPIKE",
  "SOV_DROP",
  "VOLUME_SURGE",
  "COMPETITOR_SPIKE",
  "SENTIMENT_SHIFT",
  "NO_MENTIONS",
]);

export const alertRulesRouter = router({
  /**
   * Lista reglas de alerta con filtro por cliente.
   */
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        active: z.boolean().optional(),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);

      const rules = await prisma.alertRule.findMany({
        where: {
          ...(orgId && { client: { orgId } }),
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.active !== undefined && { active: input.active }),
        },
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return rules;
    }),

  /**
   * Obtiene una regla por ID.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };

      const rule = await prisma.alertRule.findFirst({
        where: { id: input.id, ...orgFilter },
        include: { client: { select: { id: true, name: true } } },
      });

      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      }

      return rule;
    }),

  /**
   * Crea una nueva regla de alerta.
   */
  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        name: z.string().min(1).max(200),
        type: AlertRuleTypeEnum,
        condition: z.record(z.number()),
        channels: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verificar acceso al cliente
      const clientWhere = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({ where: clientWhere });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      return prisma.alertRule.create({
        data: {
          clientId: input.clientId,
          name: input.name,
          type: input.type,
          condition: input.condition,
          channels: input.channels,
        },
        include: { client: { select: { id: true, name: true } } },
      });
    }),

  /**
   * Actualiza una regla de alerta.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        type: AlertRuleTypeEnum.optional(),
        condition: z.record(z.number()).optional(),
        channels: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };

      const rule = await prisma.alertRule.findFirst({
        where: { id, ...orgFilter },
      });

      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      }

      return prisma.alertRule.update({
        where: { id },
        data,
        include: { client: { select: { id: true, name: true } } },
      });
    }),

  /**
   * Elimina una regla de alerta.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };

      const rule = await prisma.alertRule.findFirst({
        where: { id: input.id, ...orgFilter },
      });

      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      }

      await prisma.alertRule.delete({ where: { id: input.id } });

      return { success: true };
    }),

  /**
   * Activa/desactiva una regla de alerta.
   */
  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const orgFilter = ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } };

      const rule = await prisma.alertRule.findFirst({
        where: { id: input.id, ...orgFilter },
      });

      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Regla no encontrada" });
      }

      return prisma.alertRule.update({
        where: { id: input.id },
        data: { active: !rule.active },
        include: { client: { select: { id: true, name: true } } },
      });
    }),
});
