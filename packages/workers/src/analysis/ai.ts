import { getGeminiModel, cleanJsonResponse } from "@mediabot/shared";
import type { AIAnalysisResult, OnboardingResult, PreFilterResult, ResponseGenerationResult } from "@mediabot/shared";

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
  const model = getGeminiModel();

  const prompt = `Determina si este articulo es realmente relevante para el cliente o es un falso positivo.

Cliente: "${params.clientName}"
Descripcion del cliente: ${params.clientDescription || "No disponible"}
Keyword que hizo match: "${params.keyword}"

Articulo:
Titulo: ${params.articleTitle}
Contenido: ${contentPreview}

Analiza si el keyword "${params.keyword}" en este articulo se refiere realmente al cliente "${params.clientName}" o es una coincidencia (ej: nombre comun, palabra generica, otro contexto).

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{"relevant": true, "reason": "explicacion breve", "confidence": 0.85}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.2 },
    });

    const rawText = result.response.text();
    console.log("[AI] Pre-filter response:", rawText.slice(0, 150));

    const cleaned = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleaned) as PreFilterResult;
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    return parsed;
  } catch (error) {
    console.error("[AI] Failed to parse pre-filter response:", error);
    return {
      relevant: true,
      reason: "Error de parsing - aceptado por defecto",
      confidence: 1.0,
    };
  }
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
  const model = getGeminiModel();

  const prompt = `Eres un analista de medios para una agencia de relaciones publicas. Analiza esta mencion evaluando el SENTIMIENTO desde la perspectiva del cliente mencionado.

Cliente: ${params.clientName}
Industria: ${params.clientIndustry || "No especificada"}
Descripcion: ${params.clientDescription || "No disponible"}
Keyword detectado: ${params.keyword}

Articulo:
Titulo: ${params.articleTitle}
Fuente: ${params.source}
Contenido: ${params.articleContent?.slice(0, 1500) || "No disponible"}

CRITERIOS DE SENTIMIENTO (evalua desde la perspectiva del cliente):
- NEGATIVE: Criticas, escándalos, denuncias, acusaciones, problemas legales, violencia vinculada, pérdidas, fracasos, controversias, mala imagen publica, investigaciones en contra, protestas, quejas ciudadanas, incumplimiento, corrupción, inseguridad en su jurisdicción
- POSITIVE: Logros, reconocimientos, inauguraciones, inversiones exitosas, mejoras, alianzas beneficiosas, elogios, avances, buenos resultados, apoyo ciudadano
- NEUTRAL: Información factual sin carga valorativa clara, notas informativas generales, menciones incidentales sin impacto en reputación
- MIXED: Articulo que contiene elementos tanto positivos como negativos significativos para el cliente

IMPORTANTE: No confundas neutralidad informativa con impacto reputacional. Una nota periodística puede tener tono informativo pero su contenido ser claramente negativo para el cliente (ej: "Se reportan 15 homicidios en el municipio de X" es NEGATIVO para el alcalde de X).

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "summary": "Resumen ejecutivo de 2-3 lineas explicando por que esta mencion es relevante para el cliente",
  "sentiment": "NEGATIVE",
  "relevance": 7,
  "suggestedAction": "Accion concreta sugerida para el equipo de PR"
}

Valores posibles para sentiment: POSITIVE, NEGATIVE, NEUTRAL, MIXED
Relevance es un numero del 1 al 10 (1=irrelevante, 10=altamente relevante para el cliente).`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
    });

    const rawText = result.response.text();
    console.log("[AI] Raw analyzeMention response:", rawText.slice(0, 300));

    const cleaned = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleaned) as AIAnalysisResult;
    parsed.relevance = Math.max(1, Math.min(10, Math.round(parsed.relevance)));
    if (!["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"].includes(parsed.sentiment)) {
      console.warn(`[AI] Invalid sentiment "${parsed.sentiment}", defaulting to NEUTRAL`);
      parsed.sentiment = "NEUTRAL";
    }
    return parsed;
  } catch (error) {
    console.error("[AI] Failed to parse AI response for article:", params.articleTitle?.slice(0, 80), error);
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

  const model = getGeminiModel();

  const prompt = `Eres un experto en monitoreo de medios y PR en Mexico. Un nuevo cliente se ha registrado:

Nombre: ${params.clientName}
Descripcion: ${params.description || "No proporcionada"}
Industria: ${params.industry || "No especificada"}

Noticias reales encontradas sobre este cliente:
${articlesContext || "Ninguna encontrada"}

Genera sugerencias para configurar el monitoreo de este cliente.

