"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
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
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";

const SENTIMENT_COLORS = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#9ca3af",
  mixed: "#f59e0b",
};

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

const URGENCY_LABELS: Record<string, string> = {
  CRITICAL: "Critico",
  HIGH: "Alto",
  MEDIUM: "Medio",
  LOW: "Bajo",
};

const PERIOD_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
];

export default function AnalyticsPage() {
  const [clientId, setClientId] = useState<string>("");
  const [days, setDays] = useState(30);

  const clients = trpc.clients.list.useQuery();
  const analytics = trpc.dashboard.analytics.useQuery(
    { clientId: clientId || undefined, days },
    { refetchOnWindowFocus: false }
  );

  const isLoading = analytics.isLoading;
  const data = analytics.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analiticas</h2>
          <p className="mt-1 text-sm text-gray-500">
            Estadisticas avanzadas de menciones y tendencias
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Todos los clientes</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 1: Mentions by Day */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900">Menciones por dia</h3>
        <p className="mb-4 text-sm text-gray-500">Ultimos {days} dias</p>
        {isLoading ? (
          <LoadingSpinner />
        ) : (data?.mentionsByDay?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data?.mentionsByDay ?? []}>
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
                    year: "numeric",
                  })
                }
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Menciones"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#mentionGradient)"
                dot={{ fill: "#3b82f6", r: 3 }}
                activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="Sin datos de menciones" />
        )}
      </div>

      {/* Row 2: Sentiment Trend + Urgency */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sentiment Trend */}
        <div className="col-span-1 rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="font-semibold text-gray-900">Tendencia de sentimiento</h3>
          <p className="mb-4 text-sm text-gray-500">Por semana</p>
          {isLoading ? (
            <LoadingSpinner />
          ) : (data?.sentimentTrend?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data?.sentimentTrend ?? []}>
                <XAxis
                  dataKey="week"
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
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="positive"
                  name="Positivo"
                  stroke={SENTIMENT_COLORS.positive}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="negative"
                  name="Negativo"
                  stroke={SENTIMENT_COLORS.negative}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="neutral"
                  name="Neutral"
                  stroke={SENTIMENT_COLORS.neutral}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="mixed"
                  name="Mixto"
                  stroke={SENTIMENT_COLORS.mixed}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Sin datos de sentimiento" />
          )}
        </div>

        {/* Urgency Breakdown */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Urgencia</h3>
          <p className="mb-4 text-sm text-gray-500">Distribucion</p>
          {isLoading ? (
            <LoadingSpinner />
          ) : (data?.urgencyBreakdown?.length ?? 0) > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data?.urgencyBreakdown ?? []}
                    dataKey="count"
                    nameKey="urgency"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {(data?.urgencyBreakdown ?? []).map((entry) => (
                      <Cell
                        key={entry.urgency}
                        fill={URGENCY_COLORS[entry.urgency] || "#9ca3af"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2">
                {(data?.urgencyBreakdown ?? []).map((entry) => (
                  <div
                    key={entry.urgency}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            URGENCY_COLORS[entry.urgency] || "#9ca3af",
                        }}
                      />
                      <span className="text-gray-600">
                        {URGENCY_LABELS[entry.urgency] || entry.urgency}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="Sin datos de urgencia" />
          )}
        </div>
      </div>

      {/* Row 3: Top Sources + Top Keywords */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Sources */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Top fuentes</h3>
          <p className="mb-4 text-sm text-gray-500">Por numero de menciones</p>
          {isLoading ? (
            <LoadingSpinner />
          ) : (data?.topSources?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data?.topSources ?? []}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="source"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Menciones"
                  fill="#6366f1"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Sin datos de fuentes" />
          )}
        </div>

        {/* Top Keywords */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Top keywords</h3>
          <p className="mb-4 text-sm text-gray-500">Mas mencionados</p>
          {isLoading ? (
            <LoadingSpinner />
          ) : (data?.topKeywords?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.topKeywords ?? []}>
                <XAxis
                  dataKey="keyword"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Menciones"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Sin datos de keywords" />
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex h-[250px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <BarChart3 className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">{message}</p>
      <p className="mt-1 text-xs text-gray-400">
        Los datos apareceran cuando haya menciones en el periodo seleccionado
      </p>
    </div>
  );
}
