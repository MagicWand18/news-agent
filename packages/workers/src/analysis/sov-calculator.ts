import { prisma } from "@mediabot/shared";

export interface SOVResult {
  clientId: string;
  clientName: string;
  mentions: number;
  sov: number; // Porcentaje 0-100
  weightedMentions: number; // Menciones ponderadas por tier
  weightedSov: number; // SOV ponderado por tier
}

export interface SOVData {
  client: SOVResult;
  competitors: SOVResult[];
  total: number;
  totalWeighted: number;
  period: {
    start: Date;
    end: Date;
    days: number;
  };
}

export interface SOVHistory {
  date: Date;
  sov: number;
  weightedSov: number;
  mentions: number;
}

/**
 * Obtiene el peso de una fuente basado en su tier.
 * Tier 1 (nacionales) = 3x, Tier 2 (regionales) = 2x, Tier 3 (digitales) = 1x
 */
async function getSourceWeight(source: string): Promise<number> {
  const domain = extractDomain(source);
  if (!domain) return 1;

  const sourceTier = await prisma.sourceTier.findUnique({
    where: { domain },
  });

  if (!sourceTier) return 1;

  // Invertir el tier para que tier 1 tenga más peso
  switch (sourceTier.tier) {
    case 1:
      return 3; // Medios nacionales
    case 2:
      return 2; // Medios regionales
    case 3:
    default:
      return 1; // Digitales/blogs
  }
}

/**
 * Extrae el dominio de una URL o nombre de fuente.
 */
function extractDomain(source: string): string | null {
  try {
    // Si ya es un dominio simple
    if (!source.includes("/") && source.includes(".")) {
      return source.toLowerCase();
    }
    // Si es una URL completa
    const url = new URL(source.startsWith("http") ? source : `https://${source}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Calcula el Share of Voice de un cliente en un período.
 * Incluye comparación con competidores definidos en el modelo Competitor.
 */
export async function calculateSOV(
  clientId: string,
  days: number = 30,
  includeCompetitors: boolean = true
): Promise<SOVData> {
  // Validar entrada
  if (days < 1 || days > 365) {
    throw new Error("Days must be between 1 and 365");
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Obtener cliente
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error(`Cliente no encontrado: ${clientId}`);
  }

  // Obtener competidores del modelo Competitor
  const clientCompetitors = await prisma.clientCompetitor.findMany({
    where: { clientId },
    include: { competitor: true },
  });
  const competitorNames = clientCompetitors.map((cc) => cc.competitor.name);

  // Calcular menciones del cliente
  const clientMentions = await getMentionsWithWeights(clientId, startDate, endDate);

  // Calcular menciones de competidores
  const competitorResults: SOVResult[] = [];

  if (includeCompetitors && competitorNames.length > 0) {
    // Buscar clientes que coincidan con los nombres de competidores
    const competitorClients = await prisma.client.findMany({
      where: {
        orgId: client.orgId,
        OR: competitorNames.map((name) => ({
          name: { contains: name, mode: "insensitive" as const },
        })),
        active: true,
        id: { not: clientId },
      },
    });

    for (const competitor of competitorClients) {
      const compMentions = await getMentionsWithWeights(competitor.id, startDate, endDate);
      competitorResults.push({
        clientId: competitor.id,
        clientName: competitor.name,
        mentions: compMentions.count,
        sov: 0, // Se calcula después
        weightedMentions: compMentions.weighted,
        weightedSov: 0,
      });
    }
  }

  // Calcular totales
  const total = clientMentions.count + competitorResults.reduce((sum, c) => sum + c.mentions, 0);
  const totalWeighted =
    clientMentions.weighted + competitorResults.reduce((sum, c) => sum + c.weightedMentions, 0);

  // Calcular SOV
  const clientResult: SOVResult = {
    clientId: client.id,
    clientName: client.name,
    mentions: clientMentions.count,
    sov: total > 0 ? (clientMentions.count / total) * 100 : 0,
    weightedMentions: clientMentions.weighted,
    weightedSov: totalWeighted > 0 ? (clientMentions.weighted / totalWeighted) * 100 : 0,
  };

  // Calcular SOV de competidores
  for (const competitor of competitorResults) {
    competitor.sov = total > 0 ? (competitor.mentions / total) * 100 : 0;
    competitor.weightedSov = totalWeighted > 0 ? (competitor.weightedMentions / totalWeighted) * 100 : 0;
  }

  return {
    client: clientResult,
    competitors: competitorResults,
    total,
    totalWeighted,
    period: {
      start: startDate,
      end: endDate,
      days,
    },
  };
}

/**
 * Obtiene menciones de un cliente con pesos calculados por tier de fuente.
 */
async function getMentionsWithWeights(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<{ count: number; weighted: number }> {
  const mentions = await prisma.mention.findMany({
    where: {
      clientId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      article: {
        select: {
          source: true,
        },
      },
    },
  });

  let weighted = 0;
  for (const mention of mentions) {
    const weight = await getSourceWeight(mention.article.source);
    weighted += weight;
  }

  return {
    count: mentions.length,
    weighted,
  };
}

/**
 * Obtiene el histórico de SOV para un cliente (últimas N semanas).
 */
export async function getSOVHistory(
  clientId: string,
  weeks: number = 8
): Promise<SOVHistory[]> {
  const history: SOVHistory[] = [];
  const now = new Date();

  // Obtener cliente para acceder a orgId
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { orgId: true },
  });

  if (!client) return history;

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Calcular menciones del cliente en esta semana específica
    const clientMentions = await getMentionsWithWeights(clientId, weekStart, weekEnd);

    // Calcular total de menciones de la org en esta semana
    const totalMentions = await prisma.mention.count({
      where: {
        client: { orgId: client.orgId },
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    });

    const sov = totalMentions > 0 ? (clientMentions.count / totalMentions) * 100 : 0;
    const weightedSov = totalMentions > 0 ? (clientMentions.weighted / totalMentions) * 100 : 0;

    history.push({
      date: weekStart,
      sov,
      weightedSov,
      mentions: clientMentions.count,
    });
  }

  return history;
}

/**
 * Calcula el SOV de todos los clientes activos de una organización.
 */
export async function calculateOrgSOV(orgId: string, days: number = 30): Promise<SOVResult[]> {
  const clients = await prisma.client.findMany({
    where: {
      orgId,
      active: true,
    },
  });

  const results: SOVResult[] = [];
  let totalMentions = 0;
  let totalWeighted = 0;

  // Primera pasada: contar menciones
  for (const client of clients) {
    const sovData = await calculateSOV(client.id, days, false);
    results.push(sovData.client);
    totalMentions += sovData.client.mentions;
    totalWeighted += sovData.client.weightedMentions;
  }

  // Segunda pasada: calcular SOV
  for (const result of results) {
    result.sov = totalMentions > 0 ? (result.mentions / totalMentions) * 100 : 0;
    result.weightedSov = totalWeighted > 0 ? (result.weightedMentions / totalWeighted) * 100 : 0;
  }

  return results.sort((a, b) => b.sov - a.sov);
}