REGLAS CRITICAS PARA KEYWORDS:
- Los keywords deben ser ESPECIFICOS al cliente, NO genericos de industria o geografia
- NO incluir nombres de ciudades/estados solos (ej: "Monterrey", "Mexico", "Nuevo Leon")
- NO incluir palabras genericas (ej: "gobierno", "politica", "economia", "seguridad", "elecciones", "mercado")
- SI incluir: variaciones del nombre del cliente (con/sin acentos, abreviaciones, siglas)
- SI incluir: cargos especificos que ocupa (ej: "alcalde de Apodaca", no solo "alcalde")
- SI incluir: nombres de proyectos, programas o iniciativas mencionados en las noticias
- SI incluir: alias o apodos que la prensa usa para referirse al cliente
- Cada keyword debe ser lo suficientemente especifico para NO generar falsos positivos

EJEMPLOS DE KEYWORDS BUENOS:
- "Samuel Garcia Sepulveda" (nombre completo)
- "gobernador de Nuevo Leon" (cargo especifico)
- "Plan Nuevo Leon" (programa especifico)

EJEMPLOS DE KEYWORDS MALOS (NO incluir):
- "Monterrey" (muy generico, genera miles de falsos positivos)
- "gobierno" (demasiado amplio)
- "seguridad publica" (aplica a cualquier politico)
- "economia" (generico de industria)

COMPETIDORES: Deben ser personas/organizaciones que compiten DIRECTAMENTE con el cliente (mismo cargo, mismo mercado). No incluir figuras publicas que simplemente aparecen en las noticias.

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "suggestedKeywords": [{"word": "keyword especifico", "type": "NAME", "confidence": 0.9, "reason": "razon basada en noticias"}],
  "competitors": ["nombre competidor directo 1"],
  "sensitiveTopics": ["tema sensible especifico"],
  "actionLines": ["linea de accion sugerida"],
  "recentMentions": [{"title": "titulo", "url": "url", "source": "fuente"}]
}

Tipos validos para keywords: NAME, BRAND, TOPIC, ALIAS
Los competidores van en el array "competitors", NO como keywords.

Incluye al menos:
- 5-10 keywords ESPECIFICOS (nombre, variantes, cargos con contexto, proyectos reales)
- 2-3 competidores DIRECTOS (en el array competitors)
- 2-3 temas sensibles especificos para ESTE cliente
- 3-5 lineas de accion para monitoreo proactivo

