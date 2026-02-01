/**
 * Router tRPC para monitoreo de redes sociales.
 *
 * Endpoints:
 * - suggestHashtags: Sugerir hashtags con IA
 * - validateHandle: Validar que un handle existe en una plataforma
 * - getSocialMentions: Listar menciones sociales de un cliente
 * - getSocialAccounts: Listar cuentas monitoreadas de un cliente
 * - addSocialAccount: Agregar cuenta a monitorear
 * - removeSocialAccount: Remover cuenta monitoreada
 * - updateSocialConfig: Actualizar configuración social del cliente
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { prisma, getEnsembleDataClient } from "@mediabot/shared";

const SocialPlatformEnum = z.enum(["TWITTER", "INSTAGRAM", "TIKTOK"]);

export const socialRouter = router({
  /**
   * Sugiere hashtags y cuentas basados en el cliente.
   * Usa IA para generar sugerencias relevantes.
   */
  suggestHashtags: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        description: z.string().optional(),
        industry: z.string().optional(),
        existingKeywords: z.array(z.string()).optional(),
        competitors: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Llamar a Gemini para generar sugerencias
      const { getGeminiModel, cleanJsonResponse } = await import("@mediabot/shared");

      const keywordsContext = input.existingKeywords?.length
        ? `\n\nKeywords de monitoreo actuales:\n${input.existingKeywords.slice(0, 15).join(", ")}`
        : "";

      const competitorsContext = input.competitors?.length
        ? `\n\nCOMPETIDORES YA IDENTIFICADOS (USAR ESTOS, no inventar otros):\n${input.competitors.join(", ")}`
        : "";

      const model = getGeminiModel();

      const prompt = `Eres un experto en marketing digital y monitoreo de redes sociales en Mexico y Latinoamerica.

CLIENTE:
Nombre: ${input.clientName}
Descripcion: ${input.description || "No proporcionada"}
Industria: ${input.industry || "No especificada"}${keywordsContext}${competitorsContext}

Genera hashtags y cuentas de redes sociales relevantes para monitorear a este cliente.

REGLAS IMPORTANTES:
- Los hashtags deben ser populares y relevantes en Mexico/Latam
- Incluir hashtags genericos de la industria y especificos del cliente
- Para cuentas sugeridas: PRIORIZA los competidores ya identificados arriba
- Solo sugiere cuentas de personas/empresas VERIFICADAS y conocidas
- NO inventes handles de Twitter - deben ser cuentas reales y relevantes
- Incluir medios de comunicacion locales y nacionales relevantes
- Considerar Twitter/X, Instagram y TikTok
- No incluir el simbolo # en los hashtags
- No incluir el simbolo @ en los handles

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "hashtags": [
    {"hashtag": "nombreSinHashtag", "platform": "ALL", "confidence": 0.85, "reason": "Por que es relevante"}
  ],
  "suggestedAccounts": [
    {"platform": "TWITTER", "handle": "username_sin_arroba", "reason": "Por que monitorear esta cuenta"}
  ]
}

Plataformas validas para hashtags: TWITTER, INSTAGRAM, TIKTOK, ALL
Plataformas validas para cuentas: TWITTER, INSTAGRAM, TIKTOK

Genera:
- 8-15 hashtags variados (mezcla de genericos e industria)
- 3-6 cuentas sugeridas (basadas en competidores identificados y medios relevantes)`;

      try {
        const genResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
        });

        const rawText = genResult.response.text();
        const jsonText = cleanJsonResponse(rawText);
        const result = JSON.parse(jsonText);

        // Validar y limpiar resultado
        const validPlatforms = ["TWITTER", "INSTAGRAM", "TIKTOK", "ALL"];
        const validAccountPlatforms = ["TWITTER", "INSTAGRAM", "TIKTOK"];

        result.hashtags = (result.hashtags || []).map((h: { hashtag: string; platform: string; confidence: number; reason: string }) => ({
          ...h,
          hashtag: h.hashtag.replace(/^#/, ""),
          platform: validPlatforms.includes(h.platform) ? h.platform : "ALL",
          confidence: Math.max(0.5, Math.min(1, h.confidence || 0.7)),
        }));

        result.suggestedAccounts = (result.suggestedAccounts || []).map((a: { platform: string; handle: string; reason: string }) => ({
          ...a,
          handle: a.handle.replace(/^@/, ""),
          platform: validAccountPlatforms.includes(a.platform) ? a.platform : "TWITTER",
        }));

        return result;
      } catch (error) {
        console.error("[Social] Parse error:", error);
        return {
          hashtags: [
            {
              hashtag: input.clientName.replace(/\s+/g, ""),
              platform: "ALL",
              confidence: 0.8,
              reason: "Nombre del cliente",
            },
          ],
          suggestedAccounts: [],
        };
      }
    }),

  /**
   * Valida que un handle existe en una plataforma.
   */
  validateHandle: protectedProcedure
    .input(
      z.object({
        platform: SocialPlatformEnum,
        handle: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const client = getEnsembleDataClient();

      if (!client.isConfigured()) {
        // Si no está configurado, asumir válido (se validará en colección)
        return { valid: true, platformUserId: undefined, warning: "API no configurada, no se pudo validar" };
      }

      const result = await client.validateHandle(input.platform, input.handle);

      return {
        valid: result.valid,
        platformUserId: result.platformUserId,
        error: result.error,
      };
    }),

  /**
   * Lista todas las menciones sociales con filtros.
   * Para el dashboard global de redes sociales.
   */
  listAllSocialMentions: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        platform: SocialPlatformEnum.optional(),
        sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]).optional(),
        sourceType: z.enum(["HANDLE", "HASHTAG", "KEYWORD"]).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const mentions = await prisma.socialMention.findMany({
        where: {
          client: { orgId: ctx.user.orgId },
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.platform && { platform: input.platform }),
          ...(input.sentiment && { sentiment: input.sentiment }),
          ...(input.sourceType && { sourceType: input.sourceType }),
          ...(input.dateFrom && { createdAt: { gte: input.dateFrom } }),
          ...(input.dateTo && { createdAt: { lte: input.dateTo } }),
          ...(input.cursor && { id: { lt: input.cursor } }),
        },
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
      });

      const hasMore = mentions.length > input.limit;
      const items = hasMore ? mentions.slice(0, -1) : mentions;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        mentions: items,
        nextCursor,
        hasMore,
      };
    }),

  /**
   * Obtiene estadísticas globales de menciones sociales.
   */
  getGlobalSocialStats: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        days: z.number().min(1).max(90).default(7),
      })
    )
    .query(async ({ input, ctx }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const [total, byPlatform, bySentiment, bySourceType] = await Promise.all([
        prisma.socialMention.count({
          where: {
            client: { orgId: ctx.user.orgId },
            ...(input.clientId && { clientId: input.clientId }),
            createdAt: { gte: since },
          },
        }),
        prisma.socialMention.groupBy({
          by: ["platform"],
          where: {
            client: { orgId: ctx.user.orgId },
            ...(input.clientId && { clientId: input.clientId }),
            createdAt: { gte: since },
          },
          _count: { id: true },
        }),
        prisma.socialMention.groupBy({
          by: ["sentiment"],
          where: {
            client: { orgId: ctx.user.orgId },
            ...(input.clientId && { clientId: input.clientId }),
            createdAt: { gte: since },
          },
          _count: { id: true },
        }),
        prisma.socialMention.groupBy({
          by: ["sourceType"],
          where: {
            client: { orgId: ctx.user.orgId },
            ...(input.clientId && { clientId: input.clientId }),
            createdAt: { gte: since },
          },
          _count: { id: true },
        }),
      ]);

      return {
        total,
        byPlatform: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count.id])),
        bySentiment: Object.fromEntries(bySentiment.map((s) => [s.sentiment || "UNKNOWN", s._count.id])),
        bySourceType: Object.fromEntries(bySourceType.map((s) => [s.sourceType, s._count.id])),
      };
    }),

  /**
   * Obtiene una mención social por ID.
   */
  getSocialMentionById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const mention = await prisma.socialMention.findFirst({
        where: {
          id: input.id,
          client: { orgId: ctx.user.orgId },
        },
        include: {
          client: { select: { id: true, name: true } },
        },
      });

      return mention;
    }),

  /**
   * Obtiene las menciones sociales de un cliente.
   */
  getSocialMentions: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        platform: SocialPlatformEnum.optional(),
        sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]).optional(),
        days: z.number().min(1).max(90).default(7),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verificar que el cliente pertenece a la organización
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        select: { id: true },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const mentions = await prisma.socialMention.findMany({
        where: {
          clientId: input.clientId,
          createdAt: { gte: since },
          ...(input.platform && { platform: input.platform }),
          ...(input.sentiment && { sentiment: input.sentiment }),
          ...(input.cursor && { id: { lt: input.cursor } }),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
      });

      const hasMore = mentions.length > input.limit;
      const items = hasMore ? mentions.slice(0, -1) : mentions;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        items,
        nextCursor,
        hasMore,
      };
    }),

  /**
   * Obtiene tendencia de menciones sociales por día.
   * Útil para gráficas de área/línea.
   */
  getSocialTrend: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        days: z.number().min(1).max(90).default(7),
      })
    )
    .query(async ({ input, ctx }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const clientFilter = input.clientId
        ? { clientId: input.clientId }
        : { client: { orgId: ctx.user.orgId } };

      // Agrupar por fecha
      const trend = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(sm."createdAt") as date, COUNT(*) as count
        FROM "SocialMention" sm
        JOIN "Client" c ON sm."clientId" = c.id
        WHERE c."orgId" = ${ctx.user.orgId}
        ${input.clientId ? prisma.$queryRaw`AND sm."clientId" = ${input.clientId}` : prisma.$queryRaw``}
        AND sm."createdAt" >= ${since}
        GROUP BY DATE(sm."createdAt")
        ORDER BY date ASC
      `;

      return {
        trend: trend.map((t) => ({
          date: t.date,
          count: Number(t.count),
        })),
      };
    }),

  /**
   * Obtiene estadísticas de menciones sociales.
   */
  getSocialStats: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        days: z.number().min(1).max(90).default(7),
      })
    )
    .query(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        select: { id: true },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const [total, byPlatform, bySentiment, topMentions] = await Promise.all([
        // Total de menciones
        prisma.socialMention.count({
          where: { clientId: input.clientId, createdAt: { gte: since } },
        }),
        // Por plataforma
        prisma.socialMention.groupBy({
          by: ["platform"],
          where: { clientId: input.clientId, createdAt: { gte: since } },
          _count: { id: true },
        }),
        // Por sentimiento
        prisma.socialMention.groupBy({
          by: ["sentiment"],
          where: { clientId: input.clientId, createdAt: { gte: since } },
          _count: { id: true },
        }),
        // Top menciones por engagement
        prisma.socialMention.findMany({
          where: { clientId: input.clientId, createdAt: { gte: since } },
          orderBy: [{ likes: "desc" }, { comments: "desc" }],
          take: 5,
        }),
      ]);

      return {
        total,
        byPlatform: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count.id])),
        bySentiment: Object.fromEntries(bySentiment.map((s) => [s.sentiment, s._count.id])),
        topMentions,
      };
    }),

  /**
   * Obtiene las cuentas sociales monitoreadas de un cliente.
   */
  getSocialAccounts: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        select: { id: true, socialMonitoringEnabled: true, socialHashtags: true },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const accounts = await prisma.socialAccount.findMany({
        where: { clientId: input.clientId },
        orderBy: [{ platform: "asc" }, { handle: "asc" }],
      });

      return {
        accounts,
        socialMonitoringEnabled: client.socialMonitoringEnabled,
        socialHashtags: client.socialHashtags,
      };
    }),

  /**
   * Agrega una cuenta social a monitorear.
   */
  addSocialAccount: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        platform: SocialPlatformEnum,
        handle: z.string().min(1),
        label: z.string().optional(),
        isOwned: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      // Limpiar handle (quitar @ si viene)
      const cleanHandle = input.handle.replace(/^@/, "");

      // Verificar si ya existe
      const existing = await prisma.socialAccount.findUnique({
        where: {
          clientId_platform_handle: {
            clientId: input.clientId,
            platform: input.platform,
            handle: cleanHandle,
          },
        },
      });

      if (existing) {
        if (existing.active) {
          throw new TRPCError({ code: "CONFLICT", message: "Esta cuenta ya está siendo monitoreada" });
        }
        // Reactivar si estaba inactiva
        return prisma.socialAccount.update({
          where: { id: existing.id },
          data: { active: true, label: input.label || existing.label, isOwned: input.isOwned },
        });
      }

      // Validar que el handle existe (opcional, no bloquea si API no está configurada)
      let platformUserId: string | undefined;
      try {
        const apiClient = getEnsembleDataClient();
        if (apiClient.isConfigured()) {
          const validation = await apiClient.validateHandle(input.platform, cleanHandle);
          if (!validation.valid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Handle @${cleanHandle} no encontrado en ${input.platform}`,
            });
          }
          platformUserId = validation.platformUserId;
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.warn("[Social] Validation skipped:", error);
      }

      return prisma.socialAccount.create({
        data: {
          clientId: input.clientId,
          platform: input.platform,
          handle: cleanHandle,
          platformUserId,
          label: input.label,
          isOwned: input.isOwned,
        },
      });
    }),

  /**
   * Actualiza una cuenta social.
   */
  updateSocialAccount: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        isOwned: z.boolean().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      // Verificar que la cuenta pertenece a un cliente de la organización
      const account = await prisma.socialAccount.findFirst({
        where: {
          id,
          client: { orgId: ctx.user.orgId },
        },
      });

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      return prisma.socialAccount.update({
        where: { id },
        data,
      });
    }),

  /**
   * Elimina una cuenta social (soft delete).
   */
  removeSocialAccount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const account = await prisma.socialAccount.findFirst({
        where: {
          id: input.id,
          client: { orgId: ctx.user.orgId },
        },
      });

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      await prisma.socialAccount.update({
        where: { id: input.id },
        data: { active: false },
      });

      return { success: true };
    }),

  /**
   * Actualiza la configuración de monitoreo social de un cliente.
   */
  updateSocialConfig: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        socialMonitoringEnabled: z.boolean().optional(),
        socialHashtags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { clientId, ...data } = input;

      const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: ctx.user.orgId },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      // Limpiar hashtags (quitar # si viene)
      if (data.socialHashtags) {
        data.socialHashtags = data.socialHashtags.map((h) => h.replace(/^#/, ""));
      }

      return prisma.client.update({
        where: { id: clientId },
        data,
        select: {
          id: true,
          socialMonitoringEnabled: true,
          socialHashtags: true,
        },
      });
    }),

  /**
   * Ejecuta recolección manual de redes sociales para un cliente.
   * Encola un job para la recolección en lugar de ejecutar directamente.
   */
  triggerCollection: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        select: { id: true, name: true, socialMonitoringEnabled: true },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      if (!client.socialMonitoringEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El monitoreo social no está habilitado para este cliente",
        });
      }

      // Encolar el job de recolección
      try {
        const { getQueue } = await import("@mediabot/shared");
        const collectQueue = getQueue("collect-social");
        await collectQueue.add(
          "manual-collection",
          { clientId: input.clientId, manual: true },
          {
            attempts: 2,
            backoff: { type: "exponential", delay: 5000 },
          }
        );

        return {
          success: true,
          message: `Recolección iniciada para ${client.name}. Los resultados aparecerán en unos momentos.`,
          queued: true,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error al iniciar recolección";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),
});
