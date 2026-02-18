"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  RealtimeEvent,
  RealtimeEventType,
  RealtimeEventData,
} from "@/lib/realtime-types";

interface UseRealtimeOptions {
  /** Habilita o deshabilita la conexion SSE */
  enabled?: boolean;
}

/**
 * Hook de conexion SSE con reconexion automatica (backoff exponencial).
 * Proporciona un sistema pub/sub para eventos en tiempo real.
 */
export function useRealtime(options: UseRealtimeOptions = {}) {
  const { enabled = true } = options;
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const listenersRef = useRef<
    Map<string, Set<(data: RealtimeEventData) => void>>
  >(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const subscribe = useCallback(
    (
      type: RealtimeEventType,
      callback: (data: RealtimeEventData) => void
    ) => {
      if (!listenersRef.current.has(type)) {
        listenersRef.current.set(type, new Set());
      }
      listenersRef.current.get(type)!.add(callback);
      return () => {
        listenersRef.current.get(type)?.delete(callback);
      };
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      const es = new EventSource("/api/events");
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        retryCountRef.current = 0;
      };

      // Escuchar todos los tipos de evento
      const eventTypes = [
        "mention:new",
        "mention:analyzed",
        "social:new",
        "crisis:new",
      ];
      eventTypes.forEach((type) => {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as RealtimeEventData;
            const event: RealtimeEvent = {
              type: type as RealtimeEventType,
              data,
            };

            // Mantener maximo 50 eventos recientes
            setEvents((prev) => [event, ...prev].slice(0, 50));

            // Despachar a suscriptores
            listenersRef.current.get(type)?.forEach((cb) => cb(data));
          } catch (err) {
            console.error("[Realtime] Error al parsear evento:", err);
          }
        });
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Reconexion con backoff exponencial (max 30s)
        const delay = Math.min(
          1000 * Math.pow(2, retryCountRef.current),
          30000
        );
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      setConnected(false);
    };
  }, [enabled]);

  return { connected, events, subscribe };
}
