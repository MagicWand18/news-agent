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
      })
    )
    .mutation(async ({ input }) => {
      // Llamar directamente a la API de Claude para generar sugerencias
      const { getAnthropicClient, config } = await import("@mediabot/shared");

      const keywordsContext = input.existingKeywords?.length
        ? `\n\nKeywords de monitoreo de noticias actuales:\n${input.existingKeywords.slice(0, 15).join(", ")}`
        : "";

      const message = await getAnthropicClient().messages.create({
        model: config.anthropic.model,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Eres un experto en marketing digital y monitoreo de redes sociales en Mexico y Latinoamerica.

CLIENTE:
Nombre: ${input.clientName}
Descripcion: ${input.description || "No proporcionada"}
Industria: ${input.industry || "No especificada"}${keywordsContext}

Genera hashtags y cuentas de redes sociales relevantes para monitorear a este cliente.

REGLAS:
- Los hashtags deben ser populares y relevantes en Mexico/Latam
- Incluir hashtags genericos de la industria y especificos del cliente
- Sugerir cuentas de competidores, influencers del sector, medios relevantes
- Considerar Twitter/X, Instagram y TikTok
- No incluir el simbolo # en los hashtags

Responde SOLO en JSON con este formato:
{
  "hashtags": [
    {
      "hashtag": "nombreSinHashtag",
      "platform": "TWITTER|INSTAGRAM|TIKTOK|ALL",
      "confidence": <0.5 a 1.0>,
      "reason": "Por que es relevante"
    }
  ],
  "suggestedAccounts": [
    {
      "platform": "TWITTER|INSTAGRAM|TIKTOK",
      "handle": "username_sin_arroba",
      "reason": "Por que monitorear esta cuenta"
    }
  ]
}

Genera:
- 8-15 hashtags variados (mezcla de genericos e industria)
- 3-6 cuentas sugeridas (competidores, influencers, medios)`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al generar sugerencias",
        });
      }

      try {
        // Extraer JSON de la respuesta
        const jsonMatch = content.text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1].trim() : content.text.trim();
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
      } catch {
        console.error("[Social] Parse error:", content.text.slice(0, 500));
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
