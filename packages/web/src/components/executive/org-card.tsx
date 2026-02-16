"use client";

import { cn } from "@/lib/cn";
import {
  Users,
  Newspaper,
  Share2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

interface OrgCardProps {
  orgId: string;
  orgName: string;
  clientCount: number;
  mentionCount: number;
  socialMentionCount: number;
  activeCrises: number;
  avgSentiment: number;
  topClient: { id: string; name: string; mentionCount: number } | null;
}

export function OrgCard({ data }: { data: OrgCardProps }) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-900/20 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
          {data.orgName}
        </h3>
        {data.activeCrises > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.activeCrises}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat
          icon={<Users className="h-3.5 w-3.5" />}
          label="Clientes"
          value={data.clientCount}
        />
        <MiniStat
          icon={<Newspaper className="h-3.5 w-3.5" />}
          label="Menciones"
          value={data.mentionCount}
        />
        <MiniStat
          icon={<Share2 className="h-3.5 w-3.5" />}
          label="Social"
          value={data.socialMentionCount}
        />
        <MiniStat
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Sentimiento"
          value={`${data.avgSentiment.toFixed(0)}%`}
          valueColor={
            data.avgSentiment >= 60
              ? "text-green-600 dark:text-green-400"
              : data.avgSentiment < 40
                ? "text-red-600 dark:text-red-400"
                : undefined
          }
        />
      </div>

      {data.topClient && (
        <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Top cliente
          </span>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {data.topClient.name}
            <span className="ml-1 text-xs font-normal text-gray-500">
              ({data.topClient.mentionCount} menciones)
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-lg font-bold text-gray-900 dark:text-white", valueColor)}>
        {value}
      </p>
    </div>
  );
}
