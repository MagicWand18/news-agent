import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { runOnboarding } from "./ai.js";

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

      const recentArticles = client.mentions.map((m) => ({
        title: m.article.title,
        url: m.article.url,
        source: m.article.source,
      }));

      const result = await runOnboarding({
        clientName: client.name,
        description: client.description || "",
        industry: client.industry || "",
        recentArticles,
      });

      // Save suggested keywords (skip duplicates)
      const existingWords = new Set(client.keywords.map((k) => k.word.toLowerCase()));

      for (const kw of result.suggestedKeywords) {
        if (existingWords.has(kw.word.toLowerCase())) continue;

        const VALID_KEYWORD_TYPES = ["NAME", "BRAND", "COMPETITOR", "TOPIC", "ALIAS"] as const;
        type KeywordType = (typeof VALID_KEYWORD_TYPES)[number];
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
        `${result.suggestedKeywords.length} keywords suggested, ` +
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