Cada keyword debe incluir "confidence" (0.0-1.0) y "reason" explicando por que es relevante.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
    });

    const rawText = result.response.text();
    console.log("[AI] Raw onboarding response:", rawText.slice(0, 300));

    const cleaned = cleanJsonResponse(rawText);
    return JSON.parse(cleaned) as OnboardingResult;
  } catch (error) {
    console.error("[AI] Failed to parse onboarding response:", error);
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

  const model = getGeminiModel();

  const prompt = `Eres un experto en comunicacion corporativa y relaciones publicas.
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

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "title": "Titulo del comunicado (conciso y profesional)",
  "body": "Cuerpo completo del comunicado (3-4 parrafos, incluye contexto, posicion del cliente, datos relevantes y cierre)",
  "tone": "PROFESSIONAL",
  "audience": "Publico objetivo principal (ej: medios generales, prensa especializada, stakeholders)",
  "callToAction": "Siguiente paso recomendado para el equipo de PR",
  "keyMessages": ["Mensaje clave 1", "Mensaje clave 2", "Mensaje clave 3"]
}

Tonos validos: PROFESSIONAL, DEFENSIVE, CLARIFICATION, CELEBRATORY`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1536, temperature: 0.4 },
    });

    const rawText = result.response.text();
    console.log("[AI] Raw generateResponse response:", rawText.slice(0, 300));

    const cleaned = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleaned) as ResponseGenerationResult;
    if (!["PROFESSIONAL", "DEFENSIVE", "CLARIFICATION", "CELEBRATORY"].includes(parsed.tone)) {
      parsed.tone = "PROFESSIONAL";
    }
    return parsed;
  } catch (error) {
    console.error("[AI] Failed to parse generateResponse response:", error);
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
  socialStats?: {
    totalPosts: number;
    platforms: Record<string, number>;
    totalEngagement: number;
    topPost?: { author: string; content: string; likes: number; platform: string };
  };
}): Promise<string> {
  const topMentionsText = params.topMentions
    .map((m) => `- ${m.title} (${m.source}, ${m.sentiment}, relevancia ${m.relevance}/10)`)
    .join("\n");

  let socialContext = "";
  if (params.socialStats && params.socialStats.totalPosts > 0) {
    const platformLine = Object.entries(params.socialStats.platforms)
      .map(([p, count]) => `${p}: ${count}`)
      .join(", ");
    socialContext = `\nRedes sociales: ${params.socialStats.totalPosts} publicaciones (${platformLine})
Engagement total: ${params.socialStats.totalEngagement} interacciones`;
    if (params.socialStats.topPost) {
      socialContext += `\nPost mas destacado: @${params.socialStats.topPost.author} en ${params.socialStats.topPost.platform} (${params.socialStats.topPost.likes} likes) - "${params.socialStats.topPost.content}"`;
    }
  }

  const model = getGeminiModel();

  const prompt = `Genera un resumen ejecutivo del dia para el equipo de PR del cliente "${params.clientName}".

Total menciones en medios: ${params.totalMentions}
Sentimiento: Positivas=${params.sentimentBreakdown.positive}, Negativas=${params.sentimentBreakdown.negative}, Neutras=${params.sentimentBreakdown.neutral}, Mixtas=${params.sentimentBreakdown.mixed}

Menciones mas relevantes:
${topMentionsText || "Ninguna relevante"}
${socialContext}

Escribe un resumen de 3-5 lineas en espanol, directo y accionable. Incluye contexto social si hay datos. No uses markdown ni formato especial.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.4 },
    });

    return result.response.text();
  } catch (error) {
    console.error("[AI] Failed to generate digest summary:", error);
    return "Resumen no disponible";
  }
}

// ==================== SPRINT 6: FUNCIONES DE INTELIGENCIA ====================

export interface TopicExtractionResult {
  topic: string;
  confidence: number;
  keywords: string[];
}

/**
 * Extrae el tema principal de una mencion usando IA.
 * Se usa para clustering tematico y deteccion de tendencias.
 */
export async function extractTopic(params: {
  articleTitle: string;
  articleContent: string;
  clientName: string;
  existingTopics?: string[];
}): Promise<TopicExtractionResult> {
  const existingTopicsHint = params.existingTopics?.length
    ? `\n\nTemas existentes en el sistema (usa uno de estos si aplica, o crea uno nuevo):
${params.existingTopics.slice(0, 20).join(", ")}`
    : "";

  const model = getGeminiModel();

  const prompt = `Extrae el tema principal de este articulo relacionado con "${params.clientName}".

Titulo: ${params.articleTitle}
Contenido: ${params.articleContent?.slice(0, 1000) || "No disponible"}
${existingTopicsHint}

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{"topic": "Nombre corto del tema (2-4 palabras)", "confidence": 0.85, "keywords": ["palabra1", "palabra2", "palabra3"]}

El tema debe ser especifico pero reutilizable para agrupar articulos similares.
Ejemplos: "Expansion internacional", "Resultados financieros", "Lanzamiento producto"`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.3 },
    });

    const rawText = result.response.text();
    console.log("[AI] extractTopic response:", rawText.slice(0, 150));

    const cleaned = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleaned) as TopicExtractionResult;
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    return parsed;
  } catch (error) {
    console.error("[AI] Failed to parse extractTopic response:", error);
    return {
      topic: "General",
      confidence: 0.3,
      keywords: [],
    };
  }
}

export interface WeeklyInsightsResult {
  insights: string[];
  sovAnalysis: string;
  topicsSummary: string;
  recommendedActions: string[];
  riskAlerts: string[];
}

/**
 * Genera insights semanales accionables basados en datos de la semana.
 */
export async function generateWeeklyInsights(params: {
  clientName: string;
  clientIndustry: string;
  weeklyStats: {
    totalMentions: number;
    previousWeekMentions: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number; mixed: number };
    sovPercentage: number;
    sovTrend: "up" | "down" | "stable";
  };
  topMentions: { title: string; source: string; sentiment: string }[];
  topTopics: { name: string; count: number }[];
  competitors?: { name: string; sov: number }[];
}): Promise<WeeklyInsightsResult> {
  const mentionsText = params.topMentions
    .slice(0, 5)
    .map((m) => `- ${m.title} (${m.source}, ${m.sentiment})`)
    .join("\n");

  const topicsText = params.topTopics
    .slice(0, 5)
    .map((t) => `- ${t.name}: ${t.count} menciones`)
    .join("\n");

  const competitorsText = params.competitors?.length
    ? params.competitors.map((c) => `- ${c.name}: ${c.sov.toFixed(1)}% SOV`).join("\n")
    : "No hay datos de competidores";

  const mentionTrend =
    params.weeklyStats.totalMentions > params.weeklyStats.previousWeekMentions
      ? "aumentaron"
      : params.weeklyStats.totalMentions < params.weeklyStats.previousWeekMentions
        ? "disminuyeron"
        : "se mantuvieron";

  const model = getGeminiModel();

  const prompt = `Genera insights semanales accionables para el equipo de PR del cliente "${params.clientName}" (industria: ${params.clientIndustry || "No especificada"}).

DATOS DE LA SEMANA:
- Menciones totales: ${params.weeklyStats.totalMentions} (${mentionTrend} vs semana anterior: ${params.weeklyStats.previousWeekMentions})
- Sentimiento: Positivas=${params.weeklyStats.sentimentBreakdown.positive}, Negativas=${params.weeklyStats.sentimentBreakdown.negative}, Neutras=${params.weeklyStats.sentimentBreakdown.neutral}
- Share of Voice: ${params.weeklyStats.sovPercentage.toFixed(1)}% (tendencia: ${params.weeklyStats.sovTrend})

MENCIONES DESTACADAS:
${mentionsText || "Ninguna relevante"}

TEMAS PRINCIPALES:
${topicsText || "Sin datos de temas"}

COMPETIDORES:
${competitorsText}

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "insights": ["Insight 1: observacion clave con dato especifico", "Insight 2: otra observacion relevante", "Insight 3: tendencia o patron detectado"],
  "sovAnalysis": "Analisis del Share of Voice y posicion competitiva en 1-2 oraciones",
  "topicsSummary": "Resumen de temas dominantes y emergentes en 1-2 oraciones",
  "recommendedActions": ["Accion 1: tarea especifica y accionable", "Accion 2: otra recomendacion practica"],
  "riskAlerts": ["Alerta si hay riesgos o senales de atencion (o array vacio si no hay)"]
}

