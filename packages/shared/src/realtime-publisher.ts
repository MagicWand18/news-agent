/**
 * Publisher de eventos en tiempo real via Redis Pub/Sub.
 * Solo para uso en workers/server-side — NO importar en client.
 * NO se exporta desde el barrel index.ts para evitar problemas con BullMQ en client.
 */

import Redis from "ioredis";
import { config } from "./config.js";
import type { RealtimeChannel, RealtimeEventData } from "./realtime-types.js";

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    publisher.connect().catch((err: unknown) => {
      console.error("[Realtime] Error connecting Redis publisher:", err);
    });
  }
  return publisher;
}

/**
 * Publica un evento en tiempo real via Redis Pub/Sub.
 * Fire-and-forget: si no hay subscribers, el evento se pierde (aceptable).
 */
export async function publishRealtimeEvent(
  channel: RealtimeChannel,
  data: RealtimeEventData
): Promise<void> {
  try {
    const redis = getPublisher();
    await redis.publish(channel, JSON.stringify(data));
  } catch (error) {
    // Fire-and-forget: no bloquear el worker si Redis falla
    console.error("[Realtime] Failed to publish event:", error);
  }
}

/**
 * Cierra la conexión del publisher (para shutdown graceful).
 */
export async function closeRealtimePublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}
