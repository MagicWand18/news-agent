import { z } from "zod";
import { router, protectedProcedure, superAdminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  prisma,
  getAllSettings,
  setSettingValue,
  invalidateSettingsCache,
  seedDefaultSettings,
  DEFAULT_SETTINGS,
} from "@mediabot/shared";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN" && !ctx.user.isSuperAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo administradores pueden modificar configuraciones",
    });
  }
  return next({ ctx });
});

export const settingsRouter = router({
  // List all settings (any authenticated user can view)
  list: protectedProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      let settings = await getAllSettings(input?.category);

      // Auto-seed si no hay configuraciones
      if (settings.length === 0) {
        try {
          await seedDefaultSettings();
          settings = await getAllSettings(input?.category);
        } catch (e) {
          console.error("[Settings] auto-seed error:", e);
        }
      }

      // Group by category for better UI organization
      const grouped = settings.reduce(
        (acc, setting) => {
          const cat = setting.category || "general";
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(setting);
          return acc;
        },
        {} as Record<string, typeof settings>
      );

      return {
        settings,
        grouped,
        categories: Object.keys(grouped).sort(),
      };
    }),

  // Get a single setting by key
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const setting = await prisma.setting.findUnique({
        where: { key: input.key },
      });

      if (!setting) {
        // Return default if available
        const defaultSetting = DEFAULT_SETTINGS[input.key];
        if (defaultSetting) {
          return {
            key: input.key,
            value: defaultSetting.value,
            type: defaultSetting.type,
            category: defaultSetting.category,
            label: defaultSetting.label,
            description: defaultSetting.description,
            isDefault: true,
          };
        }
        return null;
      }

      return { ...setting, isDefault: false };
    }),

  // Update a setting (ADMIN only)
  update: adminProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { key, value } = input;

      // Validate the value based on type
      const existing = await prisma.setting.findUnique({ where: { key } });
      const defaultSetting = DEFAULT_SETTINGS[key];
      const type = existing?.type || defaultSetting?.type || "STRING";

      // Type validation
      if (type === "NUMBER") {
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El valor debe ser un numero valido`,
          });
        }
      } else if (type === "BOOLEAN") {
        if (value !== "true" && value !== "false") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El valor debe ser 'true' o 'false'`,
          });
        }
      } else if (type === "JSON") {
        try {
          JSON.parse(value);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El valor debe ser JSON valido`,
          });
        }
      }

      await setSettingValue(key, value, type);

      // Clear cache for this setting
      invalidateSettingsCache(key);

      return { success: true, key, value };
    }),

  // Reset a setting to default (ADMIN only)
  reset: adminProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      const defaultSetting = DEFAULT_SETTINGS[input.key];

      if (!defaultSetting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No hay valor por defecto para ${input.key}`,
        });
      }

      await setSettingValue(input.key, defaultSetting.value, defaultSetting.type);
      invalidateSettingsCache(input.key);

      return {
        success: true,
        key: input.key,
        value: defaultSetting.value,
      };
    }),

  // Seed all default settings (ADMIN only)
  seedDefaults: adminProcedure.mutation(async () => {
    await seedDefaultSettings();
    invalidateSettingsCache();
    return { success: true, message: "Configuraciones por defecto creadas" };
  }),

  // Get categories with their settings count
  categories: protectedProcedure.query(async () => {
    const settings = await getAllSettings();
    const categoryCounts = settings.reduce(
      (acc, s) => {
        const cat = s.category || "general";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Add default settings that might not be seeded yet
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      if (!settings.find((s) => s.key === key)) {
        categoryCounts[def.category] = (categoryCounts[def.category] || 0) + 1;
      }
    }

    return Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      count,
      label: getCategoryLabel(name),
    }));
  }),

  // ==================== TELEGRAM PREFS (SuperAdmin) ====================

  /**
   * Obtiene el telegramUserId y las preferencias de notificación del SuperAdmin actual.
   */
  getTelegramPrefs: superAdminProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        telegramUserId: true,
        telegramNotifPrefs: true,
      },
    });

    return {
      telegramUserId: user?.telegramUserId || null,
      preferences: (user?.telegramNotifPrefs as Record<string, boolean>) || null,
    };
  }),

  /**
   * Actualiza las preferencias de notificación Telegram del SuperAdmin actual.
   */
  updateTelegramPrefs: superAdminProcedure
    .input(
      z.object({
        preferences: z.record(z.string(), z.boolean()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          telegramNotifPrefs: JSON.parse(JSON.stringify(input.preferences)),
        },
        select: {
          id: true,
          telegramNotifPrefs: true,
        },
      });
    }),

  /**
   * Actualiza el ID de Telegram del SuperAdmin actual.
   */
  updateTelegramId: superAdminProcedure
    .input(
      z.object({
        telegramUserId: z.string().min(1, "El ID de Telegram es requerido"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verificar que no esté en uso por otro usuario
      const existing = await prisma.user.findFirst({
        where: {
          telegramUserId: input.telegramUserId,
          id: { not: ctx.user.id },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este ID de Telegram ya está vinculado a otro usuario",
        });
      }

      return prisma.user.update({
        where: { id: ctx.user.id },
        data: { telegramUserId: input.telegramUserId },
        select: {
          id: true,
          telegramUserId: true,
        },
      });
    }),
});

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    general: "General",
    analysis: "Analisis AI",
    notifications: "Notificaciones",
    ui: "Interfaz",
    crisis: "Deteccion de Crisis",
  };
  return labels[category] || category;
}