Los insights deben ser especificos, con datos, y orientados a la accion.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
    });

    const rawText = result.response.text();
    console.log("[AI] generateWeeklyInsights response:", rawText.slice(0, 300));

    const cleaned = cleanJsonResponse(rawText);
    return JSON.parse(cleaned) as WeeklyInsightsResult;
  } catch (error) {
    console.error("[AI] Failed to parse generateWeeklyInsights response:", error);
    return {
      insights: ["No fue posible generar insights automaticos esta semana"],
      sovAnalysis: "Analisis no disponible",
      topicsSummary: "Resumen no disponible",
      recommendedActions: ["Revisar datos manualmente"],
      riskAlerts: [],
    };
  }
}

// ==================== DAILY BRIEF ====================

export interface ActiveTopicForBrief {
  name: string;
  mentionCount: number;
  socialMentionCount: number;
  dominantSentiment: string | null;
  topSources: string[];
  recentMentions: Array<{ title: string; source: string; sentiment: string }>;
}

export interface DailyBriefResult {
  highlights: string[];
  comparison: {
    mentionsDelta: number;
    sentimentShift: string;
    sovChange: string;
  };
  watchList: string[];
  emergingTopics: string[];
  pendingActions: string[];
}

/**
 * Genera un brief diario ejecutivo con IA para un cliente.
 * Usa TopicThreads agrupados en lugar de menciones individuales.
 */
