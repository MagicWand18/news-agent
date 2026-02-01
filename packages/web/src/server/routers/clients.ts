import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  prisma,
  getOnboardingQueue,
  getGeminiModel,
  cleanJsonResponse,
  normalizeUrl,
  validateAndEnrichUrl,
  deduplicateUrls,
  config,
} from "@mediabot/shared";

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
            take: 50,
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
   * Busca noticias recientes en INTERNET usando Gemini con grounding.
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
      const { GoogleGenerativeAI } = await import("@google/generative-ai");

      // Estructura de un chunk de grounding (URL real de Google Search)
      interface GroundingChunk {
        web?: {
          uri: string;
          title?: string;
        };
      }

      // Extrae URLs reales del groundingMetadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function extractGroundingUrls(result: any): GroundingChunk[] {
        try {
          const candidate = result.response.candidates?.[0];
          if (!candidate) return [];
          const metadata = candidate.groundingMetadata;
          if (!metadata?.groundingChunks) return [];
          return metadata.groundingChunks as GroundingChunk[];
        } catch {
          return [];
        }
      }

      const foundArticles: Array<{
        id: string;
        title: string;
        source: string;
        url: string;
        snippet?: string;
        publishedAt?: Date;
        isHistorical?: boolean;
      }> = [];

      let searchedOnline = false;
      let googleError: string | null = null;
      // Fecha mínima aceptable para el período solicitado
      const minAcceptableDate = subDays(new Date(), input.days);

      // Usar Gemini con grounding para buscar noticias
      if (config.google.apiKey) {
        try {
          const genAI = new GoogleGenerativeAI(config.google.apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
            },
          });

          const industryContext = input.industry ? ` relacionadas con ${input.industry}` : "";
          const prompt = `Eres un investigador de medios. Busca entre 10 y 20 noticias recientes sobre "${input.clientName}"${industryContext}.

CRITERIOS DE BÚSQUEDA:
- Noticias de los últimos ${input.days} días
- Fuentes: periódicos mexicanos (El Universal, Milenio, Reforma, Excélsior, La Jornada, El Financiero, Forbes México, Expansión), agencias internacionales (Reuters, AFP, EFE), y medios digitales
- Incluir menciones directas e indirectas (competidores, industria, ejecutivos)
- Priorizar noticias con impacto mediático

Para cada noticia encontrada, incluye el título y un resumen breve.`;

          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }] as unknown as import("@google/generative-ai").Tool[],
          });

          const response = result.response;
          const text = response.text();

          // PRIMERO: Extraer URLs reales del groundingMetadata (fuente confiable)
          const rawChunks = extractGroundingUrls(result);

          // Deduplicar chunks usando normalización robusta
          const groundingChunks = deduplicateUrls(
            rawChunks.filter((chunk) => chunk.web?.uri),
            (chunk) => chunk.web!.uri
          );

          console.log(`[SearchNews] Found ${rawChunks.length} URLs in groundingMetadata, ${groundingChunks.length} unique`);

          searchedOnline = groundingChunks.length > 0;
          let skippedUrls = 0;

          for (const chunk of groundingChunks) {
            if (!chunk.web?.uri) continue;

            const url = chunk.web.uri;

            // Validar URL con retry y fallback, obtener título enriquecido
            const enriched = await validateAndEnrichUrl(url, chunk.web?.title, {
              retries: 2,
              timeout: 10000,
              detectSoft404: true,
            });

            if (!enriched.valid || !enriched.finalUrl) {
              skippedUrls++;
              console.warn(`[SearchNews] URL validation failed: ${enriched.error} - ${url.slice(0, 60)}...`);
              continue;
            }

            const finalUrl = enriched.finalUrl;

            // Verificar duplicados con normalización
            const normalizedFinalUrl = normalizeUrl(finalUrl);
            if (foundArticles.some((a) => normalizeUrl(a.url) === normalizedFinalUrl)) continue;

            const source = enriched.source;
            const title = enriched.title;

            console.log(`[SearchNews] Title for ${source}: ${title.slice(0, 60)}`);

            // Crear o actualizar el artículo en la base de datos
            let article = await prisma.article.findFirst({
              where: { url: finalUrl },
            });

            if (!article) {
              article = await prisma.article.create({
                data: {
                  url: finalUrl,
                  title,
                  source,
                  content: null,
                  publishedAt: null,
                },
              });
            } else if (!enriched.isGenericTitle && title.length > 20) {
              // Actualizar título si tenemos uno mejor (no genérico)
              article = await prisma.article.update({
                where: { id: article.id },
                data: { title, source },
              });
            }

            foundArticles.push({
              id: article.id,
              title,
              source,
              url: finalUrl,
              snippet: article.content?.slice(0, 300) || undefined,
              publishedAt: article.publishedAt || undefined,
              isHistorical: false,
            });
          }

          if (skippedUrls > 0) {
            console.log(`[SearchNews] Skipped ${skippedUrls} articles with invalid/unreachable URLs`);
          }
          console.log(`[SearchNews] Processed ${foundArticles.length} articles from groundingMetadata`);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error("[SearchNews] Gemini search error:", errMsg);
          // Proporcionar mensaje más específico según el tipo de error
          if (errMsg.includes("503") || errMsg.includes("Service Unavailable")) {
            googleError = "El servicio de búsqueda está temporalmente no disponible. Intenta de nuevo en unos minutos.";
          } else if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("API key")) {
            googleError = "Error de autenticación con el servicio de búsqueda. Contacta al administrador.";
          } else if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate")) {
            googleError = "Se alcanzó el límite de búsquedas. Intenta más tarde.";
          } else {
            googleError = "Error al buscar en internet. Usando artículos locales.";
          }
        }
      } else {
        console.warn("[SearchNews] GOOGLE_API_KEY not configured");
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

      // Combinar resultados (artículos de DB ya están filtrados por fecha, no son históricos)
      const allArticles = [
        ...foundArticles,
        ...dbArticles.map((a) => ({
          id: a.id,
          title: a.title,
          source: a.source,
          url: a.url,
          snippet: a.content?.slice(0, 300) || undefined,
          publishedAt: a.publishedAt || undefined,
          isHistorical: false,
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
      // Llamar a Gemini para generar keywords
      const articlesContext = input.articles
        .slice(0, 15)
        .map(
          (a, i) =>
            `${i + 1}. "${a.title}" - ${a.source}${a.snippet ? `\n   ${a.snippet.slice(0, 200)}` : ""}`
        )
        .join("\n\n");

      const model = getGeminiModel();

      const prompt = `Eres un experto en monitoreo de medios y relaciones publicas en Mexico.
Analiza las siguientes noticias recientes sobre un cliente y genera una estrategia de monitoreo.

CLIENTE:
Nombre: ${input.clientName}
Descripcion: ${input.description || "No proporcionada"}
Industria: ${input.industry || "No especificada"}

NOTICIAS RECIENTES (${input.articles.length} articulos):
${articlesContext || "No se encontraron noticias recientes"}

Genera keywords y configuracion basada en estas noticias REALES.

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "suggestedKeywords": [
    {"word": "palabra exacta", "type": "NAME", "confidence": 0.95, "reason": "Por que es relevante"}
  ],
  "competitors": [
    {"name": "Competidor", "reason": "Por que es competidor"}
  ],
  "sensitiveTopics": ["tema1", "tema2"],
  "industryContext": "Contexto de la industria",
  "monitoringStrategy": ["Estrategia 1", "Estrategia 2"]
}

Tipos validos para keywords: NAME, BRAND, COMPETITOR, TOPIC, ALIAS

IMPORTANTE: Genera 8-12 keywords variados basados en las noticias.`;

      try {
        const genResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
        });

        const rawText = genResult.response.text();
        const jsonText = cleanJsonResponse(rawText);
        return JSON.parse(jsonText);
      } catch (error) {
        console.error("[Onboarding] Parse error:", error);
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
        // Redes sociales
        socialMonitoringEnabled: z.boolean().optional(),
        socialHashtags: z.array(z.string()).optional(),
        socialAccounts: z.array(
          z.object({
            platform: z.enum(["TWITTER", "INSTAGRAM", "TIKTOK"]),
            handle: z.string(),
            label: z.string().optional(),
            isOwned: z.boolean().default(false),
          })
        ).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Limpiar hashtags (quitar # si viene)
      const cleanHashtags = (input.socialHashtags || []).map((h) => h.replace(/^#/, ""));

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
            socialEnabled: input.socialMonitoringEnabled || false,
          },
          // Redes sociales
          socialMonitoringEnabled: input.socialMonitoringEnabled || false,
          socialHashtags: cleanHashtags,
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

      // Crear keywords de competidores
      if (input.competitors && input.competitors.length > 0) {
        await prisma.keyword.createMany({
          data: input.competitors.map((comp) => ({
            word: comp,
            type: "COMPETITOR",
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

      // Crear cuentas de redes sociales
      let socialAccountsCreated = 0;
      if (input.socialAccounts && input.socialAccounts.length > 0) {
        for (const account of input.socialAccounts) {
          try {
            await prisma.socialAccount.create({
              data: {
                clientId: client.id,
                platform: account.platform,
                handle: account.handle.replace(/^@/, ""),
                label: account.label || null,
                isOwned: account.isOwned,
              },
            });
            socialAccountsCreated++;
          } catch {
            // Ignorar duplicados
          }
        }
      }

      return {
        client,
        keywordsCreated: input.keywords.length,
        mentionsCreated: input.selectedArticleIds?.length || 0,
        socialAccountsCreated,
        socialHashtagsCount: cleanHashtags.length,
      };
    }),

  // ==================== GROUNDING CONFIG ====================

  /**
   * Obtiene la configuración de grounding de un cliente.
   */
  getGroundingConfig: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        select: {
          id: true,
          name: true,
          industry: true,
          groundingEnabled: true,
          minDailyMentions: true,
          consecutiveDaysThreshold: true,
          groundingArticleCount: true,
          weeklyGroundingEnabled: true,
          weeklyGroundingDay: true,
          lastGroundingAt: true,
          lastGroundingResult: true,
        },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      return client;
    }),

  /**
   * Actualiza la configuración de grounding de un cliente.
   */
  updateGroundingConfig: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        groundingEnabled: z.boolean().optional(),
        minDailyMentions: z.number().min(1).max(20).optional(),
        consecutiveDaysThreshold: z.number().min(1).max(10).optional(),
        groundingArticleCount: z.number().min(5).max(30).optional(),
        weeklyGroundingEnabled: z.boolean().optional(),
        weeklyGroundingDay: z.number().min(0).max(6).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { clientId, ...data } = input;

      // Verificar que el cliente pertenece a la organización
      const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: ctx.user.orgId },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      return prisma.client.update({
        where: { id: clientId },
        data,
        select: {
          id: true,
          groundingEnabled: true,
          minDailyMentions: true,
          consecutiveDaysThreshold: true,
          groundingArticleCount: true,
          weeklyGroundingEnabled: true,
          weeklyGroundingDay: true,
        },
      });
    }),

  /**
   * Ejecuta una búsqueda de grounding manual para un cliente.
   */
  executeManualGrounding: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        days: z.number().min(7).max(60).default(30),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        select: {
          id: true,
          name: true,
          industry: true,
          groundingArticleCount: true,
        },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      // Encolar el job de grounding
      try {
        const { getQueue } = await import("@mediabot/shared");
        const groundingQueue = getQueue("grounding-execute");
        await groundingQueue.add(
          "manual-grounding",
          {
            clientId: client.id,
            clientName: client.name,
            industry: client.industry,
            days: input.days,
            articleCount: client.groundingArticleCount || 10,
            trigger: "manual",
          },
          {
            attempts: 2,
            backoff: { type: "exponential", delay: 5000 },
          }
        );

        return {
          success: true,
          message: `Búsqueda iniciada para ${client.name}. Los resultados aparecerán en unos momentos.`,
          queued: true,
        };
      } catch (err) {
        console.error("[ManualGrounding] Queue error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al iniciar la búsqueda. Intenta de nuevo.",
        });
      }
    }),

  // ==================== TELEGRAM RECIPIENTS ====================

  /**
   * Obtiene los destinatarios de Telegram de un cliente.
   */
  getRecipients: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Verificar que el cliente pertenece a la organización
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
        select: {
          id: true,
          telegramGroupId: true,
          clientGroupId: true,
        },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const recipients = await prisma.telegramRecipient.findMany({
        where: { clientId: input.clientId },
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
      });

      return {
        recipients,
        // Info legacy para compatibilidad
        legacyGroupId: client.telegramGroupId,
        legacyClientGroupId: client.clientGroupId,
      };
    }),

  /**
   * Agrega un destinatario de Telegram a un cliente.
   */
  addRecipient: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        chatId: z.string().min(1),
        type: z.enum(["AGENCY_INTERNAL", "CLIENT_GROUP", "CLIENT_INDIVIDUAL"]),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verificar que el cliente pertenece a la organización
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, orgId: ctx.user.orgId },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      // Verificar si ya existe (activo o inactivo)
      const existing = await prisma.telegramRecipient.findUnique({
        where: {
          clientId_chatId: {
            clientId: input.clientId,
            chatId: input.chatId,
          },
        },
      });

      if (existing) {
        // Reactivar si estaba inactivo
        if (!existing.active) {
          return prisma.telegramRecipient.update({
            where: { id: existing.id },
            data: {
              active: true,
              type: input.type,
              label: input.label || existing.label,
              addedBy: ctx.user.id,
            },
          });
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este destinatario ya existe para este cliente",
        });
      }

      const recipient = await prisma.telegramRecipient.create({
        data: {
          clientId: input.clientId,
          chatId: input.chatId,
          type: input.type,
          label: input.label,
          addedBy: ctx.user.id,
        },
      });

      // Actualizar campos legacy para compatibilidad
      if (input.type === "AGENCY_INTERNAL" && !client.telegramGroupId) {
        await prisma.client.update({
          where: { id: client.id },
          data: { telegramGroupId: input.chatId },
        });
      } else if (input.type === "CLIENT_GROUP" && !client.clientGroupId) {
        await prisma.client.update({
          where: { id: client.id },
          data: { clientGroupId: input.chatId },
        });
      }

      return recipient;
    }),

  /**
   * Actualiza un destinatario de Telegram.
   */
  updateRecipient: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        active: z.boolean().optional(),
        type: z.enum(["AGENCY_INTERNAL", "CLIENT_GROUP", "CLIENT_INDIVIDUAL"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      // Verificar que el recipient pertenece a un cliente de la organización
      const recipient = await prisma.telegramRecipient.findFirst({
        where: {
          id,
          client: { orgId: ctx.user.orgId },
        },
        include: { client: true },
      });

      if (!recipient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Destinatario no encontrado" });
      }

      const updated = await prisma.telegramRecipient.update({
        where: { id },
        data,
      });

      // Si se desactiva, limpiar campos legacy si corresponden
      if (data.active === false) {
        if (recipient.type === "AGENCY_INTERNAL" && recipient.client.telegramGroupId === recipient.chatId) {
          await prisma.client.update({
            where: { id: recipient.clientId },
            data: { telegramGroupId: null },
          });
        } else if (recipient.type === "CLIENT_GROUP" && recipient.client.clientGroupId === recipient.chatId) {
          await prisma.client.update({
            where: { id: recipient.clientId },
            data: { clientGroupId: null },
          });
        }
      }

      return updated;
    }),

  /**
   * Elimina un destinatario de Telegram (soft delete).
   */
  removeRecipient: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verificar que el recipient pertenece a un cliente de la organización
      const recipient = await prisma.telegramRecipient.findFirst({
        where: {
          id: input.id,
          client: { orgId: ctx.user.orgId },
        },
        include: { client: true },
      });

      if (!recipient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Destinatario no encontrado" });
      }

      // Soft delete
      await prisma.telegramRecipient.update({
        where: { id: input.id },
        data: { active: false },
      });

      // Limpiar campos legacy si corresponden
      if (recipient.type === "AGENCY_INTERNAL" && recipient.client.telegramGroupId === recipient.chatId) {
        await prisma.client.update({
          where: { id: recipient.clientId },
          data: { telegramGroupId: null },
        });
      } else if (recipient.type === "CLIENT_GROUP" && recipient.client.clientGroupId === recipient.chatId) {
        await prisma.client.update({
          where: { id: recipient.clientId },
          data: { clientGroupId: null },
        });
      }

      return { success: true };
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
