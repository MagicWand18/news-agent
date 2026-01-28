import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { collectGdelt } from "./gdelt.js";
import { collectNewsdata } from "./newsdata.js";
import { collectRss } from "./rss.js";
import { collectGoogle } from "./google.js";
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
