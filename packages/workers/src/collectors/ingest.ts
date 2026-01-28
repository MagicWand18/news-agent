import { createHash } from "crypto";
import { prisma } from "@mediabot/shared";
import type { NormalizedArticle } from "@mediabot/shared";
import { getQueue, QUEUE_NAMES } from "../queues.js";

export async function ingestArticle(article: NormalizedArticle) {
  // Dedup by URL
  const existing = await prisma.article.findUnique({
    where: { url: article.url },
  });

  if (existing) return;

  // Content hash for secondary dedup
  const contentHash = article.content
    ? createHash("sha256").update(article.content).digest("hex")
    : null;

  if (contentHash) {
    const hashMatch = await prisma.article.findFirst({
      where: { contentHash },
    });
    if (hashMatch) return;
  }

  // Save article
  const saved = await prisma.article.create({
    data: {
      url: article.url,
      title: article.title,
      source: article.source,
      content: article.content || null,
      contentHash,
      publishedAt: article.publishedAt || null,
    },
  });

  // Run matching against all active keywords
  await matchArticle(saved.id, article);
}

async function matchArticle(
  articleId: string,
  article: NormalizedArticle
) {
  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    include: { client: true },
  });

  const text = `${article.title} ${article.content || ""}`.toLowerCase();
  const analyzeQueue = getQueue(QUEUE_NAMES.ANALYZE_MENTION);

  // Group matches by client to avoid duplicate mentions per client
  const matchesByClient = new Map<
    string,
    { clientId: string; keyword: string }
  >();

  for (const kw of keywords) {
    if (!kw.client.active) continue;

    const kwLower = kw.word.toLowerCase();
    // Fuzzy-ish matching: check if keyword appears in text
    // Also check common variations (with/without accents for Spanish)
    const variations = [kwLower, removeAccents(kwLower)];
    const textNorm = removeAccents(text);

    const matched = variations.some(
      (v) => text.includes(v) || textNorm.includes(v)
    );

    if (matched && !matchesByClient.has(kw.clientId)) {
      matchesByClient.set(kw.clientId, {
        clientId: kw.clientId,
        keyword: kw.word,
      });
    }
  }

  // Create mentions and enqueue analysis
  for (const [, match] of matchesByClient) {
    // Extract snippet around keyword
    const kwIndex = text.indexOf(match.keyword.toLowerCase());
    const snippetStart = Math.max(0, kwIndex - 100);
    const snippetEnd = Math.min(text.length, kwIndex + match.keyword.length + 200);
    const snippet = (article.content || article.title).slice(snippetStart, snippetEnd);

    const mention = await prisma.mention.create({
      data: {
        articleId,
        clientId: match.clientId,
        keywordMatched: match.keyword,
        snippet,
      },
    });

    // Enqueue for AI analysis
    await analyzeQueue.add("analyze", { mentionId: mention.id }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  }
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
