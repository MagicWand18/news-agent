"use client";

import { trpc } from "@/lib/trpc";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { MentionRow, MentionRowSkeleton } from "@/components/mention-row";
import { LayoutDashboard, Newspaper, Users, CheckSquare } from "lucide-react";
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

export default function DashboardPage() {
  const stats = trpc.dashboard.stats.useQuery();
  const recent = trpc.dashboard.recentMentions.useQuery();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">
          Resumen general de tu monitoreo de medios
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Clientes activos"
              value={stats.data?.clientCount ?? 0}
              icon={<Users className="h-6 w-6" />}
            />
            <StatCard
              title="Menciones (24h)"
              value={stats.data?.mentions24h ?? 0}
              icon={<Newspaper className="h-6 w-6" />}
            />
            <StatCard
              title="Menciones (7d)"
              value={stats.data?.mentions7d ?? 0}
              icon={<LayoutDashboard className="h-6 w-6" />}
            />
            <StatCard
              title="Tareas pendientes"
              value={stats.data?.tasksPending ?? 0}
              icon={<CheckSquare className="h-6 w-6" />}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-1 rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="font-semibold text-gray-900">Menciones por dia</h3>
          <p className="mb-4 text-sm text-gray-500">Ultimos 7 dias</p>
          {stats.isLoading ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.data?.mentionsByDay ?? []}>
                <defs>
                  <linearGradient id="mentionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                  labelFormatter={(v) =>
                    new Date(v).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "long",
                    })
                  }
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#mentionGradient)"
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Sentimiento</h3>
          <p className="mb-4 text-sm text-gray-500">Ultimos 7 dias</p>
          {stats.isLoading ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
            </div>
          ) : (stats.data?.sentimentBreakdown?.length ?? 0) > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.data?.sentimentBreakdown ?? []}
                    dataKey="count"
                    nameKey="sentiment"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {(stats.data?.sentimentBreakdown ?? []).map((entry) => (
                      <Cell
                        key={entry.sentiment}
                        fill={SENTIMENT_COLORS[entry.sentiment] || "#9ca3af"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {(stats.data?.sentimentBreakdown ?? []).map((entry) => (
                  <div key={entry.sentiment} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: SENTIMENT_COLORS[entry.sentiment] || "#9ca3af" }}
                      />
                      <span className="text-gray-600">
                        {SENTIMENT_LABELS[entry.sentiment] || entry.sentiment}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900">{entry.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="Sin datos de sentimiento" />
          )}
        </div>
      </div>

      {/* Recent Mentions */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Menciones recientes</h3>
            <p className="text-sm text-gray-500">Ultimas menciones detectadas</p>
          </div>
        </div>
        {recent.isLoading ? (
          <div className="space-y-0">
            <MentionRowSkeleton />
            <MentionRowSkeleton />
            <MentionRowSkeleton />
          </div>
        ) : (recent.data?.length ?? 0) > 0 ? (
          recent.data?.map((mention) => (
            <MentionRow
              key={mention.id}
              id={mention.id}
              title={mention.article.title}
              source={mention.article.source}
              clientName={mention.client.name}
              sentiment={mention.sentiment}
              relevance={mention.relevance}
              urgency={mention.urgency}
              date={mention.createdAt}
              url={mention.article.url}
              summary={mention.aiSummary}
            />
          ))
        ) : (
          <EmptyState message="No hay menciones recientes" />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Newspaper className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">{message}</p>
      <p className="mt-1 text-xs text-gray-400">
        Los datos apareceran cuando se detecten nuevas menciones
      </p>
    </div>
  );
}
