import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { config } from "./config";

/**
 * Singleton para el cliente de Google Generative AI (Gemini).
 * Centraliza la configuración y evita múltiples instancias.
 */
let geminiClient: GoogleGenerativeAI | null = null;
let geminiModel: GenerativeModel | null = null;
let currentModelName: string | null = null;

/**
 * Obtiene la instancia singleton del cliente Gemini.
 * @throws Error si GOOGLE_API_KEY no está configurada
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!config.google.apiKey) {
    throw new Error("[Gemini Client] GOOGLE_API_KEY no configurada");
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(config.google.apiKey);
  }
  return geminiClient;
}

/**
 * Obtiene la instancia del modelo Gemini.
 * @param modelName - Nombre del modelo (default: config.ai.model)
 */
export function getGeminiModel(modelName?: string): GenerativeModel {
  const targetModel = modelName || config.ai.model;

  // Si el modelo ya existe y es el mismo, reutilizar
  if (geminiModel && currentModelName === targetModel) {
    return geminiModel;
  }

  const client = getGeminiClient();
  geminiModel = client.getGenerativeModel({
    model: targetModel,
    generationConfig: {
      temperature: 0.3,
    },
  });
  currentModelName = targetModel;

  return geminiModel;
}

/**
 * Extrae JSON de respuestas que pueden venir envueltas en markdown.
 */
export function cleanJsonResponse(text: string): string {
  // Intentar extraer de bloques ```json ... ``` o ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
}

/**
 * Genera una respuesta estructurada (JSON) usando Gemini.
 * Wrapper conveniente para llamadas que esperan JSON.
 *
 * @param prompt - El prompt a enviar
 * @param maxTokens - Límite de tokens (default: 1024)
 * @returns El JSON parseado como tipo T
 */
export async function generateStructuredResponse<T>(
  prompt: string,
  maxTokens: number = 1024
): Promise<T> {
  const model = getGeminiModel();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,
    },
  });

  const response = result.response;
  const text = response.text();

  const cleaned = cleanJsonResponse(text);
  return JSON.parse(cleaned) as T;
}

/**
 * Genera texto simple usando Gemini (sin parsing de JSON).
 *
 * @param prompt - El prompt a enviar
 * @param maxTokens - Límite de tokens (default: 512)
 * @returns El texto de respuesta
 */
export async function generateText(
  prompt: string,
  maxTokens: number = 512
): Promise<string> {
  const model = getGeminiModel();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,
    },
  });

  return result.response.text();
}

/**
 * Reinicia el cliente singleton.
 * @internal Solo para uso en tests.
 */
export function resetGeminiClient(): void {
  geminiClient = null;
  geminiModel = null;
  currentModelName = null;
}
