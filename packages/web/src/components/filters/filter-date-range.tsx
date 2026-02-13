"use client";

import { cn } from "@/lib/cn";
import { Calendar } from "lucide-react";
import { useState } from "react";

interface DatePreset {
  label: string;
  days: number;
}

interface FilterDateRangeProps {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
  presets?: DatePreset[];
  className?: string;
}

const DEFAULT_PRESETS: DatePreset[] = [
  { label: "Hoy", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
];

export function FilterDateRange({
  startDate,
  endDate,
  onChange,
  presets = DEFAULT_PRESETS,
  className,
}: FilterDateRangeProps) {
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetClick = (days: number) => {
    const end = new Date();
    const start = new Date();
    if (days > 0) {
      start.setDate(start.getDate() - days);
    }
    onChange(start.toISOString().split("T")[0], end.toISOString().split("T")[0]);
    setShowCustom(false);
  };

  const handleClear = () => {
    onChange(null, null);
    setShowCustom(false);
  };

  const isActivePreset = (days: number): boolean => {
    if (!startDate || !endDate) return false;
    const end = new Date();
    const start = new Date();
    if (days > 0) {
      start.setDate(start.getDate() - days);
    }
    return (
      startDate === start.toISOString().split("T")[0] &&
      endDate === end.toISOString().split("T")[0]
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        <Calendar className="mr-1 inline h-3.5 w-3.5" />
        Periodo
      </label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset.days)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isActivePreset(preset.days)
                ? "bg-brand-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            showCustom || (startDate && !presets.some((p) => isActivePreset(p.days)))
              ? "bg-brand-500 text-white"
              : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          )}
        >
          Personalizado
        </button>
        {(startDate || endDate) && (
          <button
            onClick={handleClear}
            className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Limpiar
          </button>
        )}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 pt-2">
          <input
            type="date"
            value={startDate || ""}
            onChange={(e) => onChange(e.target.value || null, endDate)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-gray-400 dark:text-gray-500">-</span>
          <input
            type="date"
            value={endDate || ""}
            onChange={(e) => onChange(startDate, e.target.value || null)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      )}
    </div>
  );
}
