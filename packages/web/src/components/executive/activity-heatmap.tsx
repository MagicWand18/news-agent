"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";

interface HeatmapDataPoint {
  dayOfWeek: number; // 0=domingo, 6=sábado
  hour: number; // 0-23
  count: number;
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function getIntensity(count: number, max: number): string {
  if (max === 0 || count === 0) return "bg-gray-100 dark:bg-gray-700";
  const ratio = count / max;
  if (ratio >= 0.75) return "bg-green-600 dark:bg-green-500";
  if (ratio >= 0.5) return "bg-green-400 dark:bg-green-600";
  if (ratio >= 0.25) return "bg-green-300 dark:bg-green-700";
  return "bg-green-100 dark:bg-green-900";
}

export function ActivityHeatmap({ data }: { data: HeatmapDataPoint[] }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    day: string;
    hour: number;
    count: number;
  } | null>(null);

  // Construir mapa de lookup
  const dataMap = new Map<string, number>();
  let maxCount = 0;
  for (const d of data) {
    const key = `${d.dayOfWeek}-${d.hour}`;
    dataMap.set(key, d.count);
    if (d.count > maxCount) maxCount = d.count;
  }

  // Horas a mostrar (labels cada 3 horas)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Actividad por dia y hora
      </h3>

      <div className="relative overflow-x-auto">
        <div className="inline-block min-w-[600px]">
          {/* Header con horas */}
          <div className="flex items-center gap-0.5 pl-10 mb-1">
            {hours.map((h) => (
              <div
                key={h}
                className="flex-1 text-center text-[9px] font-medium text-gray-400 dark:text-gray-500"
              >
                {h % 3 === 0 ? `${h}h` : ""}
              </div>
            ))}
          </div>

          {/* Grid de celdas */}
          {DAY_LABELS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-0.5 mb-0.5">
              <span className="w-9 text-right text-xs font-medium text-gray-500 dark:text-gray-400 pr-1">
                {day}
              </span>
              {hours.map((hour) => {
                const count = dataMap.get(`${dayIdx}-${hour}`) || 0;
                return (
                  <div
                    key={hour}
                    className={cn(
                      "flex-1 aspect-square rounded-sm cursor-pointer transition-opacity hover:opacity-80 min-w-[16px] min-h-[16px]",
                      getIntensity(count, maxCount)
                    )}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10,
                        day,
                        hour,
                        count,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}

          {/* Leyenda */}
          <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Menos</span>
            <div className="h-3 w-3 rounded-sm bg-gray-100 dark:bg-gray-700" />
            <div className="h-3 w-3 rounded-sm bg-green-100 dark:bg-green-900" />
            <div className="h-3 w-3 rounded-sm bg-green-300 dark:bg-green-700" />
            <div className="h-3 w-3 rounded-sm bg-green-400 dark:bg-green-600" />
            <div className="h-3 w-3 rounded-sm bg-green-600 dark:bg-green-500" />
            <span>Mas</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.day} {tooltip.hour}:00 — {tooltip.count} menciones
        </div>
      )}
    </div>
  );
}