export async function generateDailyBrief(params: {
  clientName: string;
  clientIndustry: string;
  todayStats: {
    mentions: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number; mixed: number };
    socialPosts: number;
    totalEngagement: number;
  };
  yesterdayStats: {
    mentions: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number; mixed: number };
  };
  sovPercentage: number;
  yesterdaySov: number;
  activeTopics: ActiveTopicForBrief[];
  activeCrises: number;
  pendingActionItems: string[];
}): Promise<DailyBriefResult> {
  const mentionsDelta = params.todayStats.mentions - params.yesterdayStats.mentions;
  const deltaSign = mentionsDelta > 0 ? "+" : "";

  const actionsText = params.pendingActionItems.length > 0
    ? params.pendingActionItems.slice(0, 5).map((a) => `- ${a}`).join("\n")
    : "Sin acciones pendientes";

  // Construir sección de temas activos
  let topicsText = "";
  if (params.activeTopics.length > 0) {
    for (const topic of params.activeTopics) {
      const totalMentions = topic.mentionCount + topic.socialMentionCount;
      topicsText += `\n  Tema: ${topic.name}\n`;
      topicsText += `  Menciones: ${topic.mentionCount} noticias + ${topic.socialMentionCount} posts sociales | Sentimiento: ${topic.dominantSentiment || "NEUTRAL"}\n`;
      if (topic.topSources.length > 0) {
        topicsText += `  Fuentes: ${topic.topSources.slice(0, 5).join(", ")}\n`;
      }
      if (topic.recentMentions.length > 0) {
        topicsText += `  Articulos representativos:\n`;
        for (const m of topic.recentMentions) {
          topicsText += `    - "${m.title}" (${m.source}, ${m.sentiment})\n`;
        }
      }
    }
  } else {
    topicsText = "  Sin temas activos hoy.";
  }

  const model = getGeminiModel();

  const prompt = `Genera un brief diario ejecutivo para el equipo de PR del cliente "${params.clientName}" (industria: ${params.clientIndustry || "No especificada"}).

DATOS DE HOY:
- Menciones: ${params.todayStats.mentions} (${deltaSign}${mentionsDelta} vs ayer: ${params.yesterdayStats.mentions})
- Sentimiento hoy: Positivas=${params.todayStats.sentimentBreakdown.positive}, Negativas=${params.todayStats.sentimentBreakdown.negative}, Neutras=${params.todayStats.sentimentBreakdown.neutral}
- Sentimiento ayer: Positivas=${params.yesterdayStats.sentimentBreakdown.positive}, Negativas=${params.yesterdayStats.sentimentBreakdown.negative}, Neutras=${params.yesterdayStats.sentimentBreakdown.neutral}
- SOV hoy: ${params.sovPercentage.toFixed(1)}% (ayer: ${params.yesterdaySov.toFixed(1)}%)
- Posts sociales: ${params.todayStats.socialPosts}, engagement total: ${params.todayStats.totalEngagement}
- Crisis activas: ${params.activeCrises}

TEMAS ACTIVOS HOY (agrupados por tema):
${topicsText}

ACCIONES PENDIENTES:
${actionsText}

Los highlights deben describir los TEMAS clave del dia, no articulos individuales.
Para cada tema, menciona cuantas fuentes lo cubrieron, el sentimiento dominante y cita fuentes especificas.
Si no hay temas activos, analiza las estadisticas generales disponibles.

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "highlights": ["Punto 1: observacion clave", "Punto 2: otra observacion", "...hasta 8 puntos"],
  "comparison": {
    "mentionsDelta": ${mentionsDelta},
    "sentimentShift": "descripcion breve del cambio de sentimiento vs ayer",
    "sovChange": "descripcion breve del cambio en SOV"
  },
  "watchList": ["Cosa a vigilar 1", "Cosa a vigilar 2"],
  "emergingTopics": ["Tema emergente detectado 1"],
  "pendingActions": ["Accion sugerida 1", "Accion sugerida 2"]
}

Los highlights deben ser especificos, con datos, y orientados a la accion. Maximo 8 highlights, 3 watch items, 3 acciones.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.4 },
    });

    const rawText = result.response.text();
    console.log("[AI] generateDailyBrief response:", rawText.slice(0, 300));

    const cleaned = cleanJsonResponse(rawText);
    return JSON.parse(cleaned) as DailyBriefResult;
  } catch (error) {
    console.error("[AI] Failed to parse generateDailyBrief response:", error);
    return {
      highlights: ["No fue posible generar el brief automatico hoy"],
      comparison: {
        mentionsDelta: 0,
        sentimentShift: "No disponible",
        sovChange: "No disponible",
      },
      watchList: ["Revisar datos manualmente"],
      emergingTopics: [],
      pendingActions: [],
    };
  }
}

// ==================== SOCIAL MEDIA: SUGERENCIAS DE HASHTAGS ====================

export interface SocialHashtagSuggestion {
  hashtag: string;
  platform: "TWITTER" | "INSTAGRAM" | "TIKTOK" | "ALL";
  confidence: number;
  reason: string;
}

export interface SuggestSocialHashtagsResult {
  hashtags: SocialHashtagSuggestion[];
  suggestedAccounts: Array<{
    platform: "TWITTER" | "INSTAGRAM" | "TIKTOK";
    handle: string;
    reason: string;
  }>;
}

/**
 * Sugiere hashtags y cuentas de redes sociales a monitorear
 * basado en el nombre del cliente, industria y descripción.
 */
export async function suggestSocialHashtags(params: {
  clientName: string;
  description?: string;
  industry?: string;
  existingKeywords?: string[];
}): Promise<SuggestSocialHashtagsResult> {
  const keywordsContext = params.existingKeywords?.length
    ? `\n\nKeywords de monitoreo de noticias actuales:\n${params.existingKeywords.slice(0, 15).join(", ")}`
    : "";

  const model = getGeminiModel();

  const prompt = `Eres un experto en marketing digital y monitoreo de redes sociales en Mexico y Latinoamerica.

CLIENTE:
Nombre: ${params.clientName}
Descripcion: ${params.description || "No proporcionada"}
Industria: ${params.industry || "No especificada"}${keywordsContext}

Genera hashtags y cuentas de redes sociales relevantes para monitorear a este cliente.

REGLAS:
- Los hashtags deben ser populares y relevantes en Mexico/Latam
- Incluir hashtags genericos de la industria y especificos del cliente
- Sugerir cuentas de competidores, influencers del sector, medios relevantes
- Considerar Twitter/X, Instagram y TikTok
- No incluir el simbolo # en los hashtags
- No incluir el simbolo @ en los handles

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "hashtags": [
    {"hashtag": "nombreSinHashtag", "platform": "ALL", "confidence": 0.85, "reason": "Por que es relevante"}
  ],
  "suggestedAccounts": [
    {"platform": "TWITTER", "handle": "username_sin_arroba", "reason": "Por que monitorear esta cuenta"}
  ]
}

Plataformas validas para hashtags: TWITTER, INSTAGRAM, TIKTOK, ALL
Plataformas validas para cuentas: TWITTER, INSTAGRAM, TIKTOK

