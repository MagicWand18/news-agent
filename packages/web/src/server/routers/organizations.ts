import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, superAdminProcedure } from "../trpc";
import { prisma } from "@mediabot/shared";
import bcrypt from "bcryptjs";

/**
 * Router para gestión de organizaciones (agencias).
 * Todos los endpoints requieren Super Admin.
 */
export const organizationsRouter = router({
  /**
   * Lista todas las organizaciones con conteos
   */
  list: superAdminProcedure.query(async () => {
    return prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        maxClients: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            clients: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  /**
   * Obtiene detalle de una organización con usuarios y clientes
   */
  getById: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const org = await prisma.organization.findUnique({
        where: { id: input.id },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isSuperAdmin: true,
              createdAt: true,
            },
            orderBy: { name: "asc" },
          },
          clients: {
            select: {
              id: true,
              name: true,
              active: true,
              createdAt: true,
              _count: {
                select: {
                  mentions: true,
                  keywords: true,
                },
              },
            },
            orderBy: { name: "asc" },
          },
        },
      });

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización no encontrada",
        });
      }

      return org;
    }),

  /**
   * Crea una nueva organización
   */
  create: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(1, "El nombre es requerido"),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.organization.create({
        data: {
          name: input.name,
        },
      });
    }),

  /**
   * Actualiza una organización existente
   */
  update: superAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "El nombre es requerido"),
        maxClients: z.number().int().min(0).nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, name, maxClients } = input;

      const org = await prisma.organization.findUnique({ where: { id } });
      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización no encontrada",
        });
      }

      return prisma.organization.update({
        where: { id },
        data: {
          name,
          ...(maxClients !== undefined && { maxClients }),
        },
      });
    }),

  /**
   * Elimina una organización (solo si está vacía)
   */
  delete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const org = await prisma.organization.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              users: true,
              clients: true,
            },
          },
        },
      });

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización no encontrada",
        });
      }

      if (org._count.users > 0 || org._count.clients > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No se puede eliminar: tiene ${org._count.users} usuario(s) y ${org._count.clients} cliente(s)`,
        });
      }

      return prisma.organization.delete({ where: { id: input.id } });
    }),

  /**
   * Estadísticas globales para el Super Admin
   */
  globalStats: superAdminProcedure.query(async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [
      orgCount,
      userCount,
      clientCount,
      mentionsToday,
      mentionsWeek,
      activeCrises,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.client.count({ where: { active: true } }),
      prisma.mention.count({
        where: { publishedAt: { gte: startOfToday } },
      }),
      prisma.mention.count({
        where: { publishedAt: { gte: startOfWeek } },
      }),
      prisma.crisisAlert.count({
        where: { status: "ACTIVE" },
      }),
    ]);

    return {
      organizations: orgCount,
      users: userCount,
      activeClients: clientCount,
      mentionsToday,
      mentionsWeek,
      activeCrises,
    };
  }),

  /**
   * Reasigna un cliente a otra organización
   */
  reassignClient: superAdminProcedure
    .input(
      z.object({
        clientId: z.string(),
        targetOrgId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { clientId, targetOrgId } = input;

      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, orgId: true },
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente no encontrado",
        });
      }

      // Verificar que la organización destino existe
      const targetOrg = await prisma.organization.findUnique({
        where: { id: targetOrgId },
      });

      if (!targetOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización destino no encontrada",
        });
      }

      // No hacer nada si ya está en esa organización
      if (client.orgId === targetOrgId) {
        return client;
      }

      return prisma.client.update({
        where: { id: clientId },
        data: { orgId: targetOrgId },
      });
    }),

  /**
   * Crea un usuario en cualquier organización
   */
  createUserInOrg: superAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        name: z.string().min(1, "El nombre es requerido"),
        email: z.string().email("Email inválido"),
        password: z
          .string()
          .min(8, "Mínimo 8 caracteres")
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
            "Debe contener mayúscula, minúscula y número"
          ),
        role: z.enum(["ADMIN", "SUPERVISOR", "ANALYST"]).default("ANALYST"),
        isSuperAdmin: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const { orgId, name, email, password, role, isSuperAdmin } = input;

      // Verificar que la organización existe
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organización no encontrada",
        });
      }

      // Verificar que el email no existe
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya existe un usuario con ese email",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      return prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          orgId,
          isSuperAdmin,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuperAdmin: true,
          createdAt: true,
        },
      });
    }),

  /**
   * Lista de organizaciones para selector (versión ligera)
   */
  listForSelector: superAdminProcedure.query(async () => {
    return prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });
  }),

  // ==================== ORG TELEGRAM RECIPIENTS ====================

  /**
   * Lista destinatarios Telegram de una organización.
   */
  listOrgTelegramRecipients: superAdminProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ input }) => {
      return prisma.orgTelegramRecipient.findMany({
        where: { orgId: input.orgId },
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * Agrega un destinatario Telegram a la organización.
   * preferences null = todo ON (comportamiento por defecto).
   */
  addOrgTelegramRecipient: superAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        chatId: z.string().min(1, "El Chat ID es requerido"),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Verificar que la org existe
      const org = await prisma.organization.findUnique({
        where: { id: input.orgId },
      });
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organización no encontrada" });
      }

      return prisma.orgTelegramRecipient.upsert({
        where: {
          orgId_chatId: { orgId: input.orgId, chatId: input.chatId },
        },
        update: {
          label: input.label,
          active: true,
        },
        create: {
          orgId: input.orgId,
          chatId: input.chatId,
          label: input.label,
        },
      });
    }),

  /**
   * Actualiza las preferencias de notificación de un destinatario org.
   */
  updateOrgRecipientPreferences: superAdminProcedure
    .input(
      z.object({
        id: z.string(),
        preferences: z.record(z.string(), z.boolean()),
      })
    )
    .mutation(async ({ input }) => {
      const recipient = await prisma.orgTelegramRecipient.findUnique({
        where: { id: input.id },
      });
      if (!recipient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Destinatario no encontrado" });
      }

      return prisma.orgTelegramRecipient.update({
        where: { id: input.id },
        data: {
          preferences: JSON.parse(JSON.stringify(input.preferences)),
        },
      });
    }),

  /**
   * Desactiva un destinatario Telegram de la organización.
   */
  removeOrgTelegramRecipient: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const recipient = await prisma.orgTelegramRecipient.findUnique({
        where: { id: input.id },
      });
      if (!recipient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Destinatario no encontrado" });
      }

      return prisma.orgTelegramRecipient.update({
        where: { id: input.id },
        data: { active: false },
      });
    }),
});
