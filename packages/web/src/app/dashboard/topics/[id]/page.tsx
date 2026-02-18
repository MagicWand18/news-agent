"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  Tag,
  ArrowLeft,
  Newspaper,
  Clock,
  TrendingUp,
  Archive,
  ExternalLink,
  Share2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { CardGridSkeleton, TableSkeleton } from "@/components/skeletons";

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: "#10b981",
  NEGATIVE: "#ef4444",
  NEUTRAL: "#9ca3af",
  MIXED: "#f59e0b",
};

const SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: "Positivo",
  NEGATIVE: "Negativo",
  NEUTRAL: "Neutral",
  MIXED: "Mixto",
};

const SENTIMENT_BADGE_COLORS: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  NEGATIVE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  NEUTRAL: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  MIXED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CLOSED: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  ARCHIVED: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  CREATED: "Tema creado",
  MENTION_ADDED: "Mención agregada",
  THRESHOLD_REACHED: "Umbral alcanzado",
  SENTIMENT_SHIFT: "Cambio de sentimiento",
  CLOSED: "Tema cerrado",
  REOPENED: "Tema reabierto",
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  CREATED: "🆕",
  MENTION_ADDED: "📰",
  THRESHOLD_REACHED: "🔥",
  SENTIMENT_SHIFT: "🔄",
  CLOSED: "🔒",
  REOPENED: "🔓",
};

function getTimeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const thread = trpc.topics.getById.useQuery({ id });
  const mentions = trpc.topics.getMentions.useQuery({
    topicThreadId: id,
    limit: 30,
  });
  const events = trpc.topics.getEvents.useQuery({
    topicThreadId: id,
    limit: 20,
  });

  const archiveMutation = trpc.topics.archive.useMutation({
    onSuccess: () => {
      thread.refetch();
    },
  });

  if (thread.isLoading) {
    return (
      <div className="space-y-8">
        <CardGridSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  if (!thread.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Tema no encontrado</p>
        <Link
          href="/dashboard/topics"
          className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Volver a temas
        </Link>
      </div>
    );
  }

  const t = thread.data;
  const totalCount = t.mentionCount + t.socialMentionCount;
  const sentiment = t.dominantSentiment || "NEUTRAL";
  const breakdown = (t.sentimentBreakdown || {
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
  }) as Record<string, number>;
  const sources = (t.topSources || []) as string[];

  // Preparar datos del pie chart
  const pieData = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: SENTIMENT_LABELS[key.toUpperCase()] || key,
      value,
      fill: SENTIMENT_COLORS[key.toUpperCase()] || "#9ca3af",
    }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Tag className="h-5 w-5 text-gray-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t.name}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  STATUS_BADGE_COLORS[t.status] || STATUS_BADGE_COLORS.ACTIVE
                )}
              >
                {t.status}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  SENTIMENT_BADGE_COLORS[sentiment]
                )}
              >
                {SENTIMENT_LABELS[sentiment]}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t.client.name} · Activo desde {formatDate(t.firstSeenAt)}
            </p>
          </div>

          {t.status === "ACTIVE" && (
            <button
              onClick={() => archiveMutation.mutate({ id })}
              disabled={archiveMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Archive className="h-4 w-4" />
              Archivar
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Menciones" value={t.mentionCount} icon="📰" />
        <StatBox label="Social" value={t.socialMentionCount} icon="📱" />
        <StatBox label="Fuentes" value={sources.length} icon="📡" />
        <StatBox
          label="Activo"
          value={getTimeAgo(t.firstSeenAt)}
          icon="⏱️"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sentiment Pie */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
            Sentimiento
          </h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="text-gray-600 dark:text-gray-400">{entry.name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Sin datos</p>
          )}
        </div>

        {/* Top Sources */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
            Fuentes
          </h3>
          {sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map((source, i) => (
                <div
                  key={source}
                  className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"
                >
                  <span className="text-sm font-medium text-gray-400">#{i + 1}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{source}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Sin fuentes registradas</p>
          )}
        </div>
      </div>

      {/* Mentions Timeline */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
          Menciones ({totalCount})
        </h3>
        {mentions.isLoading ? (
          <TableSkeleton />
        ) : (mentions.data?.items.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Sin menciones</p>
        ) : (
          <div className="space-y-2">
            {mentions.data?.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"
              >
                <div className="mt-0.5 flex-shrink-0">
                  {item.type === "mention" ? (
                    <Newspaper className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Share2 className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                      {item.title}
                    </p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{item.source}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        SENTIMENT_BADGE_COLORS[item.sentiment] || SENTIMENT_BADGE_COLORS.NEUTRAL
                      )}
                    >
                      {SENTIMENT_LABELS[item.sentiment] || item.sentiment}
                    </span>
                    <span>{getTimeAgo(item.date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Events Timeline */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
          Timeline de eventos
        </h3>
        {events.isLoading ? (
          <TableSkeleton />
        ) : (events.data?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Sin eventos</p>
        ) : (
          <div className="relative space-y-0">
            {events.data?.map((event, idx) => (
              <div key={event.id} className="flex gap-3 pb-4">
                <div className="flex flex-col items-center">
                  <span className="text-base">{EVENT_TYPE_ICONS[event.type] || "📌"}</span>
                  {idx < (events.data?.length ?? 0) - 1 && (
                    <div className="mt-1 w-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {EVENT_TYPE_LABELS[event.type] || event.type}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
