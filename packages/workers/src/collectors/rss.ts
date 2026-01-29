import Parser from "rss-parser";
import type { NormalizedArticle } from "@mediabot/shared";
import { config, prisma } from "@mediabot/shared";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; MediaBot/1.0)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

/**
 * Obtiene las fuentes RSS de la base de datos.
 * Si no hay fuentes en DB, usa el fallback de config.
 */
async function getRssSources(): Promise<Array<{ id?: string; name: string; url: string }>> {
  try {
    // Intentar obtener fuentes de la base de datos
    const dbSources = await prisma.rssSource.findMany({
      where: { active: true },
      select: { id: true, name: true, url: true },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });

    if (dbSources.length > 0) {
      console.log(`📊 RSS: Usando ${dbSources.length} fuentes de la base de datos`);
      return dbSources;
    }
  } catch (error) {
    // Si la tabla no existe o hay error, usar fallback
    console.log(`⚠️ RSS: Error al consultar RssSource, usando config fallback`);
  }

  // Fallback a config hardcodeada
  console.log(`📊 RSS: Usando ${config.rssFeeds.length} fuentes del config (fallback)`);
  return [...config.rssFeeds];
}

/**
 * Actualiza el estado de una fuente RSS en la base de datos.
 */
async function updateSourceStatus(
  sourceId: string | undefined,
  success: boolean
): Promise<void> {
  if (!sourceId) return;

  try {
    if (success) {
      await prisma.rssSource.update({
        where: { id: sourceId },
        data: {
          lastFetch: new Date(),
          errorCount: 0,
        },
      });
    } else {
      await prisma.rssSource.update({
        where: { id: sourceId },
        data: {
          errorCount: { increment: 1 },
        },
      });
    }
  } catch (error) {
    // Ignorar errores de actualización de estado
  }
}

/**
 * Desactiva fuentes con demasiados errores consecutivos.
 */
async function deactivateFailingSources(threshold: number = 10): Promise<void> {
  try {
    const result = await prisma.rssSource.updateMany({
      where: {
        errorCount: { gte: threshold },
        active: true,
      },
      data: { active: false },
    });

    if (result.count > 0) {
      console.log(`⚠️ RSS: ${result.count} fuente(s) desactivada(s) por errores consecutivos`);
    }
  } catch (error) {
    // Ignorar
  }
}

export async function collectRss(): Promise<NormalizedArticle[]> {
  const keywords = await prisma.keyword.findMany({
    where: { active: true },
    select: { word: true },
  });

  const keywordSet = new Set(keywords.map((k) => k.word.toLowerCase()));
  if (keywordSet.size === 0) return [];

  // Obtener fuentes (de DB o fallback)
  const sources = await getRssSources();

  const articles: NormalizedArticle[] = [];
  let totalParsed = 0;
  let feedsOk = 0;

  for (const source of sources) {
    try {
      const parsed = await parser.parseURL(source.url);
      const items = parsed.items || [];
      totalParsed += items.length;
      feedsOk++;

      // Actualizar estado exitoso
      await updateSourceStatus((source as { id?: string }).id, true);

      for (const item of items) {
        if (!item.link || !item.title) continue;

        // Verificar si algún keyword coincide en título o contenido
        const text = `${item.title} ${item.contentSnippet || ""}`.toLowerCase();
        const matches = [...keywordSet].some((kw) => text.includes(kw));

        if (matches) {
          articles.push({
            url: item.link,
            title: item.title,
            source: source.name,
            content: item.contentSnippet || item.content || undefined,
            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
          });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`RSS error [${source.name}]: ${msg.slice(0, 100)}`);

      // Actualizar estado de error
      await updateSourceStatus((source as { id?: string }).id, false);
    }
  }

  // Desactivar fuentes que fallan repetidamente
  await deactivateFailingSources();

  console.log(
    `📰 RSS: ${feedsOk}/${sources.length} feeds OK, ${totalParsed} items parsed, ${articles.length} matched keywords`
  );
  return articles;
}

/**
 * Obtiene estadísticas de las fuentes RSS.
 */
export async function getRssStats(): Promise<{
  total: number;
  active: number;
  byType: Record<string, number>;
  byTier: Record<number, number>;
  failing: number;
}> {
  try {
    const [total, active, byType, byTier, failing] = await Promise.all([
      prisma.rssSource.count(),
      prisma.rssSource.count({ where: { active: true } }),
      prisma.rssSource.groupBy({
        by: ["type"],
        _count: { id: true },
      }),
      prisma.rssSource.groupBy({
        by: ["tier"],
        _count: { id: true },
      }),
      prisma.rssSource.count({ where: { errorCount: { gte: 3 } } }),
    ]);

    return {
      total,
      active,
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count.id])),
      byTier: Object.fromEntries(byTier.map((t) => [t.tier, t._count.id])),
      failing,
    };
  } catch (error) {
    return {
      total: config.rssFeeds.length,
      active: config.rssFeeds.length,
      byType: { NATIONAL: config.rssFeeds.length },
      byTier: { 1: config.rssFeeds.length },
      failing: 0,
    };
  }
}
