/**
 * SSE endpoint para eventos en tiempo real.
 * Suscribe a canales Redis Pub/Sub y reenvía eventos filtrados por organización.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Redis from "ioredis";
import {
  REALTIME_CHANNELS,
  CHANNEL_TO_EVENT,
  type RealtimeChannel,
  type RealtimeEventData,
} from "@/lib/realtime-types";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const KEEPALIVE_INTERVAL_MS = 30_000;

export async function GET(request: Request) {
  // Autenticación
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId, isSuperAdmin } = session.user;

  // Canales a los que suscribirse
  const channels = Object.values(REALTIME_CHANNELS);

  // Crear subscriber de Redis
  const subscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await subscriber.connect();
  await subscriber.subscribe(...channels);

  // Crear el ReadableStream para SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Enviar evento inicial de conexión
      controller.enqueue(
        encoder.encode(": connected\n\n")
      );

      // Handler de mensajes Redis
      const onMessage = (channel: string, message: string) => {
        try {
          const data = JSON.parse(message) as RealtimeEventData;

          // Filtrar por organización: SuperAdmin ve todo, otros solo su org
          if (!isSuperAdmin && data.orgId !== orgId) {
            return;
          }

          // Mapear canal a tipo de evento SSE
          const eventType = CHANNEL_TO_EVENT[channel as RealtimeChannel];
          if (!eventType) return;

          // Formato SSE
          const sseMessage = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));
        } catch (error) {
          console.error("[SSE] Error processing message:", error);
        }
      };

      subscriber.on("message", onMessage);

      // Keepalive cada 30 segundos
      const keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Stream cerrado, limpiar
          clearInterval(keepaliveTimer);
        }
      }, KEEPALIVE_INTERVAL_MS);

      // Cleanup cuando el cliente se desconecta
      request.signal.addEventListener("abort", () => {
        clearInterval(keepaliveTimer);
        subscriber.unsubscribe(...channels).catch(() => {});
        subscriber.quit().catch(() => {});
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
