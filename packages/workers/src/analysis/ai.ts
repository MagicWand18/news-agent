import Anthropic from "@anthropic-ai/sdk";
import { config } from "@mediabot/shared";
import type { AIAnalysisResult, OnboardingResult } from "@mediabot/shared";

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

export async function analyzeMention(params: {
  articleTitle: string;
  articleContent: string;
  source: string;
  clientName: string;
  clientDescription: string;
  clientIndustry: string;
  keyword: string;
}): Promise<AIAnalysisResult> {
  const message = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Analiza esta mencion en medios para un cliente de una agencia de PR.

Cliente: ${params.clientName}
Industria: ${params.clientIndustry || "No especificada"}
Descripcion: ${params.clientDescription || "No disponible"}
Keyword detectado: ${params.keyword}

Articulo:
Titulo: ${params.articleTitle}
Fuente: ${params.source}
Contenido: ${params.articleContent?.slice(0, 1500) || "No disponible"}

Responde en JSON con este formato exacto:
{
  "summary": "Resumen ejecutivo de 2-3 lineas explicando por que esta mencion es relevante para el cliente",
  "sentiment": "POSITIVE|NEGATIVE|NEUTRAL|MIXED",
  "relevance": <numero del 1 al 10>,
  "suggestedAction": "Accion concreta sugerida para el equipo de PR"
}

Solo responde con el JSON, sin markdown ni texto adicional.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    const result = JSON.parse(content.text) as AIAnalysisResult;
    // Validate and clamp
    result.relevance = Math.max(1, Math.min(10, Math.round(result.relevance)));
    if (!["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"].includes(result.sentiment)) {
      result.sentiment = "NEUTRAL";
    }
    return result;
  } catch {
    console.error("Failed to parse AI response:", content.text);
    return {
      summary: "Mencion detectada - analisis automatico no disponible",
      sentiment: "NEUTRAL",
      relevance: 5,
      suggestedAction: "Revisar manualmente",
    };
  }
}

export async function runOnboarding(params: {
  clientName: string;
  description: string;
  industry: string;
  recentArticles: { title: string; url: string; source: string }[];
}): Promise<OnboardingResult> {
  const articlesContext = params.recentArticles
    .slice(0, 10)
    .map((a) => `- ${a.title} (${a.source})`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Eres un experto en monitoreo de medios y PR. Un nuevo cliente se ha registrado:

Nombre: ${params.clientName}
Descripcion: ${params.description || "No proporcionada"}
Industria: ${params.industry || "No especificada"}

Menciones recientes encontradas:
${articlesContext || "Ninguna encontrada"}

Genera sugerencias para configurar el monitoreo de este cliente. Responde en JSON:
{
  "suggestedKeywords": [{"word": "keyword", "type": "NAME|BRAND|COMPETITOR|TOPIC|ALIAS"}],
  "competitors": ["nombre competidor 1", "nombre competidor 2"],
  "sensitiveTopics": ["tema sensible que monitorear"],
  "actionLines": ["linea de accion sugerida para monitoreo"],
  "recentMentions": [{"title": "titulo", "url": "url", "source": "fuente"}]
}

Incluye al menos:
- 5-10 keywords variados (nombre, variantes, marcas si aplica, alias)
- 2-3 competidores identificados
- 2-3 temas sensibles para la industria
- 3-5 lineas de accion para monitoreo proactivo

Solo responde con el JSON, sin markdown ni texto adicional.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    return JSON.parse(content.text) as OnboardingResult;
  } catch {
    console.error("Failed to parse onboarding response:", content.text);
    return {
      suggestedKeywords: [{ word: params.clientName, type: "NAME" }],
      competitors: [],
      sensitiveTopics: [],
      actionLines: ["Configurar keywords manualmente"],
      recentMentions: [],
    };
  }
}

export async function generateDigestSummary(params: {
  clientName: string;
  totalMentions: number;
  sentimentBreakdown: { positive: number; negative: number; neutral: number; mixed: number };
  topMentions: { title: string; source: string; sentiment: string; relevance: number }[];
}): Promise<string> {
  const topMentionsText = params.topMentions
    .map((m) => `- ${m.title} (${m.source}, ${m.sentiment}, relevancia ${m.relevance}/10)`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Genera un resumen ejecutivo del dia para el equipo de PR del cliente "${params.clientName}".

Total menciones: ${params.totalMentions}
Sentimiento: Positivas=${params.sentimentBreakdown.positive}, Negativas=${params.sentimentBreakdown.negative}, Neutras=${params.sentimentBreakdown.neutral}, Mixtas=${params.sentimentBreakdown.mixed}

Menciones mas relevantes:
${topMentionsText || "Ninguna relevante"}

Escribe un resumen de 3-5 lineas en espanol, directo y accionable. No uses markdown.`,
      },
    ],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "Resumen no disponible";
}
