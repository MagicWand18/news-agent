"use client";

import { cn } from "@/lib/cn";
import { useMemo, useState } from "react";

interface HeatmapDataPoint {
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  count: number;
}

const DAY_NAMES: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mie",
  4: "Jue",
  5: "Vie",
  6: "Sab",
};

function getIntensity(count: number, max: number): string {
  if (max === 0 || count === 0) return "bg-gray-100 dark:bg-gray-700";
  const ratio = count / max;
  if (ratio >= 0.75) return "bg-green-600 dark:bg-green-500";
  if (ratio >= 0.5) return "bg-green-400 dark:bg-green-600";
  if (ratio >= 0.25) return "bg-green-300 dark:bg-green-700";
  return "bg-green-100 dark:bg-green-900";
}

/** Formatea una fecha YYYY-MM-DD como "Lun 10/02" */
function formatDateLabel(dateStr: string): string {
  // Parsear como fecha local (evitar offset UTC)
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = DAY_NAMES[d.getDay()] ?? "";
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${dayName} ${dd}/${mm}`;
}

export function ActivityHeatmap({ data }: { data: HeatmapDataPoint[] }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    hour: number;
    count: number;
  } | null>(null);

  // Construir lista de fechas únicas ordenadas + mapa de lookup
  const { dates, dataMap, maxCount } = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;
    const dateSet = new Set<string>();

    for (const d of data) {
      const key = `${d.date}-${d.hour}`;
      map.set(key, d.count);
      if (d.count > max) max = d.count;
      dateSet.add(d.date);
    }

    // Generar rango completo de fechas (llenar huecos)
    const sortedDates = [...dateSet].sort();
    let allDates: string[] = sortedDates;

    if (sortedDates.length >= 2) {
      const start = new Date(sortedDates[0] + "T00:00:00");
      const end = new Date(sortedDates[sortedDates.length - 1] + "T00:00:00");
      allDates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        allDates.push(`${yyyy}-${mm}-${dd}`);
      }
    }

    return { dates: allDates, dataMap: map, maxCount: max };
  }, [data]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Actividad por dia y hora
      </h3>

      <div className="relative overflow-x-auto w-full">
        <div className="w-full">
          {/* Header con horas */}
          <div className="flex items-center gap-px pl-20 mb-1">
            {hours.map((h) => (
              <div
                key={h}
                className="flex-1 text-center text-[9px] font-medium text-gray-400 dark:text-gray-500"
              >
                {h % 3 === 0 ? `${h}h` : ""}
              </div>
            ))}
          </div>

          {/* Grid de celdas — una fila por fecha */}
          {dates.map((dateStr) => {
            const label = formatDateLabel(dateStr);
            return (
              <div key={dateStr} className="flex items-center gap-px mb-px">
                <span className="w-20 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 pr-2 shrink-0">
                  {label}
                </span>
                {hours.map((hour) => {
                  const count = dataMap.get(`${dateStr}-${hour}`) || 0;
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 rounded-[2px] cursor-pointer transition-opacity hover:opacity-80",
                        "h-[14px] min-w-[8px]",
                        getIntensity(count, maxCount)
                      )}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 10,
                          label,
                          hour,
                          count,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            );
          })}

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
          {tooltip.label} {tooltip.hour}:00 — {tooltip.count} menciones
        </div>
      )}
    </div>
  );
}
