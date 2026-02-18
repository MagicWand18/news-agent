import { prisma } from "@mediabot/shared";
import { extractTopic } from "./ai";
import { assignMentionToThread } from "./topic-thread-manager.js";

/**
 * Procesa una mencion para extraer y asignar su tema.
 */
export async function processMentionTopic(mentionId: string): Promise<string | null> {
  const mention = await prisma.mention.findUnique({
    where: { id: mentionId },
    include: {
      article: true,
      client: true,
    },
  });

  if (!mention) {
    console.error(`[TopicExtractor] Mencion no encontrada: ${mentionId}`);
    return null;
  }

  // Obtener temas existentes para mejorar consistencia
  const existingTopics = await prisma.topicCluster.findMany({
    select: { name: true },
    orderBy: { count: "desc" },
    take: 50,
  }) as { name: string }[];

  try {
    const result = await extractTopic({
      articleTitle: mention.article.title,
      articleContent: mention.article.content || "",
      clientName: mention.client.name,
      existingTopics: existingTopics.map((t) => t.name),
    });

    if (result.confidence < 0.3) {
      console.log(`[TopicExtractor] Confianza baja (${result.confidence}) para mencion ${mentionId}`);
      return null;
    }

    // Buscar o crear el cluster de tema usando transacción para evitar race conditions
    const normalizedTopic = normalizeTopic(result.topic);

    const topicCluster = await prisma.$transaction(async (tx) => {
      // Intentar encontrar cluster existente
      let cluster = await tx.topicCluster.findFirst({
        where: {
          name: {
            equals: normalizedTopic,
            mode: "insensitive",
          },
        },
      });

      // Crear si no existe
      if (!cluster) {
        try {
          cluster = await tx.topicCluster.create({
            data: {
              name: normalizedTopic,
              count: 0,
            },
          });
          console.log(`[TopicExtractor] Nuevo cluster creado: ${normalizedTopic}`);
        } catch {
          // Si falla por unique constraint, otro worker lo creó primero
          cluster = await tx.topicCluster.findFirst({
            where: { name: { equals: normalizedTopic, mode: "insensitive" } },
          });
        }
      }

      if (!cluster) {
        throw new Error(`No se pudo crear/encontrar cluster para: ${normalizedTopic}`);
      }

      // Actualizar la mención con el tema
      await tx.mention.update({
        where: { id: mentionId },
        data: {
          topic: normalizedTopic,
          topicClusterId: cluster.id,
        },
      });

      // Incrementar contador del cluster
      await tx.topicCluster.update({
        where: { id: cluster.id },
        data: { count: { increment: 1 } },
      });

      return cluster;
    });

    console.log(`[TopicExtractor] Tema asignado: ${normalizedTopic} -> mencion ${mentionId}`);

    // Asignar mención al TopicThread correspondiente (Sprint 19)
    try {
      const threadResult = await assignMentionToThread(mentionId, "mention");
      if (threadResult) {
        console.log(`[TopicExtractor] Mención ${mentionId} asignada a thread ${threadResult.threadId}`);
      }
    } catch (threadError) {
      console.error(`[TopicExtractor] Error asignando thread para mención ${mentionId}:`, threadError);
    }

    return normalizedTopic;
  } catch (error) {
    console.error(`[TopicExtractor] Error procesando mencion ${mentionId}:`, error);
    return null;
  }
}

/**
 * Normaliza el nombre del tema para consistencia.
 */
function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Procesa una SocialMention para extraer y asignar su tema.
 * Similar a processMentionTopic pero adaptado para posts sociales.
 */
export async function processSocialMentionTopic(socialMentionId: string): Promise<string | null> {
  const socialMention = await prisma.socialMention.findUnique({
    where: { id: socialMentionId },
    include: {
      client: true,
    },
  });

  if (!socialMention) {
    console.error(`[TopicExtractor] SocialMention no encontrada: ${socialMentionId}`);
    return null;
  }

  if (!socialMention.content || socialMention.content.trim().length < 10) {
    console.log(`[TopicExtractor] SocialMention ${socialMentionId} sin contenido suficiente`);
    return null;
  }

  // Obtener temas existentes para consistencia
  const existingTopics = await prisma.topicCluster.findMany({
    select: { name: true },
    orderBy: { count: "desc" },
    take: 50,
  }) as { name: string }[];

  try {
    const result = await extractTopic({
      articleTitle: (socialMention.content || "").slice(0, 100),
      articleContent: socialMention.content || "",
      clientName: socialMention.client.name,
      existingTopics: existingTopics.map((t) => t.name),
    });

    if (result.confidence < 0.3) {
      console.log(`[TopicExtractor] Confianza baja (${result.confidence}) para social ${socialMentionId}`);
      return null;
    }

    const normalizedTopic = normalizeTopic(result.topic);

    // Guardar topic en SocialMention
    await prisma.socialMention.update({
      where: { id: socialMentionId },
      data: { topic: normalizedTopic },
    });

    console.log(`[TopicExtractor] Tema social asignado: ${normalizedTopic} -> social ${socialMentionId}`);

    // Asignar al TopicThread correspondiente
    try {
      const threadResult = await assignMentionToThread(socialMentionId, "social");
      if (threadResult) {
        console.log(`[TopicExtractor] SocialMention ${socialMentionId} asignada a thread ${threadResult.threadId}`);
      }
    } catch (threadError) {
      console.error(`[TopicExtractor] Error asignando thread para social ${socialMentionId}:`, threadError);
    }

    return normalizedTopic;
  } catch (error) {
    console.error(`[TopicExtractor] Error procesando social ${socialMentionId}:`, error);
    return null;
  }
}

