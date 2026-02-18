"use client";

import { createContext, useContext, useRef, useEffect } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import type {
  RealtimeEvent,
  RealtimeEventType,
  RealtimeEventData,
} from "@/lib/realtime-types";
import { useSession } from "next-auth/react";

interface RealtimeContextValue {
  connected: boolean;
  events: RealtimeEvent[];
  subscribe: (
    type: RealtimeEventType,
    callback: (data: RealtimeEventData) => void
  ) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Provider de eventos en tiempo real.
 * Solo se conecta al SSE si el usuario esta autenticado.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { connected, events, subscribe } = useRealtime({
    enabled: isAuthenticated,
  });

  return (
    <RealtimeContext.Provider value={{ connected, events, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Hook para acceder al contexto de realtime.
 * Debe usarse dentro de RealtimeProvider.
 */
export function useRealtimeContext() {
  const ctx = useContext(RealtimeContext);
  if (!ctx)
    throw new Error(
      "useRealtimeContext debe usarse dentro de RealtimeProvider"
    );
  return ctx;
}

/**
 * Hook para suscribirse a un tipo de evento especifico.
 * El callback se mantiene estable via ref para evitar re-suscripciones.
 */
export function useRealtimeEvent(
  type: RealtimeEventType,
  callback: (data: RealtimeEventData) => void
) {
  const { subscribe } = useRealtimeContext();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return subscribe(type, (data) => callbackRef.current(data));
  }, [type, subscribe]);
}
