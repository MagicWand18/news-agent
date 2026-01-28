import Anthropic from "@anthropic-ai/sdk";
import { config, prisma } from "@mediabot/shared";

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

// Simple in-memory cache for recent cluster comparisons
// Key: `${clientId}:${normalizedTitle}`, Value: { parentId, expiresAt }
const clusterCache = new Map<string, { parentId: string; expiresAt: number }>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SIMILARITY_THRESHOLD = 0.7;

/**
 * Normalizes a title for comparison by removing common noise
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts keywords from a title for quick comparison
 */
function extractKeywords(title: string): Set<string> {
  const stopWords = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "en", "con", "por", "para", "que", "se",
    "su", "sus", "al", "es", "y", "o", "a", "ante",
    "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "with"
  ]);

  const normalized = normalizeTitle(title);
  const words = normalized.split(" ").filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

/**
 * Calculates Jaccard similarity between two sets of keywords
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Uses AI to determine if two articles are about the same event
 */
async function aiCompareArticles(params: {
  title1: string;
  summary1: string;
  title2: string;
  summary2: string;
}): Promise<{ sameEvent: boolean; confidence: number }> {
  const message = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `Determina si estos dos articulos tratan sobre el MISMO evento o noticia.

Articulo 1:
Titulo: ${params.title1}
Resumen: ${params.summary1 || "No disponible"}

Articulo 2:
Titulo: ${params.title2}
Resumen: ${params.summary2 || "No disponible"}

Responde SOLO en JSON:
{
  "sameEvent": true/false,
  "confidence": <0.0 a 1.0>
}

sameEvent=true si ambos hablan del mismo evento/noticia/anuncio especifico.
sameEvent=false si son temas relacionados pero eventos distintos.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return { sameEvent: false, confidence: 0 };
  }

  try {
    const codeBlockMatch = content.text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    const cleaned = codeBlockMatch ? codeBlockMatch[1].trim() : content.text.trim();
    const result = JSON.parse(cleaned);
    return {
      sameEvent: Boolean(result.sameEvent),
      confidence: Math.max(0, Math.min(1, result.confidence || 0)),
    };
  } catch {
    console.error("[Clustering] Failed to parse AI comparison:", content.text);
    return { sameEvent: false, confidence: 0 };
  }
}

/**
 * Finds a cluster parent for a new mention
 */
export async function findClusterParent(params: {
  mentionId: string;
  clientId: string;
  articleTitle: string;
  aiSummary: string;
}): Promise<{ parentId: string | null; score: number }> {
  const { clientId, articleTitle, aiSummary } = params;

  // Check cache first
  const normalizedTitle = normalizeTitle(articleTitle);
  const cacheKey = `${clientId}:${normalizedTitle}`;
  const cached = clusterCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Clustering] Cache hit for: ${articleTitle.slice(0, 50)}`);
    return { parentId: cached.parentId, score: 0.9 };
  }

  // Get recent mentions from the same client (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentMentions = await prisma.mention.findMany({
    where: {
      clientId,
      createdAt: { gte: since },
      parentMentionId: null, // Only look at cluster parents
    },
    include: {
      article: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20, // Limit to avoid too many comparisons
  });

  if (recentMentions.length === 0) {
    return { parentId: null, score: 0 };
  }

  const newKeywords = extractKeywords(articleTitle);

  // First pass: quick keyword similarity check
  const candidates: { mention: typeof recentMentions[0]; similarity: number }[] = [];

  for (const mention of recentMentions) {
    const existingKeywords = extractKeywords(mention.article.title);
    const similarity = jaccardSimilarity(newKeywords, existingKeywords);

    if (similarity >= 0.3) {
      // Low threshold for candidates
      candidates.push({ mention, similarity });
    }
  }

  if (candidates.length === 0) {
    return { parentId: null, score: 0 };
  }

  // Sort by similarity and take top 3 for AI comparison
  candidates.sort((a, b) => b.similarity - a.similarity);
  const topCandidates = candidates.slice(0, 3);

  // Second pass: AI comparison for top candidates
  for (const { mention, similarity } of topCandidates) {
    // If very high keyword similarity, skip AI check
    if (similarity >= 0.7) {
      console.log(`[Clustering] High keyword match (${similarity.toFixed(2)}): ${articleTitle.slice(0, 50)} -> ${mention.article.title.slice(0, 50)}`);

      // Cache this match
      clusterCache.set(cacheKey, {
        parentId: mention.id,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return { parentId: mention.id, score: similarity };
    }

    // Use AI for moderate matches
    const aiResult = await aiCompareArticles({
      title1: articleTitle,
      summary1: aiSummary,
      title2: mention.article.title,
      summary2: mention.aiSummary || "",
    });

    if (aiResult.sameEvent && aiResult.confidence >= SIMILARITY_THRESHOLD) {
      console.log(`[Clustering] AI match (${aiResult.confidence.toFixed(2)}): ${articleTitle.slice(0, 50)} -> ${mention.article.title.slice(0, 50)}`);

      // Cache this match
      clusterCache.set(cacheKey, {
        parentId: mention.id,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return { parentId: mention.id, score: aiResult.confidence };
    }
  }

  return { parentId: null, score: 0 };
}

/**
 * Cleans up expired cache entries (call periodically)
 */
export function cleanupClusterCache(): void {
  const now = Date.now();
  for (const [key, value] of clusterCache.entries()) {
    if (value.expiresAt < now) {
      clusterCache.delete(key);
    }
  }
}
