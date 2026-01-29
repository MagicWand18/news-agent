"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";

interface FilterChip {
  key: string;
  label: string;
  value: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  className?: string;
}

export function FilterChips({ chips, onRemove, className }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
        >
          <span className="text-brand-400 dark:text-brand-500">{chip.label}:</span>
          {chip.value}
          <button
            onClick={() => onRemove(chip.key)}
            className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-brand-100 dark:hover:bg-brand-800/50"
            aria-label={`Remover filtro ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
