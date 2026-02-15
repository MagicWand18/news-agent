import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma, getGeminiModel, cleanJsonResponse } from "@mediabot/shared";

const ResponseStatusEnum = z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "DISCARDED"]);

export const responsesRouter = router({
  /**
   * Lista borradores de respuesta con filtros y paginación.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: ResponseStatusEnum.optional(),
        clientId: z.string().optional(),
        mentionId: z.string().optional(),
        socialMentionId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = getEffectiveOrgId(ctx.user, input.orgId);

      // Filtro por organización a través de mention o socialMention
      const orgFilter = orgId
        ? {
            OR: [
              { mention: { client: { orgId } } },
              { socialMention: { client: { orgId } } },
              // Borradores sin mención asociada (creados manualmente)
              { mentionId: null, socialMentionId: null },
            ],
          }
        : {};

      const drafts = await prisma.responseDraft.findMany({
        where: {
          ...orgFilter,
          ...(input.status && { status: input.status }),
          ...(input.mentionId && { mentionId: input.mentionId }),
          ...(input.socialMentionId && { socialMentionId: input.socialMentionId }),
          ...(input.clientId && {
            OR: [
              { mention: { clientId: input.clientId } },
              { socialMention: { clientId: input.clientId } },
            ],
          }),
        },
        include: {
          mention: {
            select: {
              id: true,
              sentiment: true,
              article: { select: { title: true, source: true } },
              client: { select: { id: true, name: true } },
            },
          },
          socialMention: {
            select: {
              id: true,
              platform: true,
              authorHandle: true,
              content: true,
              client: { select: { id: true, name: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (drafts.length > input.limit) {
        const next = drafts.pop();
        nextCursor = next!.id;
      }

      return { drafts, nextCursor };
    }),

  /**
   * Obtiene un borrador por ID con todas las relaciones.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const draft = await prisma.responseDraft.findFirst({
        where: { id: input.id },
        include: {
          mention: {
            include: {
              article: true,
              client: { select: { id: true, name: true, orgId: true } },
            },
          },
          socialMention: {
            include: {
              client: { select: { id: true, name: true, orgId: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      });

      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Borrador no encontrado" });
      }

      // Verificar org-scoping
      if (!ctx.user.isSuperAdmin) {
        const draftOrgId = draft.mention?.client?.orgId ?? draft.socialMention?.client?.orgId;
        if (draftOrgId && draftOrgId !== ctx.user.orgId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Borrador no encontrado" });
        }
      }

      return draft;
    }),

  /**
   * Crea un nuevo borrador de respuesta.
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        body: z.string().min(1).max(10000),
        tone: z.string().max(100),
        audience: z.string().max(500),
        callToAction: z.string().max(1000),
        keyMessages: z.array(z.string().max(500)).max(10).default([]),
        mentionId: z.string().optional(),
        socialMentionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verificar que la mención pertenece a la org del usuario
      if (input.mentionId && !ctx.user.isSuperAdmin) {
        const mention = await prisma.mention.findFirst({
          where: { id: input.mentionId, client: { orgId: ctx.user.orgId! } },
        });
        if (!mention) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mención no encontrada" });
        }
      }
      if (input.socialMentionId && !ctx.user.isSuperAdmin) {
        const sm = await prisma.socialMention.findFirst({
          where: { id: input.socialMentionId, client: { orgId: ctx.user.orgId! } },
        });
        if (!sm) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mención social no encontrada" });
        }
      }

      return prisma.responseDraft.create({
        data: {
          ...input,
          createdById: ctx.user.id,
        },
      });
    }),

  /**
   * Edita un borrador (solo si está en estado DRAFT).
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        tone: z.string().optional(),
        audience: z.string().optional(),
        callToAction: z.string().optional(),
        keyMessages: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const draft = await prisma.responseDraft.findFirst({
        where: { id },
        include: {
          mention: { select: { client: { select: { orgId: true } } } },
          socialMention: { select: { client: { select: { orgId: true } } } },
        },
      });

      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Borrador no encontrado" });
      }

      // Verificar org-scoping
      if (!ctx.user.isSuperAdmin) {
        const draftOrgId = draft.mention?.client?.orgId ?? draft.socialMention?.client?.orgId;
        if (draftOrgId && draftOrgId !== ctx.user.orgId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Borrador no encontrado" });
        }
      }

      if (draft.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo se pueden editar borradores en estado DRAFT",
        });
      }

      return prisma.responseDraft.update({
        where: { id },
        data,
      });
    }),

  /**
   * Cambia el estado de un borrador.
   * DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED o -> DISCARDED
   * Solo ADMIN/SUPERVISOR pueden aprobar.
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: ResponseStatusEnum,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const draft = await prisma.responseDraft.findFirst({
        where: { id: input.id },
        include: {
          mention: { select: { client: { select: { orgId: true } } } },
          socialMention: { select: { client: { select: { orgId: true } } } },
        },
      });

      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Borrador no encontrado" });
      }

      // Verificar org-scoping
      if (!ctx.user.isSuperAdmin) {
        const draftOrgId = draft.mention?.client?.orgId ?? draft.socialMention?.client?.orgId;
        if (draftOrgId && draftOrgId !== ctx.user.orgId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Borrador no encontrado" });
        }
      }

      // Validar transiciones de estado
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["IN_REVIEW", "DISCARDED"],
        IN_REVIEW: ["APPROVED", "DRAFT", "DISCARDED"],
        APPROVED: ["PUBLISHED", "DISCARDED"],
        PUBLISHED: [],
        DISCARDED: ["DRAFT"],
      };

      const allowed = validTransitions[draft.status] || [];
      if (!allowed.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No se puede cambiar de ${draft.status} a ${input.status}`,
        });
      }

      // Solo ADMIN/SUPERVISOR pueden aprobar
      if (input.status === "APPROVED") {
        if (ctx.user.role !== "ADMIN" && ctx.user.role !== "SUPERVISOR" && !ctx.user.isSuperAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Solo ADMIN o SUPERVISOR pueden aprobar borradores",
          });
        }
      }

      const updateData: Record<string, unknown> = { status: input.status };
      if (input.status === "APPROVED") {
        updateData.approvedById = ctx.user.id;
        updateData.approvedAt = new Date();
      }

      return prisma.responseDraft.update({
        where: { id: input.id },
        data: updateData,
      });
    }),

  /**
   * Regenera un borrador con un tono diferente usando IA.
   */
  regenerate: protectedProcedure
    .input(
      z.object({
        mentionId: z.string().optional(),
        socialMentionId: z.string().optional(),
        tone: z.enum(["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"]).default("PROFESSIONAL"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let context = "";

      if (input.mentionId) {
        const mentionWhere = ctx.user.isSuperAdmin
          ? { id: input.mentionId }
          : { id: input.mentionId, client: { orgId: ctx.user.orgId! } };
        const mention = await prisma.mention.findFirst({
          where: mentionWhere,
          include: { article: true, client: true },
        });
        if (!mention) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mención no encontrada" });
        }
        context = `Cliente: ${mention.client.name}
Industria: ${mention.client.industry || "No especificada"}
Artículo: ${mention.article.title}
Fuente: ${mention.article.source}
Contenido: ${mention.article.content?.slice(0, 1500) || "No disponible"}
Sentimiento: ${mention.sentiment}
Resumen: ${mention.aiSummary || "No disponible"}`;
      } else if (input.socialMentionId) {
        const smWhere = ctx.user.isSuperAdmin
          ? { id: input.socialMentionId }
          : { id: input.socialMentionId, client: { orgId: ctx.user.orgId! } };
        const socialMention = await prisma.socialMention.findFirst({
          where: smWhere,
          include: { client: true },
        });
        if (!socialMention) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Mención social no encontrada" });
        }
        context = `Cliente: ${socialMention.client.name}
Industria: ${socialMention.client.industry || "No especificada"}
Plataforma: ${socialMention.platform}
Autor: @${socialMention.authorHandle}
Contenido: ${socialMention.content || "No disponible"}
Sentimiento: ${socialMention.sentiment}
Resumen: ${socialMention.aiSummary || "No disponible"}`;
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Se requiere mentionId o socialMentionId",
        });
      }

      const model = getGeminiModel();

      const prompt = `Eres un experto en comunicacion corporativa y relaciones publicas.
Genera un borrador de comunicado de prensa con tono ${input.tone}.

${context}

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "title": "Titulo del comunicado",
  "body": "Cuerpo completo del comunicado (3-4 parrafos)",
  "tone": "${input.tone}",
  "audience": "Publico objetivo",
  "callToAction": "Siguiente paso recomendado",
  "keyMessages": ["Mensaje clave 1", "Mensaje clave 2", "Mensaje clave 3"]
}`;

      try {
        const genResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1536, temperature: 0.4 },
        });

        const rawText = genResult.response.text();
        const cleaned = cleanJsonResponse(rawText);
        const parsed = JSON.parse(cleaned);

        // Crear nuevo borrador con el resultado
        return prisma.responseDraft.create({
          data: {
            title: parsed.title || "Borrador regenerado",
            body: parsed.body || "",
            tone: parsed.tone || input.tone,
            audience: parsed.audience || "Medios generales",
            callToAction: parsed.callToAction || "",
            keyMessages: parsed.keyMessages || [],
            mentionId: input.mentionId,
            socialMentionId: input.socialMentionId,
            createdById: ctx.user.id,
          },
        });
      } catch (error) {
        console.error("[Responses] regenerate error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al regenerar la respuesta. Intente nuevamente.",
        });
      }
    }),
});
