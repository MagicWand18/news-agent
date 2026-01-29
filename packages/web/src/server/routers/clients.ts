import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { prisma, getOnboardingQueue } from "@mediabot/shared";

/**
 * Resta días a una fecha.
 */
function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

export const clientsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.client.findMany({
      where: { orgId: ctx.user.orgId },
      include: {
        _count: {
          select: {
            keywords: { where: { active: true } },
            mentions: true,
            tasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.client.findFirst({
        where: { id: input.id, orgId: ctx.user.orgId },
        include: {
          keywords: { where: { active: true }, orderBy: { type: "asc" } },
          mentions: {
            include: { article: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          _count: { select: { mentions: true, tasks: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        industry: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = await prisma.client.create({
        data: {
          ...input,
          orgId: ctx.user.orgId,
        },
      });

      // Add client name as default keyword
      await prisma.keyword.create({
        data: {
          word: input.name,
          type: "NAME",
          clientId: client.id,
        },
      });

      // Trigger AI onboarding to generate additional keywords
      try {
        const onboardingQueue = getOnboardingQueue();
        await onboardingQueue.add(
          "onboard",
          { clientId: client.id },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
          }
        );
        console.log(`[Clients] Queued onboarding for client: ${client.name}`);
      } catch (err) {
        // Don't fail client creation if queue is unavailable
        console.error(`[Clients] Failed to queue onboarding:`, err);
      }

      return client;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        industry: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return prisma.client.update({
        where: { id, orgId: ctx.user.orgId },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verificar que el cliente pertenece a la organización
      const client = await prisma.client.findFirst({
        where: { id: input.id, orgId: ctx.user.orgId },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      // Eliminar en cascada: menciones, keywords, tareas relacionadas
      await prisma.$transaction([
        prisma.mention.deleteMany({ where: { clientId: input.id } }),
        prisma.keyword.deleteMany({ where: { clientId: input.id } }),
        prisma.task.deleteMany({ where: { clientId: input.id } }),
        prisma.client.delete({ where: { id: input.id } }),
      ]);

      return { success: true };
    }),

  addKeyword: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        word: z.string().min(1),
        type: z.enum(["NAME", "BRAND", "COMPETITOR", "TOPIC", "ALIAS"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify client belongs to user's org
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
      });
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }
      return prisma.keyword.create({
        data: input,
      });
    }),

  removeKeyword: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify keyword belongs to a client in user's org
      const keyword = await prisma.keyword.findFirst({
        where: { id: input.id, client: { orgId: ctx.user.orgId } },
      });
      if (!keyword) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keyword not found" });
      }
      return prisma.keyword.update({
        where: { id: input.id },
        data: { active: false },
      });
    }),

  // ==================== SPRINT 8: ONBOARDING MAGICO ====================

  /**
   * Busca noticias recientes en INTERNET usando Google Custom Search.
   * Primera fase del wizard de onboarding.
   */
  searchNews: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        industry: z.string().optional(),
        days: z.number().min(7).max(60).default(30),
      })
    )
    .mutation(async ({ input }) => {
      const { config } = await import("@mediabot/shared");

      const foundArticles: Array<{
        id: string;
        title: string;
        source: string;
        url: string;
        snippet?: string;
        publishedAt?: Date;
      }> = [];

      let searchedOnline = false;
      let googleError: string | null = null;

      // Solo intentar Google CSE si está configurado
      if (config.google.cseApiKey && config.google.cseCx) {
        const GOOGLE_CSE_API = "https://www.googleapis.com/customsearch/v1";

        // Construir queries de búsqueda
        const searchQueries = [
          `"${input.clientName}" noticias`,
          input.industry ? `"${input.clientName}" ${input.industry}` : null,
        ].filter(Boolean) as string[];

        for (const query of searchQueries) {
          try {
            const params = new URLSearchParams({
              key: config.google.cseApiKey,
              cx: config.google.cseCx,
              q: query,
              lr: "lang_es",
              sort: "date",
              num: "10",
              dateRestrict: `d${input.days}`, // Últimos N días
            });

            const response = await fetch(`${GOOGLE_CSE_API}?${params}`);

            if (!response.ok) {
              if (response.status === 429) {
                console.warn("[SearchNews] Google CSE rate limit reached");
                googleError = "Límite de búsquedas alcanzado. Usando solo artículos locales.";
                break;
              }
              if (response.status === 403) {
                console.warn("[SearchNews] Google CSE API key issue - falling back to DB search");
                googleError = "API de Google no disponible. Usando artículos locales.";
                break;
              }
              continue;
            }

            searchedOnline = true;

            const data = await response.json() as {
              items?: Array<{
                link: string;
                title: string;
                displayLink: string;
                snippet?: string;
                pagemap?: {
                  metatags?: Array<{ "article:published_time"?: string }>;
                };
              }>;
            };

            if (!data.items) continue;

            for (const item of data.items) {
              // Evitar duplicados por URL
              if (foundArticles.some((a) => a.url === item.link)) continue;

              // Intentar extraer fecha de publicación
              let publishedAt: Date | undefined;
              const metaDate = item.pagemap?.metatags?.[0]?.["article:published_time"];
              if (metaDate) {
                publishedAt = new Date(metaDate);
              }

              // Crear o encontrar el artículo en la base de datos
              let article = await prisma.article.findFirst({
                where: { url: item.link },
              });

              if (!article) {
                article = await prisma.article.create({
                  data: {
                    url: item.link,
                    title: item.title,
                    source: item.displayLink || "Google",
                    content: item.snippet || null,
                    publishedAt: publishedAt || null,
                  },
                });
              }

              foundArticles.push({
                id: article.id,
                title: item.title,
                source: item.displayLink || "Google",
                url: item.link,
                snippet: item.snippet,
                publishedAt,
              });
            }
          } catch (error) {
            console.error("[SearchNews] Google CSE error:", error);
            googleError = "Error al buscar en internet. Usando artículos locales.";
          }

          // Evitar rate limiting - pequeña pausa entre queries
          if (searchQueries.indexOf(query) < searchQueries.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      } else {
        console.warn("[SearchNews] Google CSE not configured");
        googleError = "Búsqueda en internet no configurada. Usando artículos locales.";
      }

      // Buscar en artículos existentes en la DB (siempre, como fallback o complemento)
      const since = subDays(new Date(), input.days);
      const dbArticles = await prisma.article.findMany({
        where: {
          publishedAt: { gte: since },
          OR: [
            { title: { contains: input.clientName, mode: "insensitive" } },
            { content: { contains: input.clientName, mode: "insensitive" } },
          ],
          // Excluir los que ya encontramos en Google
          id: { notIn: foundArticles.map((a) => a.id) },
        },
        select: {
          id: true,
          title: true,
          source: true,
          url: true,
          content: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
      });

      // Combinar resultados
      const allArticles = [
        ...foundArticles,
        ...dbArticles.map((a) => ({
          id: a.id,
          title: a.title,
          source: a.source,
          url: a.url,
          snippet: a.content?.slice(0, 300) || undefined,
          publishedAt: a.publishedAt || undefined,
        })),
      ];

      // Eliminar duplicados y limitar
      const uniqueArticles = allArticles.filter(
        (article, index, self) =>
          index === self.findIndex((a) => a.url === article.url)
      ).slice(0, 50);

      return {
        articles: uniqueArticles,
        total: uniqueArticles.length,
        searchTerm: input.clientName,
        since,
        searchedOnline,
        warning: googleError,
      };
    }),

  /**
   * Genera keywords y configuracion con IA basado en noticias encontradas.
   * Segunda fase del wizard de onboarding.
   */
  generateOnboardingConfig: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        description: z.string().optional(),
        industry: z.string().optional(),
        articles: z.array(
          z.object({
            title: z.string(),
            source: z.string(),
            snippet: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      // Llamar a la API de Claude para generar keywords
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const { config } = await import("@mediabot/shared");

      const anthropic = new Anthropic({
        apiKey: config.anthropic.apiKey,
      });

      const articlesContext = input.articles
        .slice(0, 15)
        .map(
          (a, i) =>
            `${i + 1}. "${a.title}" - ${a.source}${a.snippet ? `\n   ${a.snippet.slice(0, 200)}` : ""}`
        )
        .join("\n\n");

      const message = await anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `Eres un experto en monitoreo de medios y relaciones publicas en Mexico.
Analiza las siguientes noticias recientes sobre un cliente y genera una estrategia de monitoreo.

CLIENTE:
Nombre: ${input.clientName}
Descripcion: ${input.description || "No proporcionada"}
Industria: ${input.industry || "No especificada"}

NOTICIAS RECIENTES (${input.articles.length} articulos):
${articlesContext || "No se encontraron noticias recientes"}

Genera keywords y configuracion basada en estas noticias REALES.

Responde en JSON con este formato:
{
  "suggestedKeywords": [
    {
      "word": "palabra exacta",
      "type": "NAME|BRAND|COMPETITOR|TOPIC|ALIAS",
      "confidence": <0.5 a 1.0>,
      "reason": "Por que es relevante"
    }
  ],
  "competitors": [
    {"name": "Competidor", "reason": "Por que es competidor"}
  ],
  "sensitiveTopics": ["tema1", "tema2"],
  "industryContext": "Contexto de la industria",
  "monitoringStrategy": ["Estrategia 1", "Estrategia 2"]
}

IMPORTANTE: Genera 8-12 keywords variados basados en las noticias.
Solo responde con el JSON.`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al generar configuracion",
        });
      }

      try {
        // Extraer JSON de la respuesta
        const jsonMatch = content.text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1].trim() : content.text.trim();
        return JSON.parse(jsonText);
      } catch {
        console.error("[Onboarding] Parse error:", content.text.slice(0, 500));
        return {
          suggestedKeywords: [
            {
              word: input.clientName,
              type: "NAME",
              confidence: 1,
              reason: "Nombre del cliente",
            },
          ],
          competitors: [],
          sensitiveTopics: [],
          industryContext: "Configuracion manual requerida",
          monitoringStrategy: ["Agregar keywords manualmente"],
        };
      }
    }),

  /**
   * Crea un cliente con la configuracion completa del wizard.
   * Fase final del onboarding.
   */
  createWithOnboarding: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        industry: z.string().optional(),
        keywords: z.array(
          z.object({
            word: z.string(),
            type: z.enum(["NAME", "BRAND", "COMPETITOR", "TOPIC", "ALIAS"]),
          })
        ),
        competitors: z.array(z.string()).optional(),
        selectedArticleIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Crear cliente
      const client = await prisma.client.create({
        data: {
          name: input.name,
          description: input.description,
          industry: input.industry,
          orgId: ctx.user.orgId,
          onboarding: {
            completedAt: new Date().toISOString(),
            method: "wizard",
            keywordsCount: input.keywords.length,
            competitorsCount: input.competitors?.length || 0,
          },
        },
      });

      // Crear keywords
      if (input.keywords.length > 0) {
        await prisma.keyword.createMany({
          data: input.keywords.map((kw) => ({
            word: kw.word,
            type: kw.type,
            clientId: client.id,
            active: true,
          })),
          skipDuplicates: true,
        });
      }

      // Crear menciones de articulos seleccionados
      if (input.selectedArticleIds && input.selectedArticleIds.length > 0) {
        for (const articleId of input.selectedArticleIds) {
          try {
            await prisma.mention.create({
              data: {
                articleId,
                clientId: client.id,
                keywordMatched: input.name,
                sentiment: "NEUTRAL",
                relevance: 7,
              },
            });
          } catch {
            // Ignorar duplicados
          }
        }
      }

      return {
        client,
        keywordsCreated: input.keywords.length,
        mentionsCreated: input.selectedArticleIds?.length || 0,
      };
    }),

  compareCompetitors: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        include: { keywords: { where: { active: true } } },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      // Separate competitor keywords from client keywords
      const competitorKeywords = client.keywords.filter((k) => k.type === "COMPETITOR");
      const clientKeywords = client.keywords.filter((k) => k.type !== "COMPETITOR");

      // Get client's own mention count
      const clientMentions = await prisma.mention.count({
        where: {
          clientId: client.id,
          createdAt: { gte: since },
          keywordMatched: { in: clientKeywords.map((k) => k.word) },
        },
      });

      // Get client sentiment breakdown
      const clientSentiment = await prisma.mention.groupBy({
        by: ["sentiment"],
        where: {
          clientId: client.id,
          createdAt: { gte: since },
          keywordMatched: { in: clientKeywords.map((k) => k.word) },
        },
        _count: { id: true },
      });

      // Get stats for each competitor
      const competitorStats = await Promise.all(
        competitorKeywords.map(async (comp) => {
          const mentionCount = await prisma.mention.count({
            where: {
              clientId: client.id,
              createdAt: { gte: since },
              keywordMatched: comp.word,
            },
          });

          const sentimentBreakdown = await prisma.mention.groupBy({
            by: ["sentiment"],
            where: {
              clientId: client.id,
              keywordMatched: comp.word,
              createdAt: { gte: since },
            },
            _count: { id: true },
          });

          // Transform to object
          const sentiment = {
            positive: 0,
            negative: 0,
            neutral: 0,
            mixed: 0,
          };
          for (const s of sentimentBreakdown) {
            const key = s.sentiment.toLowerCase() as keyof typeof sentiment;
            if (key in sentiment) {
              sentiment[key] = s._count.id;
            }
          }

          return {
            name: comp.word,
            mentions: mentionCount,
            sentiment,
          };
        })
      );

      // Transform client sentiment
      const clientSentimentObj = {
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
      };
      for (const s of clientSentiment) {
        const key = s.sentiment.toLowerCase() as keyof typeof clientSentimentObj;
        if (key in clientSentimentObj) {
          clientSentimentObj[key] = s._count.id;
        }
      }

      return {
        client: {
          name: client.name,
          mentions: clientMentions,
          sentiment: clientSentimentObj,
        },
        competitors: competitorStats,
        period: { start: since, end: new Date() },
      };
    }),
});