Genera:
- 8-15 hashtags variados (mezcla de genericos e industria)
- 3-6 cuentas sugeridas (competidores, influencers, medios)`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
    });

    const rawText = result.response.text();
    console.log("[AI] suggestSocialHashtags response:", rawText.slice(0, 300));

    const cleaned = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleaned) as SuggestSocialHashtagsResult;

    // Validar plataformas
    const validPlatforms = ["TWITTER", "INSTAGRAM", "TIKTOK", "ALL"] as const;
    const validAccountPlatforms = ["TWITTER", "INSTAGRAM", "TIKTOK"] as const;

    parsed.hashtags = (parsed.hashtags || []).map((h) => ({
      ...h,
      hashtag: h.hashtag.replace(/^#/, ""),
      platform: validPlatforms.includes(h.platform as typeof validPlatforms[number])
        ? h.platform
        : "ALL",
      confidence: Math.max(0.5, Math.min(1, h.confidence || 0.7)),
    }));

    parsed.suggestedAccounts = (parsed.suggestedAccounts || []).map((a) => ({
      ...a,
      handle: a.handle.replace(/^@/, ""),
      platform: validAccountPlatforms.includes(a.platform as typeof validAccountPlatforms[number])
        ? a.platform
        : "TWITTER",
    }));

    return parsed;
  } catch (error) {
    console.error("[AI] Failed to parse suggestSocialHashtags response:", error);
    return {
      hashtags: [
        {
          hashtag: params.clientName.replace(/\s+/g, ""),
          platform: "ALL",
          confidence: 0.8,
          reason: "Nombre del cliente",
        },
      ],
      suggestedAccounts: [],
    };
  }
}

// ==================== SOCIAL MEDIA: ANALISIS DE MENCION ====================

export interface SocialMentionAnalysisResult {
  summary: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
  relevance: number;
  suggestedAction: string;
  engagementLevel: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Analiza una mencion de redes sociales.
 * Adaptado para contenido corto (tweets, captions, etc).
 */
export async function analyzeSocialMention(params: {
  platform: string;
  content: string;
  authorHandle: string;
  authorFollowers?: number;
  engagement: { likes: number; comments: number; shares: number; views?: number };
  clientName: string;
  clientDescription?: string;
  sourceType: string;
  sourceValue: string;
}): Promise<SocialMentionAnalysisResult> {
  const engagementText = `Likes: ${params.engagement.likes}, Comentarios: ${params.engagement.comments}, Compartidos: ${params.engagement.shares}${params.engagement.views ? `, Vistas: ${params.engagement.views}` : ""}`;
  const followersText = params.authorFollowers ? `Seguidores del autor: ${params.authorFollowers}` : "";

  const model = getGeminiModel();

  const prompt = `Analiza esta mencion en redes sociales para un cliente de PR.

CLIENTE: ${params.clientName}
Descripcion: ${params.clientDescription || "No disponible"}

POST EN ${params.platform.toUpperCase()}:
Autor: @${params.authorHandle}
${followersText}
Contenido: "${params.content || "(sin texto)"}"
Engagement: ${engagementText}
Detectado por: ${params.sourceType} "${params.sourceValue}"

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "summary": "Resumen ejecutivo de 1-2 lineas sobre la relevancia para el cliente",
  "sentiment": "NEUTRAL",
  "relevance": 5,
  "suggestedAction": "Accion concreta sugerida (ej: responder, monitorear, escalar)",
  "engagementLevel": "MEDIUM"
}

Valores de sentiment: POSITIVE, NEGATIVE, NEUTRAL, MIXED
Relevance: numero del 1 al 10
Valores de engagementLevel:
- HIGH: Viral o de influencer con >10k seguidores
- MEDIUM: Buen alcance o de cuenta verificada
- LOW: Alcance limitado`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
    });

    const rawText = result.response.text();
    console.log("[AI] analyzeSocialMention response:", rawText.slice(0, 200));

    const cleaned = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleaned) as SocialMentionAnalysisResult;

    // Validar y normalizar
    parsed.relevance = Math.max(1, Math.min(10, Math.round(parsed.relevance)));
    if (!["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"].includes(parsed.sentiment)) {
      parsed.sentiment = "NEUTRAL";
    }
    if (!["HIGH", "MEDIUM", "LOW"].includes(parsed.engagementLevel)) {
      parsed.engagementLevel = "MEDIUM";
    }

    return parsed;
  } catch (error) {
    console.error("[AI] Failed to parse analyzeSocialMention response:", error);
    return {
      summary: "Mencion detectada en redes sociales - analisis no disponible",
      sentiment: "NEUTRAL",
      relevance: 5,
      suggestedAction: "Revisar manualmente",
      engagementLevel: "MEDIUM",
    };
  }
}

// ==================== SOCIAL COMMENTS SENTIMENT ANALYSIS ====================

export interface CommentsAnalysisResult {
  overallSentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  keyThemes: string[];
  publicPerception: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  topConcerns: string[];
  recommendedAction: string;
}

/**
 * Analiza el sentimiento de los comentarios de un post social.
 * Se enfoca en la PERCEPCIÓN PÚBLICA, no en el contenido del post original.
 *
 * @param params - Parámetros del análisis
 * @returns Resultado del análisis de comentarios
 */
export async function analyzeCommentsSentiment(params: {
  platform: string;
  postContent: string | null;
  comments: Array<{ text: string; likes: number; authorHandle: string }>;
  clientName: string;
  clientDescription?: string;
  clientIndustry?: string;
  authorHandle?: string;
  authorFollowers?: number;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
}): Promise<CommentsAnalysisResult> {
  // Limitar comentarios para el prompt (los más relevantes por likes)
  const sortedComments = [...params.comments]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 30);

  const commentsText = sortedComments
    .map((c, i) => `${i + 1}. @${c.authorHandle} (${c.likes} likes): "${c.text}"`)
    .join("\n");

  const model = getGeminiModel();

  // Construir contexto de engagement si está disponible
  const engagementText = params.engagement
    ? `\nMETRICAS DEL POST:\n- Likes: ${params.engagement.likes.toLocaleString()}\n- Comentarios: ${params.engagement.comments.toLocaleString()}\n- Compartidos: ${params.engagement.shares.toLocaleString()}${params.engagement.views ? `\n- Vistas: ${params.engagement.views.toLocaleString()}` : ""}`
    : "";

  const authorText = params.authorHandle
    ? `\nAUTOR: @${params.authorHandle}${params.authorFollowers ? ` (${params.authorFollowers.toLocaleString()} seguidores)` : ""}`
    : "";

  const platformLabel = params.platform === "TIKTOK" ? "TikTok" : params.platform === "INSTAGRAM" ? "Instagram" : params.platform;

  const prompt = `Eres un analista de relaciones publicas especializado en redes sociales. Analiza los comentarios de este post de ${platformLabel} para entender la PERCEPCION PUBLICA hacia el cliente.

