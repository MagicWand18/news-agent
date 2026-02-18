import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { runOnboarding } from "./ai.js";
import { isGenericKeyword } from "./keyword-stopwords.js";

/**
 * Busca noticias reales sobre el cliente en Google News + Bing News RSS.
 * Reutiliza las funciones del grounding-service.
 */
async function searchRealNews(
  clientName: string
): Promise<Array<{ title: string; url: string; source: string }>> {
  const results: Array<{ title: string; url: string; source: string }> = [];
  const seenUrls = new Set<string>();

  try {
    const { searchGoogleNewsRss, searchBingNewsRss } = await import(
      "../grounding/grounding-service.js"
    );

    const [googleResults, bingResults] = await Promise.allSettled([
      searchGoogleNewsRss(clientName),
      searchBingNewsRss(clientName),
    ]);

    const googleArticles = googleResults.status === "fulfilled" ? googleResults.value : [];
    const bingArticles = bingResults.status === "fulfilled" ? bingResults.value : [];

    if (googleResults.status === "rejected") {
      console.warn(`[Onboarding] Google News RSS failed:`, googleResults.reason);
    }
    if (bingResults.status === "rejected") {
      console.warn(`[Onboarding] Bing News RSS failed:`, bingResults.reason);
    }

    for (const article of [...googleArticles, ...bingArticles]) {
      if (seenUrls.has(article.url)) continue;
      seenUrls.add(article.url);
      results.push({
        title: article.title,
        url: article.url,
        source: article.source,
      });
      if (results.length >= 15) break;
    }

    console.log(`[Onboarding] Found ${results.length} real news articles for "${clientName}"`);
  } catch (error) {
    console.warn(`[Onboarding] Web search failed, continuing with DB articles:`, error);
  }

  return results;
}

export function startOnboardingWorker() {
  const worker = new Worker(
    QUEUE_NAMES.ONBOARDING,
    async (job) => {
      const { clientId } = job.data as { clientId: string };

      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
          keywords: { where: { active: true } },
          mentions: {
            take: 10,
            orderBy: { createdAt: "desc" },
            include: { article: true },
          },
        },
      });

      if (!client) {
        console.warn(`[Onboarding] Client ${clientId} not found`);
        return;
      }

      console.log(`[Onboarding] Running onboarding for client: ${client.name}`);

      // D1: Buscar noticias reales en la web
      const webArticles = await searchRealNews(client.name);

      // Combinar con artículos de la BD (deduplicar por URL)
      const dbArticles = client.mentions.map((m) => ({
        title: m.article.title,
        url: m.article.url,
        source: m.article.source,
      }));

      const seenUrls = new Set(webArticles.map((a) => a.url));
      const allArticles = [...webArticles];
      for (const a of dbArticles) {
        if (!seenUrls.has(a.url)) {
          allArticles.push(a);
          seenUrls.add(a.url);
        }
      }

      console.log(`[Onboarding] Total articles for AI: ${allArticles.length} (web: ${webArticles.length}, db: ${dbArticles.length})`);

      const result = await runOnboarding({
        clientName: client.name,
        description: client.description || "",
        industry: client.industry || "",
        recentArticles: allArticles.slice(0, 15),
      });

      // Save suggested keywords (skip duplicates, convert COMPETITOR to Competitor model)
      const existingWords = new Set(client.keywords.map((k) => k.word.toLowerCase()));

      const VALID_KEYWORD_TYPES = ["NAME", "BRAND", "TOPIC", "ALIAS"] as const;
      type KeywordType = (typeof VALID_KEYWORD_TYPES)[number];

      let acceptedCount = 0;
      let filteredCount = 0;

      for (const kw of result.suggestedKeywords) {
        if (existingWords.has(kw.word.toLowerCase())) continue;

        // Si AI genera tipo COMPETITOR, convertir a registro Competitor
        if (kw.type === "COMPETITOR") {
          try {
            const competitor = await prisma.competitor.upsert({
              where: { name_orgId: { name: kw.word, orgId: client.orgId } },
              create: { name: kw.word, orgId: client.orgId },
              update: {},
            });
            await prisma.clientCompetitor.upsert({
              where: { clientId_competitorId: { clientId: client.id, competitorId: competitor.id } },
              create: { clientId: client.id, competitorId: competitor.id },
              update: {},
            });
          } catch (err) {
            console.warn(`[Onboarding] Error creating competitor "${kw.word}":`, err);
          }
          continue;
        }

        // D4: Filtrar keywords genéricos con stopwords
        if (isGenericKeyword(kw.word)) {
          console.log(`[Onboarding] Filtered generic keyword: "${kw.word}"`);
          filteredCount++;
          continue;
        }

        // D4: Filtrar keywords con baja confianza
        const confidence = (kw as any).confidence;
        if (typeof confidence === "number" && confidence < 0.7) {
          console.log(`[Onboarding] Filtered low-confidence keyword: "${kw.word}" (${confidence.toFixed(2)})`);
          filteredCount++;
          continue;
        }

        const validType: KeywordType = VALID_KEYWORD_TYPES.includes(kw.type as KeywordType)
          ? (kw.type as KeywordType)
          : "TOPIC";

        await prisma.keyword.create({
          data: {
            word: kw.word,
            type: validType,
            clientId: client.id,
            active: true,
          },
        });
        acceptedCount++;
      }

      if (filteredCount > 0) {
        console.log(`[Onboarding] Filtered ${filteredCount} generic/low-confidence keywords`);
      }

      // Crear competidores identificados por AI como registros Competitor
      if (result.competitors && result.competitors.length > 0) {
        for (const compName of result.competitors) {
          try {
            const competitor = await prisma.competitor.upsert({
              where: { name_orgId: { name: compName, orgId: client.orgId } },
              create: { name: compName, orgId: client.orgId },
              update: {},
            });
            await prisma.clientCompetitor.upsert({
              where: { clientId_competitorId: { clientId: client.id, competitorId: competitor.id } },
              create: { clientId: client.id, competitorId: competitor.id },
              update: {},
            });
          } catch (err) {
            console.warn(`[Onboarding] Error creating competitor "${compName}":`, err);
          }
        }
      }

      // Store onboarding results in client JSON field
      await prisma.client.update({
        where: { id: clientId },
        data: {
          onboarding: {
            completedAt: new Date().toISOString(),
            competitors: result.competitors,
            sensitiveTopics: result.sensitiveTopics,
            actionLines: result.actionLines,
          },
        },
      });

      console.log(
        `[Onboarding] Completed for ${client.name}: ` +
        `${acceptedCount} keywords accepted, ${filteredCount} filtered, ` +
        `${result.competitors.length} competitors identified`
      );
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Onboarding job ${job?.id} failed:`, err);
  });

  console.log("🎓 Onboarding worker started");
}
