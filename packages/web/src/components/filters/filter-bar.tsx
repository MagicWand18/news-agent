"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";

interface FilterBarProps {
  children: React.ReactNode;
  onClear?: () => void;
  activeCount?: number;
  className?: string;
}

export function FilterBar({ children, onClear, activeCount = 0, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50",
        className
      )}
    >
      {children}
      {activeCount > 0 && onClear && (
        <button
          onClick={onClear}
          className="ml-auto flex items-center gap-1 rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          <X className="h-3.5 w-3.5" />
          Limpiar ({activeCount})
        </button>
      )}
    </div>
  );
}