CLIENTE: ${params.clientName}
Descripcion del cliente: ${params.clientDescription || "No disponible"}
Giro/Industria: ${params.clientIndustry || "No especificada"}

RED SOCIAL: ${platformLabel}
${authorText}
${engagementText}

CONTENIDO/COPY DEL POST:
"${params.postContent || "(sin texto)"}"

COMENTARIOS DEL PUBLICO (${params.comments.length} total, mostrando los ${sortedComments.length} con mas likes):
${commentsText}

CONTEXTO PARA EL ANALISIS:
- El cliente "${params.clientName}" es monitoreado por una agencia de PR
- Necesitamos entender como el publico percibe al cliente en relacion a este post
- Considera el ratio de engagement (likes, comentarios, compartidos, vistas) para evaluar el alcance
- Presta atencion a comentarios negativos con muchos likes (potencialmente virales)
- Identifica si los comentarios mencionan directa o indirectamente al cliente

Analiza:
1. Sentimiento general de los comentarios HACIA EL CLIENTE (no del post en si)
2. Temas recurrentes, preocupaciones o elogios
3. Nivel de riesgo reputacional considerando el alcance del post y tono de comentarios
4. Comentarios negativos virales (muchos likes en comentarios criticos)
5. Oportunidades de comunicacion o respuesta para el equipo de PR

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "overallSentiment": "NEUTRAL",
  "sentimentBreakdown": {"positive": 40, "negative": 30, "neutral": 30},
  "keyThemes": ["tema1", "tema2", "tema3"],
  "publicPerception": "Resumen claro y accionable de 2-3 oraciones sobre como el publico percibe al cliente basado en estos comentarios, incluyendo el contexto del post y las metricas de engagement",
  "riskLevel": "MEDIUM",
  "topConcerns": ["preocupacion1", "preocupacion2"],
  "recommendedAction": "Accion especifica y practica sugerida para el equipo de PR"
}

