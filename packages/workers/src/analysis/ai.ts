import Anthropic from "@anthropic-ai/sdk";
import { config } from "@mediabot/shared";
import type { AIAnalysisResult, OnboardingResult, PreFilterResult, ResponseGenerationResult } from "@mediabot/shared";

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

/**
 * Extracts JSON from Claude responses that may be wrapped in markdown code blocks.
 */
function cleanJsonResponse(text: string): string {
  // Try to extract from ```json ... ``` or ``` ... ``` blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
}

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

  const rawText = content.text;
  console.log("[AI] Raw analyzeMention response:", rawText.slice(0, 300));

  try {
    const cleaned = cleanJsonResponse(rawText);
    const result = JSON.parse(cleaned) as AIAnalysisResult;
    // Validate and clamp
    result.relevance = Math.max(1, Math.min(10, Math.round(result.relevance)));
    if (!["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"].includes(result.sentiment)) {
      result.sentiment = "NEUTRAL";
    }
    return result;
  } catch {
    console.error("[AI] Failed to parse AI response:", rawText);
    return {
      summary: "Mencion detectada - analisis automatico no disponible",
      sentiment: "NEUTRAL",
      relevance: 5,
      suggestedAction: "Revisar manualmente",
    };
  }
}

/**
 * Pre-filters articles to reduce false positives before creating mentions.
 * Uses AI to determine if a keyword match is a real mention of the client
 * or just a coincidental word match (e.g., "Presidencia de la empresa" vs "Presidencia de México").
 */
export async function preFilterArticle(params: {
  articleTitle: string;
  articleContent: string;
  clientName: string;
  clientDescription: string;
  keyword: string;
}): Promise<PreFilterResult> {
  const contentPreview = params.articleContent?.slice(0, 800) || "";

  const message = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Determina si este articulo es realmente relevante para el cliente o es un falso positivo.

Cliente: "${params.clientName}"
Descripcion del cliente: ${params.clientDescription || "No disponible"}
Keyword que hizo match: "${params.keyword}"

Articulo:
Titulo: ${params.articleTitle}
Contenido: ${contentPreview}

Analiza si el keyword "${params.keyword}" en este articulo se refiere realmente al cliente "${params.clientName}" o es una coincidencia (ej: nombre comun, palabra generica, otro contexto).

Responde SOLO en JSON:
{
  "relevant": true/false,
  "reason": "explicacion breve de 1 linea",
  "confidence": <0.0 a 1.0>
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const rawText = content.text;
  console.log("[AI] Pre-filter response:", rawText.slice(0, 150));

  try {
    const cleaned = cleanJsonResponse(rawText);
    const result = JSON.parse(cleaned) as PreFilterResult;
    // Ensure confidence is between 0 and 1
    result.confidence = Math.max(0, Math.min(1, result.confidence));
    return result;
  } catch {
    console.error("[AI] Failed to parse pre-filter response:", rawText);
    // Default to relevant if parsing fails (don't lose potential mentions)
    return {
      relevant: true,
      reason: "Error de parsing - aceptado por defecto",
      confidence: 0.5,
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

  const rawText = content.text;
  console.log("[AI] Raw onboarding response:", rawText.slice(0, 300));

  try {
    const cleaned = cleanJsonResponse(rawText);
    return JSON.parse(cleaned) as OnboardingResult;
  } catch {
    console.error("[AI] Failed to parse onboarding response:", rawText);
    return {
      suggestedKeywords: [{ word: params.clientName, type: "NAME" }],
      competitors: [],
      sensitiveTopics: [],
      actionLines: ["Configurar keywords manualmente"],
      recentMentions: [],
    };
  }
}

export async function generateResponse(params: {
  articleTitle: string;
  articleContent: string;
  source: string;
  sentiment: string;
  relevance: number;
  clientName: string;
  clientDescription: string;
  clientIndustry: string;
  aiSummary?: string;
  requestedTone?: "PROFESSIONAL" | "DEFENSIVE" | "CLARIFICATION" | "CELEBRATORY";
}): Promise<ResponseGenerationResult> {
  const toneInstruction = params.requestedTone
    ? `El tono DEBE ser ${params.requestedTone}.`
    : `Selecciona el tono mas apropiado basado en el sentimiento del articulo.`;

  const message = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `Eres un experto en comunicacion corporativa y relaciones publicas.
Genera un borrador de comunicado de prensa en respuesta a esta mencion en medios.

Cliente: ${params.clientName}
Industria: ${params.clientIndustry || "No especificada"}
Descripcion: ${params.clientDescription || "No disponible"}

Articulo original:
Titulo: ${params.articleTitle}
Fuente: ${params.source}
Contenido: ${params.articleContent?.slice(0, 1500) || "No disponible"}

Analisis previo:
Sentimiento: ${params.sentiment}
Relevancia: ${params.relevance}/10
Resumen: ${params.aiSummary || "No disponible"}

${toneInstruction}

Genera un comunicado en JSON con este formato exacto:
{
  "title": "Titulo del comunicado (conciso y profesional)",
  "body": "Cuerpo completo del comunicado (3-4 parrafos, incluye contexto, posicion del cliente, datos relevantes y cierre)",
  "tone": "PROFESSIONAL|DEFENSIVE|CLARIFICATION|CELEBRATORY",
  "audience": "Publico objetivo principal (ej: medios generales, prensa especializada, stakeholders)",
  "callToAction": "Siguiente paso recomendado para el equipo de PR",
  "keyMessages": ["Mensaje clave 1", "Mensaje clave 2", "Mensaje clave 3"]
}

Solo responde con el JSON, sin markdown ni texto adicional.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const rawText = content.text;
  console.log("[AI] Raw generateResponse response:", rawText.slice(0, 300));

  try {
    const cleaned = cleanJsonResponse(rawText);
    const result = JSON.parse(cleaned) as ResponseGenerationResult;
    // Validate tone
    if (!["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"].includes(result.tone)) {
      result.tone = "PROFESSIONAL";
    }
    return result;
  } catch {
    console.error("[AI] Failed to parse generateResponse response:", rawText);
    return {
      title: `Comunicado sobre: ${params.articleTitle.slice(0, 50)}`,
      body: "Error al generar el comunicado automatico. Por favor, redacte manualmente.",
      tone: "PROFESSIONAL",
      audience: "Medios generales",
      callToAction: "Revisar y completar manualmente",
      keyMessages: ["Revisar articulo original", "Definir posicion del cliente"],
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
