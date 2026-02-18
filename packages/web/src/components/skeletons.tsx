/**
 * Componentes skeleton reutilizables con animate-pulse.
 * Usados como placeholders de carga en todas las páginas del dashboard.
 */

import { cn } from "@/lib/cn";

interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

export function SkeletonLine({ width = "w-32", height = "h-4", className }: SkeletonLineProps) {
  return (
    <div className={cn("animate-pulse rounded bg-gray-200 dark:bg-gray-700", width, height, className)} />
  );
}

interface SkeletonBlockProps {
  width?: string;
  height?: string;
  className?: string;
}

export function SkeletonBlock({ width = "w-full", height = "h-24", className }: SkeletonBlockProps) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700", width, height, className)} />
  );
}

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 8, cols = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800", className)}>
      {/* Header */}
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-3 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-600",
                i === 0 ? "w-48" : i === cols - 1 ? "w-20" : "w-24"
              )}
            />
          ))}
        </div>
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 border-b border-gray-50 px-6 py-4 last:border-b-0 dark:border-gray-700/50"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className={cn(
                "h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700",
                colIdx === 0 ? "w-48" : colIdx === cols - 1 ? "w-20" : "w-24"
              )}
              style={{ animationDelay: `${rowIdx * 50 + colIdx * 20}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface ChartSkeletonProps {
  height?: string;
  className?: string;
}

export function ChartSkeleton({ height = "h-[300px]", className }: ChartSkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800", className)}>
      <div className="mb-4 space-y-2">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className={cn("flex items-end justify-between gap-2", height)}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-gray-200 dark:bg-gray-700"
            style={{
              height: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface CardGridSkeletonProps {
  count?: number;
  className?: string;
}

export function CardGridSkeleton({ count = 6, className }: CardGridSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="mb-3 h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mb-2 h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mb-4 h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FilterBarSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}
