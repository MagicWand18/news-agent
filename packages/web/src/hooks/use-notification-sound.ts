"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRealtimeContext } from "@/components/realtime-provider";
import { REALTIME_EVENT_TYPES } from "@/lib/realtime-types";

const STORAGE_KEY = "mediabot-sound-enabled";

/**
 * Hook para reproducir sonido de alerta cuando llegan menciones CRITICAL.
 * La preferencia de sonido se persiste en localStorage.
 */
export function useNotificationSound() {
  const { subscribe } = useRealtimeContext();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Leer preferencia de localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setSoundEnabled(true);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Suscribir a menciones CRITICAL para reproducir sonido
  useEffect(() => {
    if (!soundEnabled) return;

    return subscribe(REALTIME_EVENT_TYPES.MENTION_ANALYZED, (data) => {
      if (data.urgency === "CRITICAL") {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio("/sounds/alert-critical.wav");
          }
          audioRef.current.play().catch(() => {
            // Autoplay policy — el usuario no ha interactuado aun
          });
        } catch {
          // Audio no soportado
        }
      }
    });
  }, [soundEnabled, subscribe]);

  return { soundEnabled, toggleSound };
}
