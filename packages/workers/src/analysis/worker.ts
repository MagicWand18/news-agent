import { Worker } from "bullmq";
import { connection, QUEUE_NAMES, getQueue } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { analyzeMention } from "./ai.js";
import type { Urgency, Sentiment } from "@prisma/client";

// High-reach Spanish media sources
const HIGH_REACH_SOURCES = new Set([
  "elpais.com", "elmundo.es", "lavanguardia.com", "abc.es",
  "20minutos.es", "europapress.es", "efe.com", "rtve.es",
  "infobae.com", "cnn", "bbc", "reuters", "elconfidencial.com",
]);

export function startAnalysisWorker() {
  const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_ALERT);

  const worker = new Worker(
    QUEUE_NAMES.ANALYZE_MENTION,
    async (job) => {
      const { mentionId } = job.data as { mentionId: string };

      const mention = await prisma.mention.findUnique({
        where: { id: mentionId },
        include: {
          article: true,
          client: true,
        },
      });

      if (!mention) return;

      // Run AI analysis
      const analysis = await analyzeMention({
        articleTitle: mention.article.title,
        articleContent: mention.article.content || mention.snippet || "",
        source: mention.article.source,
        clientName: mention.client.name,
        clientDescription: mention.client.description || "",
        clientIndustry: mention.client.industry || "",
        keyword: mention.keywordMatched,
      });

      // Classify urgency
      const urgency = classifyUrgency(
        analysis.relevance,
        analysis.sentiment,
        mention.article.source
      );

      // Update mention with analysis results
      await prisma.mention.update({
        where: { id: mentionId },
        data: {
          aiSummary: analysis.summary,
          aiAction: analysis.suggestedAction,
          sentiment: analysis.sentiment as Sentiment,
          relevance: analysis.relevance,
          urgency: urgency as Urgency,
        },
      });

      // Enqueue notification if urgent enough
      if (urgency === "CRITICAL" || urgency === "HIGH") {
        await notifyQueue.add("alert", { mentionId }, {
          priority: urgency === "CRITICAL" ? 1 : 2,
        });
      }
    },
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 20,
        duration: 60000, // Max 20 analyses per minute to control API costs
      },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`Analysis job ${job?.id} failed:`, err);
  });

  console.log("🧠 Analysis worker started");
}

function classifyUrgency(
  relevance: number,
  sentiment: string,
  source: string
): string {
  const sourceLower = source.toLowerCase();
  const isHighReach = [...HIGH_REACH_SOURCES].some((s) =>
    sourceLower.includes(s)
  );

  if (relevance >= 8 && sentiment === "NEGATIVE" && isHighReach) {
    return "CRITICAL";
  }
  if (relevance >= 7 || sentiment === "NEGATIVE") {
    return "HIGH";
  }
  if (relevance >= 4) {
    return "MEDIUM";
  }
  return "LOW";
}
