"use client";

import { useState, useEffect } from "react";
import { useRealtimeContext } from "./realtime-provider";
import {
  REALTIME_EVENT_TYPES,
  type RealtimeEventData,
} from "@/lib/realtime-types";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Newspaper, Radio } from "lucide-react";

interface LiveMention {
  id: string;
  title: string;
  source: string;
  sentiment?: string;
  urgency?: string;
  timestamp: string;
  isNew: boolean;
}

/**
 * Componente de feed en vivo que muestra menciones analizadas en tiempo real.
 * Se suscribe al evento MENTION_ANALYZED y muestra las ultimas 20 menciones.
 */
export function LiveFeed() {
  const { connected, subscribe } = useRealtimeContext();
  const [mentions, setMentions] = useState<LiveMention[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    return subscribe(
      REALTIME_EVENT_TYPES.MENTION_ANALYZED,
      (data: RealtimeEventData) => {
        const mention: LiveMention = {
          id: data.id,
          title: data.title || "Nueva mencion",
          source: data.source || "Desconocido",
          sentiment: data.sentiment,
          urgency: data.urgency,
          timestamp: data.timestamp,
          isNew: true,
        };

        setMentions((prev) => {
          const updated = [mention, ...prev].slice(0, 20);
          return updated;
        });
        setUnseenCount((c) => c + 1);

        // Quitar animacion "isNew" despues de 2 segundos
        setTimeout(() => {
          setMentions((prev) =>
            prev.map((m) =>
              m.id === mention.id ? { ...m, isNew: false } : m
            )
          );
        }, 2000);
      }
    );
  }, [subscribe]);

  const sentimentColor: Record<string, string> = {
    POSITIVE:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    NEGATIVE:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    NEUTRAL:
      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
    MIXED:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  const urgencyColor: Record<string, string> = {
    CRITICAL: "bg-red-500 text-white",
    HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    MEDIUM:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    LOW: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };

  if (mentions.length === 0 && !connected) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded) setUnseenCount(0);
        }}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              connected ? "bg-green-500 animate-pulse" : "bg-gray-400"
            )}
          />
          <Radio className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            En vivo
          </span>
          {unseenCount > 0 && expanded === false && (
            <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
              {unseenCount} nueva{unseenCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {mentions.length} menciones
        </span>
      </button>

      {expanded && mentions.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto border-t border-gray-100 dark:border-gray-700">
          {mentions.map((m) => (
            <Link
              key={m.id + m.timestamp}
              href={`/dashboard/mentions/${m.id}`}
              className={cn(
                "flex items-center gap-3 border-b border-gray-50 px-4 py-3 transition-all hover:bg-gray-50 last:border-b-0 dark:border-gray-700/50 dark:hover:bg-gray-700/50",
                m.isNew &&
                  "animate-slide-down bg-blue-50/50 dark:bg-blue-900/10"
              )}
            >
              <Newspaper className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {m.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {m.source} &middot;{" "}
                  {new Date(m.timestamp).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex gap-1.5">
                {m.sentiment && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      sentimentColor[m.sentiment] || ""
                    )}
                  >
                    {m.sentiment === "POSITIVE"
                      ? "+"
                      : m.sentiment === "NEGATIVE"
                        ? "\u2212"
                        : "~"}
                  </span>
                )}
                {m.urgency && m.urgency !== "LOW" && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      urgencyColor[m.urgency] || ""
                    )}
                  >
                    {m.urgency}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {expanded && mentions.length === 0 && (
        <div className="border-t border-gray-100 px-4 py-8 text-center dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {connected ? "Esperando nuevas menciones..." : "Conectando..."}
          </p>
        </div>
      )}
    </div>
  );
}
