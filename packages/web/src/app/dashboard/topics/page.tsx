"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  Tag,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Users,
  Calendar,
  Clock,
  Newspaper,
  ChevronRight,
} from "lucide-react";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { FilterBar, FilterSelect } from "@/components/filters";
import { CardGridSkeleton } from "@/components/skeletons";

const STATUS_TABS = [
  { value: "ACTIVE", label: "Activos" },
  { value: "CLOSED", label: "Cerrados" },
  { value: "ARCHIVED", label: "Archivados" },
] as const;

const SENTIMENT_OPTIONS = [
  { value: "POSITIVE", label: "Positivo" },
  { value: "NEGATIVE", label: "Negativo" },
  { value: "NEUTRAL", label: "Neutral" },
  { value: "MIXED", label: "Mixto" },
];

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  NEGATIVE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  NEUTRAL: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  MIXED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const SENTIMENT_BAR_COLORS: Record<string, string> = {
  positive: "bg-green-500",
  negative: "bg-red-500",
  neutral: "bg-gray-400",
  mixed: "bg-amber-500",
};

const SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: "Positivo",
  NEGATIVE: "Negativo",
  NEUTRAL: "Neutral",
  MIXED: "Mixto",
};

function getTimeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

export default function TopicsPage() {
  const [status, setStatus] = useState<"ACTIVE" | "CLOSED" | "ARCHIVED">("ACTIVE");
  const [clientId, setClientId] = useState("");
  const [sentiment, setSentiment] = useState("");

  const clients = trpc.clients.list.useQuery();
  const clientOptions = useMemo(
    () => (clients.data || []).map((c) => ({ value: c.id, label: c.name })),
    [clients.data]
  );

  const stats = trpc.topics.getStats.useQuery({
    clientId: clientId || undefined,
    days: 7,
  });

  const threads = trpc.topics.list.useQuery({
    status,
    clientId: clientId || undefined,
    sentiment: (sentiment as "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED") || undefined,
    limit: 50,
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Temas</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Hilos temáticos que agrupan menciones del mismo tema
        </p>
        <FilterBar
          activeCount={
            [clientId, sentiment].filter(Boolean).length
          }
          onClear={() => {
            setClientId("");
            setSentiment("");
          }}
        >
          <FilterSelect
            label="Cliente"
            value={clientId}
            options={clientOptions}
            onChange={setClientId}
            placeholder="Todos"
            icon={<Users className="h-4 w-4" />}
          />
          <FilterSelect
            label="Sentimiento"
            value={sentiment}
            options={SENTIMENT_OPTIONS}
            onChange={setSentiment}
            placeholder="Todos"
          />
        </FilterBar>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Temas activos"
              value={stats.data?.activeTopics ?? 0}
              icon={<Tag className="h-6 w-6" />}
              animate
            />
            <StatCard
              title="Temas negativos"
              value={stats.data?.negativeTopics ?? 0}
              icon={<AlertTriangle className="h-6 w-6" />}
              animate
              className={
                (stats.data?.negativeTopics ?? 0) > 0
                  ? "border-red-200 dark:border-red-800"
                  : undefined
              }
            />
            <StatCard
              title="Nuevos (7d)"
              value={stats.data?.newTopics ?? 0}
              icon={<Sparkles className="h-6 w-6" />}
              animate
            />
          </>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
              status === tab.value
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Thread Cards */}
      {threads.isLoading ? (
        <CardGridSkeleton />
      ) : (threads.data?.threads.length ?? 0) === 0 ? (
        <EmptyState status={status} />
      ) : (
        <div className="space-y-3">
          {threads.data?.threads.map((thread) => (
            <TopicThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicThreadCard({
  thread,
}: {
  thread: {
    id: string;
    name: string;
    status: string;
    mentionCount: number;
    socialMentionCount: number;
    dominantSentiment: string | null;
    sentimentBreakdown: unknown;
    topSources: unknown;
    firstSeenAt: Date;
    lastMentionAt: Date;
    client: { name: string; id: string };
  };
}) {
  const totalCount = thread.mentionCount + thread.socialMentionCount;
  const sentiment = thread.dominantSentiment || "NEUTRAL";
  const breakdown = (thread.sentimentBreakdown || {
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
  }) as Record<string, number>;
  const sources = (thread.topSources || []) as string[];
  const breakdownTotal =
    (breakdown.positive || 0) +
    (breakdown.negative || 0) +
    (breakdown.neutral || 0) +
    (breakdown.mixed || 0);

  return (
    <Link
      href={`/dashboard/topics/${thread.id}`}
      className="group block rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-gray-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Tag className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {thread.name}
            </h3>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                SENTIMENT_COLORS[sentiment]
              )}
            >
              {SENTIMENT_LABELS[sentiment] || sentiment}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {thread.client.name}
            </span>
            <span className="flex items-center gap-1">
              <Newspaper className="h-3.5 w-3.5" />
              {totalCount} menciones
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {getTimeAgo(thread.lastMentionAt)}
            </span>
          </div>

          {/* Sentiment bar */}
          {breakdownTotal > 0 && (
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              {Object.entries(SENTIMENT_BAR_COLORS).map(([key, color]) => {
                const value = breakdown[key] || 0;
                const pct = (value / breakdownTotal) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={key}
                    className={cn("h-full", color)}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>
          )}

          {/* Top sources chips */}
          {sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {sources.slice(0, 4).map((source) => (
                <span
                  key={source}
                  className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                >
                  {source}
                </span>
              ))}
              {sources.length > 4 && (
                <span className="text-xs text-gray-400">+{sources.length - 4}</span>
              )}
            </div>
          )}
        </div>

        <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600" />
      </div>
    </Link>
  );
}

function EmptyState({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
        <Tag className="h-6 w-6 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        No hay temas {status === "ACTIVE" ? "activos" : status === "CLOSED" ? "cerrados" : "archivados"}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Los temas se crean automáticamente cuando se detectan menciones con el mismo tema
      </p>
    </div>
  );
}
