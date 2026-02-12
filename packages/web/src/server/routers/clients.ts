import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, getOrgFilter, getEffectiveOrgId, buildOrgCondition, buildClientOrgCondition } from "../trpc";
import {
  prisma,
  getOnboardingQueue,
  getGeminiModel,
  cleanJsonResponse,
  normalizeUrl,
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

/**
 * Schema Zod para validar respuesta de generateOnboardingConfig.
 */
const OnboardingConfigSchema = z.object({
  suggestedKeywords: z.array(
    z.object({
      word: z.string(),
      type: z.enum(["NAME", "BRAND", "TOPIC", "ALIAS"]),
      confidence: z.number().min(0).max(1).optional(),
      reason: z.string().optional(),
    })
  ).default([]),
  competitors: z.array(
    z.object({
      name: z.string(),
      reason: z.string().optional(),
    })
  ).default([]),
  sensitiveTopics: z.array(z.string()).default([]),
  industryContext: z.string().default(""),
  monitoringStrategy: z.array(z.string()).default([]),
});

export const clientsRouter = router({
  list: protectedProcedure
    .input(z.object({ orgId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgFilter = getOrgFilter(ctx.user, input?.orgId);
      return prisma.client.findMany({
        where: orgFilter,
        include: {
          _count: {
            select: {
              keywords: { where: { active: true } },
              mentions: true,
              tasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
            },
          },
          // Incluir org para Super Admin que ve múltiples orgs
          org: ctx.user.isSuperAdmin ? { select: { id: true, name: true } } : false,
        },
        orderBy: { name: "asc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Super Admin puede ver cualquier cliente
      return prisma.client.findFirst({
        where: {
          id: input.id,
          ...(ctx.user.isSuperAdmin ? {} : { orgId: ctx.user.orgId! }),
        },
        include: {
          keywords: { where: { active: true }, orderBy: { type: "asc" } },
          competitors: {
            include: { competitor: true },
            orderBy: { createdAt: "asc" },
          },
          mentions: {
            include: { article: true },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          _count: { select: { mentions: true, tasks: true } },
          org: ctx.user.isSuperAdmin ? { select: { id: true, name: true } } : false,
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        industry: z.string().max(100).optional(),
        orgId: z.string().optional(), // Super Admin puede especificar org
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Determinar orgId: Super Admin puede especificar, usuario normal usa el suyo
      let targetOrgId = getEffectiveOrgId(ctx.user, input.orgId) || ctx.user.orgId;

      // Super Admin sin org asignada: buscar org "Default", luego primera disponible
      if (!targetOrgId) {
        const defaultOrg = await prisma.organization.findFirst({
          where: { name: "Default" },
          select: { id: true },
        });
        targetOrgId = defaultOrg?.id || null;
        if (!targetOrgId) {
          const firstOrg = await prisma.organization.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
          targetOrgId = firstOrg?.id || null;
        }
      }

      if (!targetOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debe especificar una organización",
        });
      }

      // Validar que la organización exista y verificar límite de clientes
      const org = await prisma.organization.findUnique({
        where: { id: targetOrgId },
        select: {
          maxClients: true,
          _count: { select: { clients: true } },
        },
      });

      if (!org) {
        console.error(`[create] Org no encontrada. targetOrgId=${targetOrgId}, user.orgId=${ctx.user.orgId}, user.id=${ctx.user.id}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tu organización no existe. Por favor cierra sesión e inicia de nuevo.",
        });
      }

      if (org.maxClients !== null && org.maxClients !== undefined) {
        if (org._count.clients >= org.maxClients) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Esta organización ha alcanzado su límite de ${org.maxClients} cliente(s). Contacta al administrador.`,
          });
        }
      }

      const client = await prisma.client.create({
        data: {
          name: input.name,
          description: input.description,
          industry: input.industry,
          orgId: targetOrgId,
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
      // Super Admin puede actualizar cualquier cliente
      return prisma.client.update({
        where: {
          id,
          ...(ctx.user.isSuperAdmin ? {} : { orgId: ctx.user.orgId! }),
        },
        data,
      });
    }),

  /**
   * Transferir cliente a otra organización (solo Super Admin)
   */
  transferClient: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        newOrgId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Solo Super Admin puede transferir clientes
      if (!ctx.user.isSuperAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo Super Admin puede transferir clientes entre organizaciones",
        });
      }

      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: input.clientId },
        select: { id: true, name: true, orgId: true },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      // Verificar que la organización destino existe
      const targetOrg = await prisma.organization.findUnique({
        where: { id: input.newOrgId },
        select: { id: true, name: true },
      });

      if (!targetOrg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organización destino no encontrada" });
      }

      // No hacer nada si ya pertenece a esa organización
      if (client.orgId === input.newOrgId) {
        return { success: true, message: "El cliente ya pertenece a esta organización" };
      }

      // Transferir el cliente
      await prisma.client.update({
        where: { id: input.clientId },
        data: { orgId: input.newOrgId },
      });

      return {
        success: true,
        message: `Cliente "${client.name}" transferido a "${targetOrg.name}"`,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verificar que el cliente pertenece a la organización (o es Super Admin)
      const client = await prisma.client.findFirst({
        where: {
          id: input.id,
          ...(ctx.user.isSuperAdmin ? {} : { orgId: ctx.user.orgId! }),
        },
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
        type: z.enum(["NAME", "BRAND", "TOPIC", "ALIAS"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Super Admin puede agregar keywords a cualquier cliente
      const client = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          ...(ctx.user.isSuperAdmin ? {} : { orgId: ctx.user.orgId! }),
        },
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
      // Super Admin puede eliminar keywords de cualquier cliente
      const keyword = await prisma.keyword.findFirst({
        where: {
          id: input.id,
          ...(ctx.user.isSuperAdmin ? {} : { client: { orgId: ctx.user.orgId! } }),
        },
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
   * Busca noticias recientes en Google News RSS.
   * Primera fase del wizard de onboarding.
   */
  searchNews: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1).max(100),
        industry: z.string().max(100).optional(),
        days: z.number().min(7).max(60).default(30),
      })
    )
    .mutation(async ({ input }) => {
      const Parser = (await import("rss-parser")).default;

      const parser = new Parser({
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MediaBot/1.0)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      });

      /**
       * Extrae el nombre de la fuente del título de Google News RSS.
       */
      function extractSource(title: string): string {
        const parts = title.split(" - ");
        return parts.length > 1 ? parts[parts.length - 1].trim() : "Google News";
      }

      function cleanTitle(title: string): string {
        const parts = title.split(" - ");
        return parts.length > 1 ? parts.slice(0, -1).join(" - ").trim() : title;
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
      let searchError: string | null = null;
      const seenUrls = new Set<string>();

      /**
       * Extrae la URL real del wrapper de redirect de Bing News.
       */
      function extractBingUrl(bingUrl: string): string {
        try {
          const u = new URL(bingUrl);
          const realUrl = u.searchParams.get("url");
          if (realUrl) return realUrl;
        } catch { /* ignorar */ }
        return bingUrl;
      }

      /**
       * Procesa items RSS y los agrega a foundArticles.
       */
      async function processRssItems(
        items: Array<{ link?: string; title?: string; creator?: string; contentSnippet?: string; pubDate?: string }>,
        sourceType: "google" | "bing"
      ) {
        for (const item of items) {
          if (!item.link || !item.title) continue;

          const url = sourceType === "bing" ? extractBingUrl(item.link) : item.link;
          const normalizedFinalUrl = normalizeUrl(url);
          if (seenUrls.has(normalizedFinalUrl)) continue;
          seenUrls.add(normalizedFinalUrl);

          let bingSource = "Bing News";
          if (sourceType === "bing") {
            try { bingSource = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignorar */ }
          }
          const source = sourceType === "bing"
            ? bingSource
            : (item.creator || extractSource(item.title));
          const title = sourceType === "google" ? cleanTitle(item.title) : item.title;
          const publishedAt = item.pubDate ? new Date(item.pubDate) : undefined;
          const snippet = item.contentSnippet || undefined;

          let article = await prisma.article.findFirst({ where: { url } });
          if (!article) {
            article = await prisma.article.create({
              data: { url, title, source, content: snippet || null, publishedAt: publishedAt || null },
            });
          }

          foundArticles.push({ id: article.id, title, source, url, snippet, publishedAt, isHistorical: false });
        }
      }

      try {
        // Buscar en Google News RSS + Bing News RSS en paralelo
        const query = encodeURIComponent(`"${input.clientName}"`);
        const googleUrl = `https://news.google.com/rss/search?q=${query}&hl=es-419&gl=MX&ceid=MX:es-419`;
        const bingUrl = `https://www.bing.com/news/search?q=${query}&format=rss`;

        const [googleResult, bingResult] = await Promise.allSettled([
          parser.parseURL(googleUrl),
          parser.parseURL(bingUrl),
        ]);

        const googleItems = googleResult.status === "fulfilled" ? (googleResult.value.items || []) : [];
        const bingItems = bingResult.status === "fulfilled" ? (bingResult.value.items || []) : [];

        if (googleResult.status === "rejected") {
          console.warn(`[SearchNews] Google News RSS failed: ${googleResult.reason}`);
        }
        if (bingResult.status === "rejected") {
          console.warn(`[SearchNews] Bing News RSS failed: ${bingResult.reason}`);
        }

        console.log(`[SearchNews] Google: ${googleItems.length}, Bing: ${bingItems.length} results for "${input.clientName}"`);
        searchedOnline = googleItems.length > 0 || bingItems.length > 0;

        await processRssItems(googleItems, "google");
        await processRssItems(bingItems, "bing");

        console.log(`[SearchNews] Processed ${foundArticles.length} articles from Google + Bing News RSS`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[SearchNews] RSS search error:", errMsg);
        searchError = "Error al buscar noticias. Usando artículos locales.";
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
        warning: searchError,
      };
    }),

  /**
   * Genera keywords y configuracion con IA basado en noticias encontradas.
   * Segunda fase del wizard de onboarding.
   */
  generateOnboardingConfig: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        industry: z.string().max(100).optional(),
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

Tipos validos para keywords: NAME, BRAND, TOPIC, ALIAS
Los competidores van en el array "competitors", NO como keywords.

IMPORTANTE: Genera 8-12 keywords variados basados en las noticias.`;

      const fallbackConfig = {
        suggestedKeywords: [
          {
            word: input.clientName,
            type: "NAME" as const,
            confidence: 1,
            reason: "Nombre del cliente",
          },
        ],
        competitors: [],
        sensitiveTopics: [],
        industryContext: "Configuracion manual requerida",
        monitoringStrategy: ["Agregar keywords manualmente"],
      };

      try {
        const genResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
        });

        const rawText = genResult.response.text();
        const jsonText = cleanJsonResponse(rawText);
        const parsed = JSON.parse(jsonText);

        // Validar con Zod para evitar datos malformados
        const result = OnboardingConfigSchema.safeParse(parsed);
        if (!result.success) {
          console.error("[Onboarding] Zod validation error:", result.error.message);
          return fallbackConfig;
        }
        return result.data;
      } catch (error) {
        console.error("[Onboarding] Parse error:", error);
        return fallbackConfig;
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
            type: z.enum(["NAME", "BRAND", "TOPIC", "ALIAS"]),
          })
        ),
        competitors: z.array(z.string()).optional(),
        selectedArticleIds: z.array(z.string()).optional(),
        // Redes sociales
        socialMonitoringEnabled: z.boolean().optional(),
        socialHashtags: z.array(z.string()).optional(),
        socialAccounts: z.array(
          z.object({
            platform: z.enum(["TWITTER", "INSTAGRAM", "TIKTOK", "YOUTUBE"]),
            handle: z.string(),
            label: z.string().optional(),
            isOwned: z.boolean().default(false),
          })
        ).optional(),
        orgId: z.string().optional(), // Super Admin puede especificar org
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Limpiar hashtags (quitar # si viene)
      const cleanHashtags = (input.socialHashtags || []).map((h) => h.replace(/^#/, ""));

      // Determinar orgId: Super Admin puede especificar, usuario normal usa el suyo
      let targetOrgId = getEffectiveOrgId(ctx.user, input.orgId) || ctx.user.orgId;

      // Super Admin sin org asignada: buscar org "Default", luego primera disponible
      if (!targetOrgId) {
        const defaultOrg = await prisma.organization.findFirst({
          where: { name: "Default" },
          select: { id: true },
        });
        targetOrgId = defaultOrg?.id || null;
        if (!targetOrgId) {
          const firstOrg = await prisma.organization.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
          targetOrgId = firstOrg?.id || null;
        }
      }

      if (!targetOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debe especificar una organización",
        });
      }

      // Validar que la organización exista antes de crear el cliente
      const org = await prisma.organization.findUnique({
        where: { id: targetOrgId },
        select: { id: true, name: true, maxClients: true, _count: { select: { clients: true } } },
      });

      if (!org) {
        console.error(`[createWithOnboarding] Org no encontrada. targetOrgId=${targetOrgId}, user.orgId=${ctx.user.orgId}, user.id=${ctx.user.id}, input.orgId=${input.orgId}`);
        // Intentar refrescar orgId desde la DB del usuario actual
        const freshUser = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { orgId: true },
        });
        if (freshUser?.orgId) {
          const freshOrg = await prisma.organization.findUnique({
            where: { id: freshUser.orgId },
            select: { id: true },
          });
          if (freshOrg) {
            targetOrgId = freshUser.orgId;
            console.log(`[createWithOnboarding] Usando orgId fresco de la DB: ${targetOrgId}`);
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Tu organización no existe. Por favor cierra sesión e inicia de nuevo.",
            });
          }
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No se encontró tu organización. Por favor cierra sesión e inicia de nuevo.",
          });
        }
      }

      // Validar límite de clientes de la organización
      if (org && org.maxClients !== null && org.maxClients !== undefined) {
        if (org._count.clients >= org.maxClients) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Esta organización ha alcanzado su límite de ${org.maxClients} cliente(s). Contacta al administrador.`,
          });
        }
      }

      // Crear cliente
      const client = await prisma.client.create({
        data: {
          name: input.name,
          description: input.description,
          industry: input.industry,
          orgId: targetOrgId,
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

      // Crear competidores como registros Competitor + ClientCompetitor
      if (input.competitors && input.competitors.length > 0) {
        for (const compName of input.competitors) {
          const competitor = await prisma.competitor.upsert({
            where: { name_orgId: { name: compName, orgId: targetOrgId } },
            create: { name: compName, orgId: targetOrgId },
            update: {},
          });
          await prisma.clientCompetitor.upsert({
            where: { clientId_competitorId: { clientId: client.id, competitorId: competitor.id } },
            create: { clientId: client.id, competitorId: competitor.id },
            update: {},
          });
        }
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
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({
        where: whereClause,
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

      // Verificar que el cliente pertenece a la organización (o es Super Admin)
      const whereClause = ctx.user.isSuperAdmin
        ? { id: clientId }
        : { id: clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({ where: whereClause });

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
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({
        where: whereClause,
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
      // Verificar que el cliente pertenece a la organización (o es Super Admin)
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({
        where: whereClause,
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
      // Verificar que el cliente pertenece a la organización (o es Super Admin)
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({ where: whereClause });

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

      // Verificar que el recipient pertenece a un cliente de la organización (o es Super Admin)
      const whereClause = ctx.user.isSuperAdmin
        ? { id }
        : { id, client: { orgId: ctx.user.orgId! } };
      const recipient = await prisma.telegramRecipient.findFirst({
        where: whereClause,
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
      // Verificar que el recipient pertenece a un cliente de la organización (o es Super Admin)
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.id }
        : { id: input.id, client: { orgId: ctx.user.orgId! } };
      const recipient = await prisma.telegramRecipient.findFirst({
        where: whereClause,
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
      const whereClause = ctx.user.isSuperAdmin
        ? { id: input.clientId }
        : { id: input.clientId, orgId: ctx.user.orgId! };
      const client = await prisma.client.findFirst({
        where: whereClause,
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      // Conteo de menciones del cliente
      const clientMentions = await prisma.mention.count({
        where: {
          clientId: client.id,
          createdAt: { gte: since },
        },
      });

      // Obtener competidores del modelo Competitor
      const clientCompetitors = await prisma.clientCompetitor.findMany({
        where: { clientId: client.id },
        include: { competitor: true },
      });

      // Buscar presencia de cada competidor en artículos (por nombre en título/contenido)
      const competitorStats = await Promise.all(
        clientCompetitors.map(async (cc) => {
          const articleCount = await prisma.article.count({
            where: {
              collectedAt: { gte: since },
              OR: [
                { title: { contains: cc.competitor.name, mode: "insensitive" } },
                { content: { contains: cc.competitor.name, mode: "insensitive" } },
              ],
            },
          });

          return {
            id: cc.competitor.id,
            name: cc.competitor.name,
            articles: articleCount,
          };
        })
      );

      return {
        client: {
          name: client.name,
          mentions: clientMentions,
        },
        competitors: competitorStats,
        period: { start: since, end: new Date() },
      };
    }),

  // ==================== COMPETITOR MANAGEMENT ====================

  addCompetitor: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        name: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          ...(ctx.user.isSuperAdmin ? {} : { orgId: ctx.user.orgId! }),
        },
      });
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      // Upsert Competitor a nivel org
      const competitor = await prisma.competitor.upsert({
        where: { name_orgId: { name: input.name, orgId: client.orgId } },
        create: { name: input.name, orgId: client.orgId },
        update: {},
      });

      // Crear vínculo con el cliente
      await prisma.clientCompetitor.upsert({
        where: { clientId_competitorId: { clientId: client.id, competitorId: competitor.id } },
        create: { clientId: client.id, competitorId: competitor.id },
        update: {},
      });

      return competitor;
    }),

  removeCompetitor: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        competitorId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          ...(ctx.user.isSuperAdmin ? {} : { orgId: ctx.user.orgId! }),
        },
      });
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      await prisma.clientCompetitor.deleteMany({
        where: {
          clientId: input.clientId,
          competitorId: input.competitorId,
        },
      });

      return { success: true };
    }),

  listOrgCompetitors: protectedProcedure
    .input(z.object({ clientId: z.string() }).optional())
    .query(async ({ ctx }) => {
      const orgId = ctx.user.orgId;
      if (!orgId && !ctx.user.isSuperAdmin) {
        return [];
      }

      return prisma.competitor.findMany({
        where: orgId ? { orgId } : {},
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    }),
});
