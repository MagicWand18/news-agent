"use client";

import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
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
import { BarChart3, Users, Calendar, Tag, Zap, Share2 } from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/filters";
import { TIME_PERIOD_OPTIONS } from "@/lib/filter-constants";

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

const PLATFORM_COLORS: Record<string, string> = {
  TWITTER: "#000000",
  INSTAGRAM: "#E4405F",
  TIKTOK: "#25F4EE",
};

const PLATFORM_LABELS: Record<string, string> = {
  TWITTER: "Twitter/X",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

const PERIOD_OPTIONS = TIME_PERIOD_OPTIONS;

const SENTIMENT_OPTIONS = [
  { value: "positive", label: "Positivo" },
  { value: "negative", label: "Negativo" },
  { value: "neutral", label: "Neutral" },
  { value: "mixed", label: "Mixto" },
];

const URGENCY_OPTIONS = [
  { value: "CRITICAL", label: "Critico" },
  { value: "HIGH", label: "Alto" },
  { value: "MEDIUM", label: "Medio" },
  { value: "LOW", label: "Bajo" },
];

export default function AnalyticsPage() {
  const [clientId, setClientId] = useState<string>("");
  const [days, setDays] = useState("30");
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>([
    "positive",
    "negative",
    "neutral",
    "mixed",
  ]);
  const [selectedUrgencies, setSelectedUrgencies] = useState<string[]>([
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
  ]);

  const clients = trpc.clients.list.useQuery();
  const analytics = trpc.dashboard.analytics.useQuery(
    { clientId: clientId || undefined, days: Number(days) },
    { refetchOnWindowFocus: false }
  );
  const topics = trpc.intelligence.getTopics.useQuery(
    { clientId: clientId || undefined, days: Number(days) },
    { refetchOnWindowFocus: false }
  );
  const socialAnalytics = trpc.dashboard.getSocialAnalytics.useQuery(
    { clientId: clientId || undefined, days: Number(days) },
    { refetchOnWindowFocus: false }
  );

  const isLoading = analytics.isLoading;
  const data = analytics.data;

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  // Filter urgency breakdown based on selected urgencies
  const filteredUrgencyBreakdown = useMemo(() => {
    if (!data?.urgencyBreakdown) return [];
    return data.urgencyBreakdown.filter((u) => selectedUrgencies.includes(u.urgency));
  }, [data?.urgencyBreakdown, selectedUrgencies]);

  // Count active filters
  const activeFilterCount = [
    clientId,
    days !== "30" ? days : null,
    selectedSentiments.length < 4 ? "sentiment" : null,
    selectedUrgencies.length < 4 ? "urgency" : null,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setClientId("");
    setDays("30");
    setSelectedSentiments(["positive", "negative", "neutral", "mixed"]);
    setSelectedUrgencies(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analiticas</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
            Estadisticas avanzadas de menciones y tendencias
          </p>
        </div>
      </div>

      {/* Filtros */}
      <FilterBar activeCount={activeFilterCount} onClear={handleClearFilters} data-tour-id="analytics-filters">
        <FilterSelect
          label="Cliente"
          value={clientId}
          options={clientOptions}
          onChange={setClientId}
          placeholder="Todos los clientes"
          icon={<Users className="h-4 w-4" />}
        />
        <FilterSelect
          label="Periodo"
          value={days}
          options={PERIOD_OPTIONS}
          onChange={setDays}
          icon={<Calendar className="h-4 w-4" />}
        />
        <FilterSelect
          label="Sentimientos"
          value={selectedSentiments}
          options={SENTIMENT_OPTIONS}
          onChange={() => {}}
          onMultiChange={setSelectedSentiments}
          multiple
        />
        <FilterSelect
          label="Urgencias"
          value={selectedUrgencies}
          options={URGENCY_OPTIONS}
          onChange={() => {}}
          onMultiChange={setSelectedUrgencies}
          multiple
        />
      </FilterBar>

      {/* Row 1: Mentions by Day */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="analytics-mentions-day">
        <h3 className="font-semibold text-gray-900 dark:text-white">Menciones por dia</h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Ultimos {days} dias</p>
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-tour-id="analytics-sentiment">
        {/* Sentiment Trend */}
        <div className="col-span-1 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Tendencia de sentimiento</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Por semana</p>
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
                {selectedSentiments.includes("positive") && (
                  <Line
                    type="monotone"
                    dataKey="positive"
                    name="Positivo"
                    stroke={SENTIMENT_COLORS.positive}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
                {selectedSentiments.includes("negative") && (
                  <Line
                    type="monotone"
                    dataKey="negative"
                    name="Negativo"
                    stroke={SENTIMENT_COLORS.negative}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
                {selectedSentiments.includes("neutral") && (
                  <Line
                    type="monotone"
                    dataKey="neutral"
                    name="Neutral"
                    stroke={SENTIMENT_COLORS.neutral}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
                {selectedSentiments.includes("mixed") && (
                  <Line
                    type="monotone"
                    dataKey="mixed"
                    name="Mixto"
                    stroke={SENTIMENT_COLORS.mixed}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Sin datos de sentimiento" />
          )}
        </div>

        {/* Urgency Breakdown */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="font-semibold text-gray-900 dark:text-white">Urgencia</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Distribucion</p>
          {isLoading ? (
            <LoadingSpinner />
          ) : filteredUrgencyBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={filteredUrgencyBreakdown}
                    dataKey="count"
                    nameKey="urgency"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {filteredUrgencyBreakdown.map((entry) => (
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
                {filteredUrgencyBreakdown.map((entry) => (
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
                      <span className="text-gray-600 dark:text-gray-300">
                        {URGENCY_LABELS[entry.urgency] || entry.urgency}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-tour-id="analytics-sources">
        {/* Top Sources */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="font-semibold text-gray-900 dark:text-white">Top fuentes</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Por numero de menciones</p>
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
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="font-semibold text-gray-900 dark:text-white">Top keywords</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Mas mencionados</p>
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

      {/* Row 4: Topics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-tour-id="analytics-topics">
        {/* Topic Cloud */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Temas Detectados</h3>
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Temas extraidos automaticamente de las menciones
          </p>
          {topics.isLoading ? (
            <LoadingSpinner />
          ) : (topics.data?.topics?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topics.data?.topics?.map((topic) => {
                // Calcular tamano basado en conteo
                const maxCount = Math.max(...(topics.data?.topics?.map((t) => t.count) || [1]));
                const minSize = 12;
                const maxSize = 24;
                const size = minSize + ((topic.count / maxCount) * (maxSize - minSize));

                // Color basado en sentimiento predominante
                const total = topic.sentiment.positive + topic.sentiment.negative + topic.sentiment.neutral;
                const positiveRatio = total > 0 ? topic.sentiment.positive / total : 0;
                const negativeRatio = total > 0 ? topic.sentiment.negative / total : 0;

                let bgColor = "bg-gray-100 text-gray-700";
                if (positiveRatio > 0.5) bgColor = "bg-emerald-100 text-emerald-700";
                else if (negativeRatio > 0.5) bgColor = "bg-red-100 text-red-700";

                return (
                  <span
                    key={topic.name}
                    className={`inline-flex items-center rounded-full px-3 py-1 font-medium ${bgColor}`}
                    style={{ fontSize: `${size}px` }}
                    title={`${topic.count} menciones | +${topic.sentiment.positive} -${topic.sentiment.negative}`}
                  >
                    {topic.name}
                    <span className="ml-1.5 text-xs opacity-60">({topic.count})</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Tag className="h-6 w-6 text-purple-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin temas detectados</p>
              <p className="mt-1 text-xs text-gray-400">
                Los temas se extraen automaticamente de las menciones
              </p>
            </div>
          )}
        </div>

        {/* Emerging Topics */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Temas Emergentes</h3>
          </div>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Temas con 3+ menciones en las ultimas 24 horas
          </p>
          {topics.isLoading ? (
            <LoadingSpinner />
          ) : (topics.data?.emergingTopics?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {topics.data?.emergingTopics?.map((topic, index) => (
                <div
                  key={topic.name}
                  className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-700">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{topic.name}</p>
                    <p className="text-sm text-amber-600">
                      {topic.count} menciones en 24h
                    </p>
                  </div>
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <Zap className="h-6 w-6 text-amber-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin temas emergentes</p>
              <p className="mt-1 text-xs text-gray-400">
                Apareceran temas con alto volumen reciente
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Row 5: Social Media Analytics */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="analytics-social">
        <div className="mb-4 flex items-center gap-2">
          <Share2 className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Redes Sociales</h3>
        </div>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Menciones en Twitter/X, Instagram y TikTok
        </p>

        {socialAnalytics.isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Social Mentions by Day */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Menciones por día
              </p>
              {(socialAnalytics.data?.mentionsByDay?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={socialAnalytics.data?.mentionsByDay ?? []}>
                    <defs>
                      <linearGradient id="socialGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Menciones"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#socialGradient)"
                      dot={{ fill: "#8b5cf6", r: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyStateMini message="Sin datos" />
              )}
            </div>

            {/* Platform Distribution */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Por plataforma
              </p>
              {Object.keys(socialAnalytics.data?.byPlatform ?? {}).length > 0 &&
              Object.values(socialAnalytics.data?.byPlatform ?? {}).some((v) => v > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={Object.entries(socialAnalytics.data?.byPlatform ?? {})
                          .filter(([, count]) => count > 0)
                          .map(([platform, count]) => ({
                            name: PLATFORM_LABELS[platform] || platform,
                            value: count,
                            fill: PLATFORM_COLORS[platform] || "#6b7280",
                          }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={2}
                      >
                        {Object.entries(socialAnalytics.data?.byPlatform ?? {})
                          .filter(([, count]) => count > 0)
                          .map(([platform]) => (
                            <Cell
                              key={platform}
                              fill={PLATFORM_COLORS[platform] || "#6b7280"}
                            />
                          ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-center gap-4">
                    {Object.entries(socialAnalytics.data?.byPlatform ?? {})
                      .filter(([, count]) => count > 0)
                      .map(([platform, count]) => (
                        <div key={platform} className="flex items-center gap-1.5 text-xs">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: PLATFORM_COLORS[platform] || "#6b7280" }}
                          />
                          <span className="text-gray-600 dark:text-gray-300">
                            {PLATFORM_LABELS[platform] || platform}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <EmptyStateMini message="Sin datos" />
              )}
            </div>

            {/* Top Authors */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Top autores
              </p>
              {(socialAnalytics.data?.topAuthors?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  {socialAnalytics.data?.topAuthors?.slice(0, 5).map((author, index) => (
                    <div
                      key={`${author.platform}-${author.handle}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {index + 1}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: PLATFORM_COLORS[author.platform] || "#6b7280",
                        }}
                      />
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                        @{author.handle}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {author.count} post{author.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyStateMini message="Sin datos" />
              )}
            </div>
          </div>
        )}
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
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      <p className="mt-1 text-xs text-gray-400">
        Los datos apareceran cuando haya menciones en el periodo seleccionado
      </p>
    </div>
  );
}

function EmptyStateMini({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
      {message}
    </div>
  );
}
