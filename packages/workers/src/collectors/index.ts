import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { collectGdelt } from "./gdelt.js";
import { collectNewsdata } from "./newsdata.js";
import { collectRss } from "./rss.js";
import { collectGoogle } from "./google.js";
import { collectSocial, collectSocialForClient } from "./social.js";
import { collectGnews } from "./gnews.js";
import type { NormalizedArticle } from "@mediabot/shared";

function withErrorLogging(worker: Worker, name: string) {
  worker.on("failed", (job, err) => {
    console.error(`❌ [${name}] Job ${job?.id} failed:`, err.message);
  });
  worker.on("error", (err) => {
    console.error(`❌ [${name}] Worker error:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`✅ [${name}] Job ${job?.id} completed`);
  });
  return worker;
}

export function startCollectorWorkers(_queues: ReturnType<typeof import("../queues.js").setupQueues>) {
  const ingestQueue = getQueue(QUEUE_NAMES.INGEST_ARTICLE);

  const enqueueArticles = async (articles: NormalizedArticle[], source: string) => {
    console.log(`📥 ${source}: ${articles.length} articles collected`);
    for (const article of articles) {
      try {
        await ingestQueue.add("ingest", { article, source }, {
          jobId: `article-${Buffer.from(article.url).toString("base64url").slice(0, 50)}`,
        });
      } catch (err) {
        console.error(`❌ Failed to enqueue article: ${article.url}`, err);
      }
    }
  };

  // GDELT Worker
  withErrorLogging(new Worker(
    QUEUE_NAMES.COLLECT_GDELT,
    async () => {
      const articles = await collectGdelt();
      await enqueueArticles(articles, "GDELT");
    },
    { connection, concurrency: 1 }
  ), "GDELT");

  // NewsData Worker
  withErrorLogging(new Worker(
    QUEUE_NAMES.COLLECT_NEWSDATA,
    async () => {
      const articles = await collectNewsdata();
      await enqueueArticles(articles, "NewsData");
    },
    { connection, concurrency: 1 }
  ), "NewsData");

  // RSS Worker
  withErrorLogging(new Worker(
    QUEUE_NAMES.COLLECT_RSS,
    async () => {
      const articles = await collectRss();
      await enqueueArticles(articles, "RSS");
    },
    { connection, concurrency: 1 }
  ), "RSS");

  // Google CSE Worker
  withErrorLogging(new Worker(
    QUEUE_NAMES.COLLECT_GOOGLE,
    async () => {
      const articles = await collectGoogle();
      await enqueueArticles(articles, "GoogleCSE");
    },
    { connection, concurrency: 1 }
  ), "GoogleCSE");

  // Social Media Worker
  withErrorLogging(new Worker(
    QUEUE_NAMES.COLLECT_SOCIAL,
    async (job) => {
      // Si viene un clientId, recolectar solo para ese cliente
      const {
        clientId,
        manual,
        platforms,
        collectHandles,
        collectHashtags,
      } = job.data as {
        clientId?: string;
        manual?: boolean;
        platforms?: ("TWITTER" | "INSTAGRAM" | "TIKTOK")[];
        collectHandles?: boolean;
        collectHashtags?: boolean;
      } || {};

      if (clientId) {
        const platformsMsg = platforms ? platforms.join(", ") : "todas";
        console.log(`📱 Social: Manual collection for client ${clientId} (${platformsMsg})`);
        const stats = await collectSocialForClient(clientId, {
          platforms,
          collectHandles,
          collectHashtags,
        });
        console.log(`📱 Social: ${stats.postsNew} new posts, ${stats.errors} errors`);
      } else {
        // Recolección programada para todos los clientes
        const stats = await collectSocial();
        console.log(`📱 Social: ${stats.postsNew} new posts from ${stats.clientsProcessed} clients`);
      }
    },
    { connection, concurrency: 1 }
  ), "Social");

  // Google News RSS Worker (fuentes sin RSS propio)
  withErrorLogging(new Worker(
    QUEUE_NAMES.COLLECT_GNEWS,
    async () => {
      const articles = await collectGnews();
      await enqueueArticles(articles, "GNews");
    },
    { connection, concurrency: 1 }
  ), "GNews");

  // Ingestion Worker - processes collected articles
  withErrorLogging(new Worker(
    QUEUE_NAMES.INGEST_ARTICLE,
    async (job) => {
      const { article } = job.data as { article: NormalizedArticle };
      const { ingestArticle } = await import("./ingest.js");
      await ingestArticle(article);
    },
    { connection, concurrency: 5 }
  ), "Ingest");

  console.log("📡 Collector workers started");
}
