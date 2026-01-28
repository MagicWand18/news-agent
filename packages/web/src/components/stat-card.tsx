import { cn } from "@/lib/cn";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold",
                  trend.value >= 0
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-brand-50 p-3 text-brand-600 transition-transform group-hover:scale-110">
          {icon}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-brand-500 to-blue-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-8 w-16 rounded bg-gray-200" />
        </div>
        <div className="h-12 w-12 rounded-xl bg-gray-100" />
      </div>
    </div>
  );
}
