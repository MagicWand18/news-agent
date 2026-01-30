import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

/**
 * Singleton para el cliente de Anthropic.
 * Centraliza la configuración y evita múltiples instancias.
 */
let anthropicClient: Anthropic | null = null;

/**
 * Obtiene la instancia singleton del cliente Anthropic.
 * Crea una nueva instancia si no existe.
 * @throws Error si ANTHROPIC_API_KEY no está configurada
 */
export function getAnthropicClient(): Anthropic {
  if (!config.anthropic.apiKey) {
    throw new Error("[AI Client] ANTHROPIC_API_KEY no configurada");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }
  return anthropicClient;
}

/**
 * Reinicia el cliente singleton.
 * @internal Solo para uso en tests.
 */
export function resetAnthropicClient(): void {
  anthropicClient = null;
}
