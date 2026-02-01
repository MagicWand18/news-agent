"use client";

import { cn } from "@/lib/cn";
import { useCountUp } from "@/hooks/use-count-up";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  subtitle?: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export function StatCard({ title, value, icon, trend, subtitle, className, animate = false }: StatCardProps) {
  const numericValue = typeof value === "number" ? value : parseInt(value, 10);
  const isNumeric = !isNaN(numericValue);
  const animatedValue = useCountUp(isNumeric && animate ? numericValue : 0, 1200);

  const displayValue = animate && isNumeric ? animatedValue : value;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md",
        "dark:border-gray-700 dark:bg-gray-800",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{displayValue}</p>
          {trend && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold",
                  trend.value >= 0
                    ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{trend.label}</span>
            </div>
          )}
          {subtitle}
        </div>
        <div className="rounded-xl bg-brand-50 p-3 text-brand-600 transition-transform group-hover:scale-110 dark:bg-brand-900/30 dark:text-brand-400">
          {icon}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-brand-500 to-blue-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-gray-700" />
      </div>
    </div>
  );
}
