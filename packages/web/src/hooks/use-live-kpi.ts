"use client";

import { useEffect, useState, useCallback } from "react";
import { useRealtimeContext } from "@/components/realtime-provider";
import { REALTIME_EVENT_TYPES } from "@/lib/realtime-types";

/**
 * Hook que acumula deltas de KPIs en tiempo real.
 * Incrementa contadores cuando llegan eventos nuevos de mencion, social o crisis.
 */
export function useLiveKPI() {
  const { subscribe } = useRealtimeContext();
  const [deltas, setDeltas] = useState({ mentions: 0, social: 0, crisis: 0 });

  const reset = useCallback(() => {
    setDeltas({ mentions: 0, social: 0, crisis: 0 });
  }, []);

  useEffect(() => {
    const unsub1 = subscribe(REALTIME_EVENT_TYPES.MENTION_NEW, () => {
      setDeltas((d) => ({ ...d, mentions: d.mentions + 1 }));
    });
    const unsub2 = subscribe(REALTIME_EVENT_TYPES.SOCIAL_NEW, () => {
      setDeltas((d) => ({ ...d, social: d.social + 1 }));
    });
    const unsub3 = subscribe(REALTIME_EVENT_TYPES.CRISIS_NEW, () => {
      setDeltas((d) => ({ ...d, crisis: d.crisis + 1 }));
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [subscribe]);

  return { deltas, reset };
}
