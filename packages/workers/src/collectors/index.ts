import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { collectGdelt } from "./gdelt.js";
import { collectNewsdata } from "./newsdata.js";
import { collectRss } from "./rss.js";
import { collectGoogle } from "./google.js";
import type { NormalizedArticle } from "@mediabot/shared";

export function startCollectorWorkers(_queues: ReturnType<typeof import("../queues.js").setupQueues>) {
  const ingestQueue = getQueue(QUEUE_NAMES.INGEST_ARTICLE);

  const enqueueArticles = async (articles: NormalizedArticle[], source: string) => {
    console.log(`📥 ${source}: ${articles.length} articles collected`);
    for (const article of articles) {
      await ingestQueue.add("ingest", { article, source }, {
        jobId: `article:${Buffer.from(article.url).toString("base64").slice(0, 50)}`,
      });
    }
  };

  // GDELT Worker
  new Worker(
    QUEUE_NAMES.COLLECT_GDELT,
    async () => {
      const articles = await collectGdelt();
      await enqueueArticles(articles, "GDELT");
    },
    { connection, concurrency: 1 }
  );

  // NewsData Worker
  new Worker(
    QUEUE_NAMES.COLLECT_NEWSDATA,
    async () => {
      const articles = await collectNewsdata();
      await enqueueArticles(articles, "NewsData");
    },
    { connection, concurrency: 1 }
  );

  // RSS Worker
  new Worker(
    QUEUE_NAMES.COLLECT_RSS,
    async () => {
      const articles = await collectRss();
      await enqueueArticles(articles, "RSS");
    },
    { connection, concurrency: 1 }
  );

  // Google CSE Worker
  new Worker(
    QUEUE_NAMES.COLLECT_GOOGLE,
    async () => {
      const articles = await collectGoogle();
      await enqueueArticles(articles, "GoogleCSE");
    },
    { connection, concurrency: 1 }
  );

  // Ingestion Worker - processes collected articles
  new Worker(
    QUEUE_NAMES.INGEST_ARTICLE,
    async (job) => {
      const { article } = job.data as { article: NormalizedArticle };
      const { ingestArticle } = await import("./ingest.js");
      await ingestArticle(article);
    },
    { connection, concurrency: 5 }
  );

  console.log("📡 Collector workers started");
}