Valores de overallSentiment: POSITIVE, NEGATIVE, NEUTRAL, MIXED
sentimentBreakdown: porcentajes que suman 100
Valores de riskLevel:
- HIGH: Comentarios mayoritariamente negativos con alto alcance, potencial crisis
- MEDIUM: Comentarios mixtos o negativos con alcance moderado, requiere monitoreo
- LOW: Comentarios positivos o neutrales, sin riesgo reputacional`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
    });

    const rawText = result.response.text();
    console.log("[AI] analyzeCommentsSentiment response:", rawText.slice(0, 300));

    const cleaned = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleaned) as CommentsAnalysisResult;

    // Validar y normalizar
    if (!["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"].includes(parsed.overallSentiment)) {
      parsed.overallSentiment = "NEUTRAL";
    }
    if (!["HIGH", "MEDIUM", "LOW"].includes(parsed.riskLevel)) {
      parsed.riskLevel = "MEDIUM";
    }

    // Normalizar breakdown
    const total = parsed.sentimentBreakdown.positive + parsed.sentimentBreakdown.negative + parsed.sentimentBreakdown.neutral;
    if (total !== 100 && total > 0) {
      const factor = 100 / total;
      parsed.sentimentBreakdown.positive = Math.round(parsed.sentimentBreakdown.positive * factor);
      parsed.sentimentBreakdown.negative = Math.round(parsed.sentimentBreakdown.negative * factor);
      parsed.sentimentBreakdown.neutral = 100 - parsed.sentimentBreakdown.positive - parsed.sentimentBreakdown.negative;
    }

    return parsed;
  } catch (error) {
    console.error("[AI] Failed to parse analyzeCommentsSentiment response:", error);
    return {
      overallSentiment: "NEUTRAL",
      sentimentBreakdown: { positive: 33, negative: 33, neutral: 34 },
      keyThemes: [],
      publicPerception: "Analisis automatico no disponible",
      riskLevel: "MEDIUM",
      topConcerns: [],
      recommendedAction: "Revisar comentarios manualmente",
    };
  }
}

// ==================== SPRINT 8: ONBOARDING MEJORADO ====================

export interface EnhancedOnboardingResult {
  suggestedKeywords: Array<{
    word: string;
    type: "NAME" | "BRAND" | "TOPIC" | "ALIAS";
    confidence: number;
    reason: string;
  }>;
  competitors: Array<{
    name: string;
    reason: string;
  }>;
  sensitiveTopics: string[];
  industryContext: string;
  monitoringStrategy: string[];
}

/**
 * Onboarding mejorado con analisis de noticias reales.
 * Genera keywords mas precisos basados en noticias recientes.
 */
export async function runEnhancedOnboarding(params: {
  clientName: string;
  description?: string;
  industry?: string;
  recentArticles: Array<{
    title: string;
    source: string;
    snippet?: string;
    publishedAt?: Date;
  }>;
}): Promise<EnhancedOnboardingResult> {
  const articlesContext = params.recentArticles
    .slice(0, 15)
    .map((a, i) => `${i + 1}. "${a.title}" - ${a.source}${a.snippet ? `\n   ${a.snippet.slice(0, 200)}` : ""}`)
    .join("\n\n");

  const model = getGeminiModel();

  const prompt = `Eres un experto en monitoreo de medios y relaciones publicas en Mexico.
Analiza las siguientes noticias recientes sobre un nuevo cliente y genera una estrategia de monitoreo.

CLIENTE:
Nombre: ${params.clientName}
Descripcion: ${params.description || "No proporcionada"}
Industria: ${params.industry || "No especificada"}

NOTICIAS RECIENTES ENCONTRADAS (${params.recentArticles.length} articulos):
${articlesContext || "No se encontraron noticias recientes"}

Basandote en estas noticias REALES, genera:

1. KEYWORDS: Palabras clave especificas que aparecen en las noticias
   - Incluye el nombre exacto del cliente y variaciones
   - Incluye nombres de productos/marcas mencionados
   - Incluye competidores que aparecen en las mismas noticias
   - Incluye temas especificos de la industria

2. COMPETIDORES: Empresas que compiten directamente (mencionadas o contextuales)

3. TEMAS SENSIBLES: Temas que requieren atencion especial

Responde UNICAMENTE con JSON valido, sin markdown ni texto adicional:
{
  "suggestedKeywords": [
    {"word": "palabra exacta", "type": "NAME", "confidence": 0.95, "reason": "Por que es relevante"}
  ],
  "competitors": [
    {"name": "Nombre del competidor", "reason": "Por que es competidor"}
  ],
  "sensitiveTopics": ["tema1", "tema2"],
  "industryContext": "Breve contexto de la industria y posicion del cliente",
  "monitoringStrategy": ["Estrategia 1", "Estrategia 2"]
}

Tipos validos para keywords: NAME, BRAND, TOPIC, ALIAS
Los competidores van en el array "competitors", NO como keywords.

IMPORTANTE:
- Genera al menos 8-12 keywords variados y especificos
- Los keywords deben ser REALES, basados en las noticias proporcionadas
- Incluye variaciones del nombre (con/sin acentos, abreviaciones)
- La confianza debe reflejar cuantas veces aparece en las noticias`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
    });

    const rawText = result.response.text();
    console.log("[AI] Enhanced onboarding response:", rawText.slice(0, 400));

    const cleaned = cleanJsonResponse(rawText);
    const parsed = JSON.parse(cleaned) as EnhancedOnboardingResult;

    // Validar tipos de keywords
    const validTypes = ["NAME", "BRAND", "TOPIC", "ALIAS"] as const;
    parsed.suggestedKeywords = parsed.suggestedKeywords.map((kw) => ({
      ...kw,
      type: validTypes.includes(kw.type as typeof validTypes[number]) ? kw.type : "TOPIC",
      confidence: Math.max(0.5, Math.min(1, kw.confidence || 0.7)),
    }));

    return parsed;
  } catch (error) {
    console.error("[AI] Failed to parse enhanced onboarding response:", error);
    return {
      suggestedKeywords: [
        {
          word: params.clientName,
          type: "NAME",
          confidence: 1,
          reason: "Nombre del cliente",
        },
      ],
      competitors: [],
      sensitiveTopics: [],
      industryContext: "Configuracion manual requerida",
      monitoringStrategy: ["Agregar keywords manualmente"],
    };
  }
}
