"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";

interface HealthScoreEntry {
  clientId: string;
  clientName: string;
  orgName: string;
  score: number;
  components: {
    volume: number;
    sentiment: number;
    sov: number;
    crisisFree: number;
    responseRate: number;
    engagement: number;
  };
  trend: "up" | "down" | "stable";
}

const COMPONENT_LABELS: Record<string, { label: string; weight: string }> = {
  volume: { label: "Volumen", weight: "20%" },
  sentiment: { label: "Sentimiento", weight: "25%" },
  sov: { label: "SOV", weight: "15%" },
  crisisFree: { label: "Sin crisis", weight: "20%" },
  responseRate: { label: "Respuestas", weight: "10%" },
  engagement: { label: "Engagement", weight: "10%" },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-emerald-400";
  if (score >= 40) return "bg-amber-400";
  if (score >= 20) return "bg-orange-400";
  return "bg-red-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function HealthScoreTable({ data }: { data: HealthScoreEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Cliente
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 md:table-cell">
                Organizacion
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Trend
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Detalle
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, idx) => {
              const isExpanded = expandedId === entry.clientId;
              return (
                <HealthScoreRow
                  key={entry.clientId}
                  entry={entry}
                  rank={idx + 1}
                  isExpanded={isExpanded}
                  onToggle={() =>
                    setExpandedId(isExpanded ? null : entry.clientId)
                  }
                />
              );
            })}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  Sin datos de clientes disponibles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HealthScoreRow({
  entry,
  rank,
  isExpanded,
  onToggle,
}: {
  entry: HealthScoreEntry;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const TrendIcon =
    entry.trend === "up"
      ? TrendingUp
      : entry.trend === "down"
        ? TrendingDown
        : Minus;
  const trendColor =
    entry.trend === "up"
      ? "text-green-500"
      : entry.trend === "down"
        ? "text-red-500"
        : "text-gray-400";

  return (
    <>
      <tr className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/25 transition-colors">
        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
          {rank}
        </td>
        <td className="px-4 py-3">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {entry.clientName}
          </span>
        </td>
        <td className="hidden px-4 py-3 text-sm text-gray-500 dark:text-gray-400 md:table-cell">
          {entry.orgName}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className={cn("h-full rounded-full transition-all", getScoreColor(entry.score))}
                style={{ width: `${entry.score}%` }}
              />
            </div>
            <span className={cn("text-sm font-bold", getScoreTextColor(entry.score))}>
              {entry.score}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <TrendIcon className={cn("h-4 w-4", trendColor)} />
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={onToggle}
            className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
            />
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-gray-50 dark:border-gray-700/50">
          <td colSpan={6} className="px-4 py-3 bg-gray-50/50 dark:bg-gray-700/25">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {(Object.keys(COMPONENT_LABELS) as Array<keyof typeof entry.components>).map(
                (key) => (
                  <ComponentBadge
                    key={key}
                    label={COMPONENT_LABELS[key].label}
                    weight={COMPONENT_LABELS[key].weight}
                    value={entry.components[key]}
                  />
                )
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ComponentBadge({
  label,
  weight,
  value,
}: {
  label: string;
  weight: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{weight}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className={cn("h-full rounded-full", getScoreColor(value))}
            style={{ width: `${value}%` }}
          />
        </div>
        <span className={cn("text-xs font-bold", getScoreTextColor(value))}>
          {value}
        </span>
      </div>
    </div>
  );
}
