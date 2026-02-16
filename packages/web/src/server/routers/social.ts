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
// Note: Do NOT use Prisma.empty in $queryRaw - it generates phantom $N params
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma, getEnsembleDataClient } from "@mediabot/shared";

const SocialPlatformEnum = z.enum(["TWITTER", "INSTAGRAM", "TIKTOK", "YOUTUBE"]);

/**
 * Schema Zod para validar respuesta de suggestHashtags.
 */
const HashtagSuggestionSchema = z.object({
  hashtags: z.array(
    z.object({
      hashtag: z.string(),
      platform: z.enum(["TWITTER", "INSTAGRAM", "TIKTOK", "YOUTUBE", "ALL"]).default("ALL"),
      confidence: z.number().min(0).max(1).default(0.7),
      reason: z.string().optional(),
    })
  ).default([]),
  suggestedAccounts: z.array(
    z.object({
      platform: z.enum(["TWITTER", "INSTAGRAM", "TIKTOK", "YOUTUBE"]).default("TWITTER"),
      handle: z.string(),
      reason: z.string().optional(),
    })
  ).default([]),
});

// Queue names (importado inline para evitar dependencia circular)
const EXTRACT_COMMENTS_QUEUE = "extract-social-comments";

export const socialRouter = router({
  /**
   * Extrae comentarios de un post social (Instagram o TikTok).
   * Encola un job de extracción y retorna inmediatamente.
   */
  extractComments: protectedProcedure
    .input(
      z.object({
        mentionId: z.string(),
        maxComments: z.number().min(5).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Buscar la mención
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.mentionId }
        : { id: input.mentionId, client: { orgId: ctx.user.orgId! } };

      const mention = await prisma.socialMention.findFirst({
        where: whereClause,
        select: {
          id: true,
          platform: true,
          postUrl: true,
          commentsExtractedAt: true,
          client: { select: { name: true } },
        },
      });

      if (!mention) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mención no encontrada" });
      }

      // Verificar plataforma soportada
      if (mention.platform === "TWITTER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La extracción de comentarios no está disponible para Twitter",
        });
      }

      // Verificar si ya se extrajeron recientemente
      if (mention.commentsExtractedAt) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (mention.commentsExtractedAt > hourAgo) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Los comentarios ya fueron extraídos hace menos de 1 hora. Intente más tarde.",
          });
        }
      }

      // Encolar extracción
      try {
        const { getQueue } = await import("@mediabot/shared");
        const extractQueue = getQueue(EXTRACT_COMMENTS_QUEUE);
        await extractQueue.add(
          "extract-comments",
          { mentionId: input.mentionId, maxComments: input.maxComments },
          {
            jobId: `extract-comments-${input.mentionId}-${Date.now()}`,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
          }
        );

        return {
          success: true,
          message: `Extracción de comentarios iniciada para el post de ${mention.platform}. Los resultados aparecerán en unos momentos.`,
          queued: true,
        };
      } catch (error) {
        console.error("[Social] Queue error:", error instanceof Error ? error.message : error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al iniciar extracción. Intente nuevamente.",
        });
      }
    }),


  /**
   * Sugiere hashtags y cuentas basados en el cliente.
   * Usa IA para generar sugerencias relevantes.
   */
  suggestHashtags: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        industry: z.string().max(100).optional(),
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

      const fallbackResult = {
        hashtags: [
          {
            hashtag: input.clientName.replace(/\s+/g, ""),
            platform: "ALL" as const,
            confidence: 0.8,
            reason: "Nombre del cliente",
          },
        ],
        suggestedAccounts: [],
      };

      try {
        const genResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
        });

        const rawText = genResult.response.text();
        const jsonText = cleanJsonResponse(rawText);
        const parsed = JSON.parse(jsonText);

        // Validar con Zod
        const validated = HashtagSuggestionSchema.safeParse(parsed);
        if (!validated.success) {
          console.error("[Social] Zod validation error:", validated.error.message);
          return fallbackResult;
        }

        const result = validated.data;

        // Limpiar resultado (quitar # y @)
        result.hashtags = result.hashtags.map((h) => ({
          ...h,
          hashtag: h.hashtag.replace(/^#/, ""),
          confidence: Math.max(0.5, Math.min(1, h.confidence)),
        }));

        result.suggestedAccounts = result.suggestedAccounts.map((a) => ({
          ...a,
          handle: a.handle.replace(/^@/, ""),
        }));

        return result;
      } catch (error) {
        console.error("[Social] Parse error:", error);
        return fallbackResult;
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
        orgId: z.string().optional(), // Super Admin puede especificar org
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};

      // Combinar dateFrom y dateTo en un filtro postedAt
      const postedAtFilter = (input.dateFrom || input.dateTo)
        ? {
            postedAt: {
              ...(input.dateFrom && { gte: input.dateFrom }),
              ...(input.dateTo && { lte: input.dateTo }),
            },
          }
        : {};

      const mentions = await prisma.socialMention.findMany({
        where: {
          ...clientOrgFilter,
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.platform && { platform: input.platform }),
          ...(input.sentiment && { sentiment: input.sentiment }),
          ...(input.sourceType && { sourceType: input.sourceType }),
          ...postedAtFilter,
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
        orgId: z.string().optional(), // Super Admin puede especificar org
      })
    )
    .query(async ({ input, ctx }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};

      const [total, byPlatform, bySentiment, bySourceType] = await Promise.all([
        prisma.socialMention.count({
          where: {
            ...clientOrgFilter,
            ...(input.clientId && { clientId: input.clientId }),
            postedAt: { gte: since },
          },
        }),
        prisma.socialMention.groupBy({
          by: ["platform"],
          where: {
            ...clientOrgFilter,
            ...(input.clientId && { clientId: input.clientId }),
            postedAt: { gte: since },
          },
          _count: { id: true },
        }),
        prisma.socialMention.groupBy({
          by: ["sentiment"],
          where: {
            ...clientOrgFilter,
            ...(input.clientId && { clientId: input.clientId }),
            postedAt: { gte: since },
          },
          _count: { id: true },
        }),
        prisma.socialMention.groupBy({
          by: ["sourceType"],
          where: {
            ...clientOrgFilter,
            ...(input.clientId && { clientId: input.clientId }),
            postedAt: { gte: since },
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
      // Super Admin puede ver cualquier mención social
      const mention = ctx.user.isSuperAdmin
        ? await prisma.socialMention.findFirst({
            where: { id: input.id },
            include: { client: { select: { id: true, name: true } } },
          })
        : await prisma.socialMention.findFirst({
            where: { id: input.id, client: { orgId: ctx.user.orgId! } },
            include: { client: { select: { id: true, name: true } } },
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
      // Super Admin puede ver cualquier cliente
      const clientWhereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({
        where: clientWhereClause,
        select: { id: true },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const mentions = await prisma.socialMention.findMany({
        where: {
          clientId: input.clientId,
          postedAt: { gte: since },
          ...(input.platform && { platform: input.platform }),
          ...(input.sentiment && { sentiment: input.sentiment }),
          ...(input.cursor && { id: { lt: input.cursor } }),
        },
        orderBy: { postedAt: "desc" },
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
        orgId: z.string().optional(), // Super Admin puede especificar org
      })
    )
    .query(async ({ input, ctx }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);

      // Build dynamic filters for $queryRawUnsafe (avoid Prisma.empty)
      const trendParams: unknown[] = [since]; // $1 = since
      const trendFilters: string[] = [];
      let trendIdx = 2;

      if (orgId) {
        trendFilters.push(`AND c."orgId" = $${trendIdx}`);
        trendParams.push(orgId);
        trendIdx++;
      }
      if (input.clientId) {
        trendFilters.push(`AND sm."clientId" = $${trendIdx}`);
        trendParams.push(input.clientId);
        trendIdx++;
      }

      const trend = await prisma.$queryRawUnsafe<{ date: string; count: bigint }[]>(
        `SELECT DATE(sm."createdAt") as date, COUNT(*) as count
        FROM "SocialMention" sm
        JOIN "Client" c ON sm."clientId" = c.id
        WHERE sm."createdAt" >= $1
        ${trendFilters.join(" ")}
        GROUP BY DATE(sm."createdAt")
        ORDER BY date ASC`,
        ...trendParams
      );

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
      // Super Admin puede ver cualquier cliente
      const clientWhereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({
        where: clientWhereClause,
        select: { id: true },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const [total, byPlatform, bySentiment, topMentions] = await Promise.all([
        // Total de menciones
        prisma.socialMention.count({
          where: { clientId: input.clientId, postedAt: { gte: since } },
        }),
        // Por plataforma
        prisma.socialMention.groupBy({
          by: ["platform"],
          where: { clientId: input.clientId, postedAt: { gte: since } },
          _count: { id: true },
        }),
        // Por sentimiento
        prisma.socialMention.groupBy({
          by: ["sentiment"],
          where: { clientId: input.clientId, postedAt: { gte: since } },
          _count: { id: true },
        }),
        // Top menciones por engagement
        prisma.socialMention.findMany({
          where: { clientId: input.clientId, postedAt: { gte: since } },
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
      // Super Admin puede ver cualquier cliente
      const clientWhereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({
        where: clientWhereClause,
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
      // Super Admin puede agregar a cualquier cliente
      const clientWhereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({ where: clientWhereClause });

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

      // Super Admin puede actualizar cualquier cuenta
      const whereClause = ctx.user.isSuperAdmin
        ? { id }
        : { id, client: { orgId: ctx.user.orgId! } };
      const account = await prisma.socialAccount.findFirst({ where: whereClause });

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
      // Super Admin puede eliminar cualquier cuenta
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.id }
        : { id: input.id, client: { orgId: ctx.user.orgId! } };
      const account = await prisma.socialAccount.findFirst({ where: whereClause });

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

      // Super Admin puede actualizar cualquier cliente
      const clientWhereClause = ctx.user.isSuperAdmin
        ? { id: clientId }
        : { id: clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({ where: clientWhereClause });

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
   * Elimina una mención social individual.
   */
  deleteSocialMention: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.id }
        : { id: input.id, client: { orgId: ctx.user.orgId! } };

      const mention = await prisma.socialMention.findFirst({
        where: whereClause,
        select: { id: true },
      });

      if (!mention) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mención no encontrada" });
      }

      await prisma.socialMention.delete({ where: { id: input.id } });

      return { success: true };
    }),

  /**
   * Elimina múltiples menciones sociales en lote.
   */
  deleteSocialMentions: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const whereClause = ctx.user.isSuperAdmin
        ? { id: { in: input.ids } }
        : { id: { in: input.ids }, client: { orgId: ctx.user.orgId! } };

      const found = await prisma.socialMention.findMany({
        where: whereClause,
        select: { id: true },
      });

      const foundIds = found.map((m) => m.id);

      if (foundIds.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ninguna mención encontrada" });
      }

      const result = await prisma.socialMention.deleteMany({
        where: { id: { in: foundIds } },
      });

      return { success: true, deletedCount: result.count };
    }),

  /**
   * Genera un borrador de comunicado (ResponseDraft) a partir de una mención social.
   * Usa Gemini para generar el contenido del comunicado.
   */
  generateResponse: protectedProcedure
    .input(
      z.object({
        socialMentionId: z.string(),
        tone: z.enum(["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Fetch social mention with client
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.socialMentionId }
        : { id: input.socialMentionId, client: { orgId: ctx.user.orgId! } };

      const mention = await prisma.socialMention.findFirst({
        where: whereClause,
        include: { client: true },
      });

      if (!mention) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mención social no encontrada" });
      }

      // 2. Call Gemini to generate draft
      const { getGeminiModel, cleanJsonResponse } = await import("@mediabot/shared");
      const model = getGeminiModel();

      const toneInstruction = input.tone
        ? `El tono DEBE ser ${input.tone}.`
        : `Selecciona el tono mas apropiado basado en el sentimiento del post.`;

      const prompt = `Eres un experto en comunicacion corporativa y relaciones publicas.
Genera un borrador de comunicado de prensa en respuesta a esta mencion en redes sociales.

Cliente: ${mention.client.name}
Industria: ${mention.client.industry || "No especificada"}
Descripcion: ${mention.client.description || "No disponible"}

Post en redes sociales:
Plataforma: ${mention.platform}
Autor: @${mention.authorHandle}
Contenido: ${mention.content || "No disponible"}
Likes: ${mention.likes}, Comentarios: ${mention.comments}, Compartidos: ${mention.shares}

Analisis previo:
Sentimiento: ${mention.sentiment || "No analizado"}
Resumen: ${mention.aiSummary || "No disponible"}

${toneInstruction}

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "title": "Titulo del comunicado (conciso y profesional)",
  "body": "Cuerpo completo del comunicado (3-4 parrafos, incluye contexto, posicion del cliente, datos relevantes y cierre)",
  "tone": "PROFESSIONAL",
  "audience": "Publico objetivo principal",
  "callToAction": "Siguiente paso recomendado para el equipo de PR",
  "keyMessages": ["Mensaje clave 1", "Mensaje clave 2", "Mensaje clave 3"]
}

Tonos validos: PROFESSIONAL, DEFENSIVE, CLARIFICATION, CELEBRATORY`;

      try {
        const genResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1536, temperature: 0.4 },
        });

        const rawText = genResult.response.text();
        const cleaned = cleanJsonResponse(rawText);
        const parsed = JSON.parse(cleaned);

        // 3. Create ResponseDraft linked to socialMention
        const draft = await prisma.responseDraft.create({
          data: {
            title: parsed.title || `Comunicado: @${mention.authorHandle}`,
            body: parsed.body || "",
            tone: parsed.tone || input.tone || "PROFESSIONAL",
            audience: parsed.audience || "Medios generales",
            callToAction: parsed.callToAction || "",
            keyMessages: parsed.keyMessages || [],
            socialMentionId: input.socialMentionId,
            createdById: ctx.user.id,
          },
        });

        // Disparar notificación Telegram
        try {
          const { getQueue: getQ, QUEUE_NAMES: QN } = await import("@mediabot/shared");
          const notifyQueue = getQ(QN.NOTIFY_TELEGRAM);
          await notifyQueue.add("response-draft-social", {
            clientId: mention.clientId,
            type: "RESPONSE_DRAFT",
            message:
              `📝 BORRADOR DE COMUNICADO | ${mention.client.name}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📋 ${draft.title}\n` +
              `🎭 Tono: ${draft.tone}\n` +
              `📱 Plataforma: ${mention.platform}\n` +
              `👤 Sobre post de: @${mention.authorHandle}\n\n` +
              `Revisa y aprueba el borrador en el dashboard.`,
          });
        } catch (err) {
          console.error("Failed to queue RESPONSE_DRAFT notification:", err);
        }

        return draft;
      } catch (error) {
        console.error("[Social] generateResponse error:", error);
        // Create fallback draft
        return prisma.responseDraft.create({
          data: {
            title: `Comunicado sobre post de @${mention.authorHandle}`,
            body: "Error al generar el comunicado automático. Por favor, redacte manualmente.",
            tone: input.tone || "PROFESSIONAL",
            audience: "Medios generales",
            callToAction: "Revisar y completar manualmente",
            keyMessages: ["Revisar post original", "Definir posición del cliente"],
            socialMentionId: input.socialMentionId,
            createdById: ctx.user.id,
          },
        });
      }
    }),

  /**
   * Exporta menciones sociales como array de objetos planos (para CSV).
   */
  exportSocialMentions: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        platform: SocialPlatformEnum.optional(),
        sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};

      const postedAtFilter = (input.dateFrom || input.dateTo)
        ? {
            postedAt: {
              ...(input.dateFrom && { gte: input.dateFrom }),
              ...(input.dateTo && { lte: input.dateTo }),
            },
          }
        : {};

      const mentions = await prisma.socialMention.findMany({
        where: {
          ...clientOrgFilter,
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.platform && { platform: input.platform }),
          ...(input.sentiment && { sentiment: input.sentiment }),
          ...postedAtFilter,
        },
        include: {
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      return mentions.map((m) => ({
        date: m.postedAt?.toISOString() || m.createdAt.toISOString(),
        platform: m.platform,
        author: m.authorHandle,
        content: m.content || "",
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        views: m.views ?? 0,
        engagement: m.likes + m.comments + m.shares,
        sentiment: m.sentiment,
        client: m.client.name,
        postUrl: m.postUrl,
      }));
    }),

  /**
   * Ejecuta recolección manual de redes sociales para un cliente.
   * Encola un job para la recolección en lugar de ejecutar directamente.
   * Permite seleccionar plataformas específicas.
   */
  triggerCollection: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        platforms: z.array(SocialPlatformEnum).optional(), // Si no se especifica, recolecta todas
        collectHashtags: z.boolean().default(true),
        collectHandles: z.boolean().default(true),
        maxPostsPerSource: z.number().min(1).max(50).optional(),
        maxAgeDays: z.number().min(1).max(90).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Super Admin puede ejecutar recolección para cualquier cliente
      const clientWhereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({
        where: clientWhereClause,
        select: { id: true, name: true, socialMonitoringEnabled: true, lastSocialCollectionAt: true },
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

      // Verificar cooldown de 30 minutos
      const COOLDOWN_MS = 30 * 60 * 1000;
      if (client.lastSocialCollectionAt) {
        const elapsed = Date.now() - new Date(client.lastSocialCollectionAt).getTime();
        if (elapsed < COOLDOWN_MS) {
          const remainingMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Espera ${remainingMin} minuto${remainingMin !== 1 ? "s" : ""} antes de recolectar de nuevo`,
          });
        }
      }

      // Encolar el job de recolección
      try {
        const { getQueue } = await import("@mediabot/shared");
        const collectQueue = getQueue("collect-social");
        await collectQueue.add(
          "manual-collection",
          {
            clientId: input.clientId,
            manual: true,
            platforms: input.platforms, // undefined = todas
            collectHashtags: input.collectHashtags,
            collectHandles: input.collectHandles,
            maxPostsPerSource: input.maxPostsPerSource,
            maxAgeDays: input.maxAgeDays,
          },
          {
            attempts: 2,
            backoff: { type: "exponential", delay: 5000 },
          }
        );

        // Actualizar timestamp de última recolección
        await prisma.client.update({
          where: { id: input.clientId },
          data: { lastSocialCollectionAt: new Date() },
        });

        const platformsMsg = input.platforms
          ? input.platforms.join(", ")
          : "todas las plataformas";

        return {
          success: true,
          message: `Recolección iniciada para ${client.name} (${platformsMsg}). Los resultados aparecerán en unos momentos.`,
          queued: true,
        };
      } catch (error) {
        // Log del error interno sin exponer al cliente
        console.error("[Social] Queue error:", error instanceof Error ? error.message : error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al iniciar recolección. Intente nuevamente.",
        });
      }
    }),
});