/**
 * Detecta temas emergentes (>= umbral de menciones en las ultimas horas).
 */
export async function detectEmergingTopics(
  orgId: string,
  hoursBack: number = 24,
  threshold: number = 3
): Promise<Array<{ topic: string; count: number; isNew: boolean }>> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Temas con >= threshold menciones en el periodo
  const recentTopics = await prisma.$queryRaw<{ topic: string; count: bigint }[]>`
    SELECT m.topic, COUNT(*) as count
    FROM "Mention" m
    JOIN "Client" c ON m."clientId" = c.id
    WHERE c."orgId" = ${orgId}
    AND COALESCE(m."publishedAt", m."createdAt") >= ${since}
    AND m.topic IS NOT NULL
    GROUP BY m.topic
    HAVING COUNT(*) >= ${threshold}
    ORDER BY count DESC
  `;

  // Verificar cuales son nuevos (no existian hace una semana)
  const emergingTopics = [];

  for (const topic of recentTopics) {
    const previousCount = await prisma.mention.count({
      where: {
        client: { orgId },
        topic: topic.topic,
        publishedAt: {
          gte: weekAgo,
          lt: since,
        },
      },
    });

    emergingTopics.push({
      topic: topic.topic,
      count: Number(topic.count),
      isNew: previousCount === 0,
    });
  }

  return emergingTopics;
}

/**
 * Obtiene estadisticas de temas para un cliente.
 */
export async function getTopicStats(
  clientId: string,
  days: number = 30
): Promise<{
  topics: Array<{
    name: string;
    count: number;
    sentiment: { positive: number; negative: number; neutral: number };
    trend: "up" | "down" | "stable";
  }>;
  totalWithTopic: number;
  totalWithoutTopic: number;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const midpoint = new Date(Date.now() - (days / 2) * 24 * 60 * 60 * 1000);

  // Obtener temas con sentimiento
  const topicsWithSentiment = await prisma.$queryRaw<
    { topic: string; count: bigint; positive: bigint; negative: bigint; neutral: bigint }[]
  >`
    SELECT
      topic,
      COUNT(*) as count,
      SUM(CASE WHEN sentiment = 'POSITIVE' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment = 'NEGATIVE' THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN sentiment = 'NEUTRAL' OR sentiment = 'MIXED' THEN 1 ELSE 0 END) as neutral
    FROM "Mention"
    WHERE "clientId" = ${clientId}
    AND COALESCE("publishedAt", "createdAt") >= ${since}
    AND topic IS NOT NULL
    GROUP BY topic
    ORDER BY count DESC
    LIMIT 20
  `;

  // Calcular tendencia para cada tema
  const topics = await Promise.all(
    topicsWithSentiment.map(async (t) => {
      const [firstHalf, secondHalf] = await Promise.all([
        prisma.mention.count({
          where: {
            clientId,
            topic: t.topic,
            publishedAt: { gte: since, lt: midpoint },
          },
        }),
        prisma.mention.count({
          where: {
            clientId,
            topic: t.topic,
            publishedAt: { gte: midpoint },
          },
        }),
      ]);

      let trend: "up" | "down" | "stable" = "stable";
      if (secondHalf > firstHalf * 1.2) trend = "up";
      else if (secondHalf < firstHalf * 0.8) trend = "down";

      return {
        name: t.topic,
        count: Number(t.count),
        sentiment: {
          positive: Number(t.positive),
          negative: Number(t.negative),
          neutral: Number(t.neutral),
        },
        trend,
      };
    })
  );

  // Conteos de menciones con/sin tema
  const [totalWithTopic, totalWithoutTopic] = await Promise.all([
    prisma.mention.count({
      where: {
        clientId,
        publishedAt: { gte: since },
        topic: { not: null },
      },
    }),
    prisma.mention.count({
      where: {
        clientId,
        publishedAt: { gte: since },
        topic: null,
      },
    }),
  ]);

  return {
    topics,
    totalWithTopic,
    totalWithoutTopic,
  };
}

/**
 * Reprocesa menciones sin tema asignado.
 */
export async function reprocessMentionsWithoutTopic(
  orgId: string,
  limit: number = 100
): Promise<{ processed: number; assigned: number }> {
  const mentions = await prisma.mention.findMany({
    where: {
      client: { orgId },
      topic: null,
    },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  let assigned = 0;

  for (const mention of mentions) {
    const topic = await processMentionTopic(mention.id);
    if (topic) assigned++;
  }

  return {
    processed: mentions.length,
    assigned,
  };
}
