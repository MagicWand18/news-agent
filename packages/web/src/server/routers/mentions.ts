import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma, config } from "@mediabot/shared";
import type { ResponseGenerationResult } from "@mediabot/shared";
import Anthropic from "@anthropic-ai/sdk";

export const mentionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]).optional(),
        urgency: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        source: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, clientId, sentiment, urgency, source, dateFrom, dateTo } = input;

      const mentions = await prisma.mention.findMany({
        where: {
          client: { orgId: ctx.user.orgId },
          ...(clientId && { clientId }),
          ...(sentiment && { sentiment }),
          ...(urgency && { urgency }),
          ...(source && { article: { source: { contains: source, mode: "insensitive" } } }),
          ...(dateFrom || dateTo
            ? {
                createdAt: {
                  ...(dateFrom && { gte: dateFrom }),
                  ...(dateTo && { lte: dateTo }),
                },
              }
            : {}),
        },
        include: {
          article: { select: { title: true, source: true, url: true, publishedAt: true } },
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
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
      return prisma.mention.findFirst({
        where: {
          id: input.id,
          client: { orgId: ctx.user.orgId },
        },
        include: {
          article: true,
          client: true,
          tasks: true,
        },
      });
    }),

  generateResponse: protectedProcedure
    .input(
      z.object({
        mentionId: z.string(),
        tone: z.enum(["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const mention = await prisma.mention.findFirst({
        where: {
          id: input.mentionId,
          client: { orgId: ctx.user.orgId },
        },
        include: {
          article: true,
          client: true,
        },
      });

      if (!mention) {
        throw new Error("Mention not found");
      }

      const anthropic = new Anthropic({
        apiKey: config.anthropic.apiKey,
      });

      const toneInstruction = input.tone
        ? `El tono DEBE ser ${input.tone}.`
        : `Selecciona el tono mas apropiado basado en el sentimiento del articulo.`;

      const message = await anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: `Eres un experto en comunicacion corporativa y relaciones publicas.
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

Genera un comunicado en JSON con este formato exacto:
{
  "title": "Titulo del comunicado (conciso y profesional)",
  "body": "Cuerpo completo del comunicado (3-4 parrafos, incluye contexto, posicion del cliente, datos relevantes y cierre)",
  "tone": "PROFESSIONAL|DEFENSIVE|CLARIFICATION|CELEBRATORY",
  "audience": "Publico objetivo principal (ej: medios generales, prensa especializada, stakeholders)",
  "callToAction": "Siguiente paso recomendado para el equipo de PR",
  "keyMessages": ["Mensaje clave 1", "Mensaje clave 2", "Mensaje clave 3"]
}

Solo responde con el JSON, sin markdown ni texto adicional.`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Claude");
      }

      const rawText = content.text;

      // Extract JSON from potential markdown code blocks
      const codeBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      const cleaned = codeBlockMatch ? codeBlockMatch[1].trim() : rawText.trim();

      try {
        const result = JSON.parse(cleaned) as ResponseGenerationResult;
        if (!["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"].includes(result.tone)) {
          result.tone = "PROFESSIONAL";
        }
        return result;
      } catch {
        return {
          title: `Comunicado sobre: ${mention.article.title.slice(0, 50)}`,
          body: "Error al generar el comunicado automatico. Por favor, redacte manualmente.",
          tone: "PROFESSIONAL" as const,
          audience: "Medios generales",
          callToAction: "Revisar y completar manualmente",
          keyMessages: ["Revisar articulo original", "Definir posicion del cliente"],
        };
      }
    }),
});
