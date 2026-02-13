import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getEffectiveOrgId } from "../trpc";
import { prisma, getGeminiModel, cleanJsonResponse } from "@mediabot/shared";
import type { ResponseGenerationResult } from "@mediabot/shared";

/**
 * Schema Zod para validar respuesta de generateResponse.
 */
const ResponseGenerationSchema = z.object({
  title: z.string(),
  body: z.string(),
  tone: z.enum(["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"]).default("PROFESSIONAL"),
  audience: z.string().default("Medios generales"),
  callToAction: z.string().optional(),
  keyMessages: z.array(z.string()).default([]),
});

export const mentionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]).optional(),
        urgency: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        source: z.string().max(200).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        isLegacy: z.boolean().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        orgId: z.string().optional(), // Super Admin puede especificar org
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, clientId, sentiment, urgency, source, dateFrom, dateTo, isLegacy, orgId: inputOrgId } = input;
      const orgId = getEffectiveOrgId(ctx.user, inputOrgId);
      const clientOrgFilter = orgId ? { client: { orgId } } : {};

      // Construir filtro de artículo combinando source y fecha
      const articleFilter = {
        ...(source && { source: { contains: source, mode: "insensitive" as const } }),
        ...(dateFrom || dateTo
          ? {
              publishedAt: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }
          : {}),
      };

      const mentions = await prisma.mention.findMany({
        where: {
          ...clientOrgFilter,
          ...(clientId && { clientId }),
          ...(sentiment && { sentiment }),
          ...(urgency && { urgency }),
          ...(isLegacy !== undefined && { isLegacy }),
          ...(Object.keys(articleFilter).length > 0 && { article: articleFilter }),
        },
        include: {
          article: { select: { title: true, source: true, url: true, publishedAt: true } },
          client: { select: { name: true, org: ctx.user.isSuperAdmin ? { select: { name: true } } : false } },
        },
        orderBy: [{ article: { publishedAt: "desc" } }, { createdAt: "desc" }],
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (mentions.length > limit) {
        const next = mentions.pop();
        nextCursor = next!.id;
      }

      return { mentions, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Super Admin puede ver cualquier mención
      const mention = ctx.user.isSuperAdmin
        ? await prisma.mention.findFirst({
            where: { id: input.id },
            include: { article: true, client: true, tasks: true },
          })
        : await prisma.mention.findFirst({
            where: { id: input.id, client: { orgId: ctx.user.orgId! } },
            include: { article: true, client: true, tasks: true },
          });

      return mention;
    }),

  generateResponse: protectedProcedure
    .input(
      z.object({
        mentionId: z.string(),
        tone: z.enum(["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Super Admin puede generar respuesta para cualquier mención
      const mention = ctx.user.isSuperAdmin
        ? await prisma.mention.findFirst({
            where: { id: input.mentionId },
            include: { article: true, client: true },
          })
        : await prisma.mention.findFirst({
            where: { id: input.mentionId, client: { orgId: ctx.user.orgId! } },
            include: { article: true, client: true },
          });

      if (!mention) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mention not found" });
      }

      const toneInstruction = input.tone
        ? `El tono DEBE ser ${input.tone}.`
        : `Selecciona el tono mas apropiado basado en el sentimiento del articulo.`;

      const model = getGeminiModel();

      const prompt = `Eres un experto en comunicacion corporativa y relaciones publicas.
Genera un borrador de comunicado de prensa en respuesta a esta mencion en medios.

Cliente: ${mention.client.name}
Industria: ${mention.client.industry || "No especificada"}
Descripcion: ${mention.client.description || "No disponible"}

Articulo original:
Titulo: ${mention.article.title}
Fuente: ${mention.article.source}
Contenido: ${mention.article.content?.slice(0, 1500) || "No disponible"}

Analisis previo:
Sentimiento: ${mention.sentiment}
Relevancia: ${mention.relevance}/10
Resumen: ${mention.aiSummary || "No disponible"}

${toneInstruction}

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "title": "Titulo del comunicado (conciso y profesional)",
  "body": "Cuerpo completo del comunicado (3-4 parrafos, incluye contexto, posicion del cliente, datos relevantes y cierre)",
  "tone": "PROFESSIONAL",
  "audience": "Publico objetivo principal (ej: medios generales, prensa especializada, stakeholders)",
  "callToAction": "Siguiente paso recomendado para el equipo de PR",
  "keyMessages": ["Mensaje clave 1", "Mensaje clave 2", "Mensaje clave 3"]
}

Tonos validos: PROFESSIONAL, DEFENSIVE, CLARIFICATION, CELEBRATORY`;

      const fallbackResponse: ResponseGenerationResult = {
        title: `Comunicado sobre: ${mention.article.title.slice(0, 50)}`,
        body: "Error al generar el comunicado automatico. Por favor, redacte manualmente.",
        tone: "PROFESSIONAL",
        audience: "Medios generales",
        callToAction: "Revisar y completar manualmente",
        keyMessages: ["Revisar articulo original", "Definir posicion del cliente"],
      };

      try {
        const genResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1536, temperature: 0.4 },
        });

        const rawText = genResult.response.text();
        const cleaned = cleanJsonResponse(rawText);
        const parsed = JSON.parse(cleaned);

        // Validar con Zod
        const validated = ResponseGenerationSchema.safeParse(parsed);
        if (!validated.success) {
          console.error("[Mentions] Zod validation error:", validated.error.message);
          return fallbackResponse;
        }

        return validated.data as ResponseGenerationResult;
      } catch (error) {
        console.error("[Mentions] generateResponse error:", error);
        return fallbackResponse;
      }
    }),
});
