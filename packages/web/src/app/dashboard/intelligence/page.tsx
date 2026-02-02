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
  Legend,
} from "recharts";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  AlertTriangle,
  Target,
  Tag,
  Users,
  Calendar,
  Sparkles,
  Zap,
} from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/filters";

const SOV_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
];

export default function IntelligencePage() {
  const [clientId, setClientId] = useState<string>("");
  const [days, setDays] = useState("30");

  const clients = trpc.clients.list.useQuery();
  const kpis = trpc.intelligence.getKPIs.useQuery();
  const sov = trpc.intelligence.getSOV.useQuery(
    { clientId: clientId || clients.data?.[0]?.id || "", days: Number(days), includeCompetitors: true },
    { enabled: !!clientId || !!clients.data?.[0]?.id }
  );
  const topics = trpc.intelligence.getTopics.useQuery(
    { clientId: clientId || undefined, days: Number(days) }
  );
  const insights = trpc.intelligence.getWeeklyInsights.useQuery(
    { clientId: clientId || undefined, limit: 4 }
  );
  const sourceTiers = trpc.intelligence.getSourceTiers.useQuery();

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  const activeFilterCount = [clientId, days !== "30" ? days : null].filter(Boolean).length;

  const handleClearFilters = () => {
    setClientId("");
    setDays("30");
  };

  // Preparar datos para graficas
  const sovChartData = useMemo(() => {
    if (!sov.data) return [];
    return sov.data.history.map((h) => ({
      week: new Date(h.week).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      sov: Number(h.sov.toFixed(1)),
      mentions: h.mentions,
    }));
  }, [sov.data]);

  const sovPieData = useMemo(() => {
    if (!sov.data) return [];
    const data = [
      { name: sov.data.clientSOV.name, value: sov.data.clientSOV.sov },
      ...sov.data.competitorSOV.map((c) => ({ name: c.name, value: c.sov })),
    ];
    // Agregar "Otros" si hay espacio
    const totalSov = data.reduce((sum, d) => sum + d.value, 0);
    if (totalSov < 100) {
      data.push({ name: "Otros", value: 100 - totalSov });
    }
    return data;
  }, [sov.data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            <Brain className="mr-2 inline-block h-7 w-7 text-brand-600" />
            Media Intelligence
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
            Insights accionables y analisis competitivo avanzado
          </p>
        </div>
      </div>

      {/* Filtros */}
      <FilterBar activeCount={activeFilterCount} onClear={handleClearFilters}>
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
      </FilterBar>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour-id="intelligence-kpis">
        <KPICard
          title="SOV Promedio"
          value={`${kpis.data?.avgSOV?.toFixed(1) || "0"}%`}
          icon={<Target className="h-5 w-5" />}
          color="blue"
          subtitle="Share of Voice semanal"
        />
        <KPICard
          title="Temas Activos"
          value={kpis.data?.topicsCount?.toString() || "0"}
          icon={<Tag className="h-5 w-5" />}
          color="purple"
          subtitle="Esta semana"
        />
        <KPICard
          title="Temas Emergentes"
          value={kpis.data?.emergingTopics?.toString() || "0"}
          icon={<Zap className="h-5 w-5" />}
          color="amber"
          subtitle=">3 menciones en 24h"
        />
        <KPICard
          title="Menciones Ponderadas"
          value={kpis.data?.weightedMentions?.toString() || "0"}
          icon={<Sparkles className="h-5 w-5" />}
          color="emerald"
          subtitle="Por tier de fuente"
        />
      </div>

      {/* Row 2: SOV Chart + SOV Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-tour-id="intelligence-sov">
        {/* SOV Trend */}
        <div className="col-span-1 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Tendencia Share of Voice</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Ultimas 8 semanas</p>
          {sov.isLoading ? (
            <LoadingSpinner />
          ) : sovChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={sovChartData}>
                <defs>
                  <linearGradient id="sovGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "SOV"]}
                />
                <Area
                  type="monotone"
                  dataKey="sov"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#sovGradient)"
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Selecciona un cliente para ver el SOV" />
          )}
        </div>

        {/* SOV Pie */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="font-semibold text-gray-900 dark:text-white">Share of Voice</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">vs Competidores</p>
          {sov.isLoading ? (
            <LoadingSpinner />
          ) : sovPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={sovPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {sovPieData.map((_, index) => (
                      <Cell key={index} fill={SOV_COLORS[index % SOV_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {sovPieData.slice(0, 5).map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: SOV_COLORS[index % SOV_COLORS.length] }}
                      />
                      <span className="truncate text-gray-600 dark:text-gray-300">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{entry.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="Sin datos de competidores" />
          )}
        </div>
      </div>

      {/* Row 3: Topics + Insights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-tour-id="intelligence-topics">
        {/* Topics */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Temas Principales</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Top temas detectados</p>
            </div>
            {(topics.data?.emergingTopics?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <Zap className="h-3 w-3" />
                {topics.data?.emergingTopics?.length} emergentes
              </span>
            )}
          </div>
          {topics.isLoading ? (
            <LoadingSpinner />
          ) : (topics.data?.topics?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {topics.data?.topics?.slice(0, 10).map((topic, index) => (
                <TopicRow
                  key={topic.name}
                  name={topic.name}
                  count={topic.count}
                  sentiment={topic.sentiment}
                  rank={index + 1}
                  isEmerging={topics.data?.emergingTopics?.some((e) => e.name === topic.name)}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="Sin temas detectados" />
          )}
        </div>

        {/* AI Insights */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Recomendaciones IA</h3>
          </div>
          {insights.isLoading ? (
            <LoadingSpinner />
          ) : (insights.data?.insights?.length ?? 0) > 0 ? (
            <div className="space-y-4">
              {insights.data?.insights?.slice(0, 2).map((insight) => (
                <InsightCard
                  key={insight.id}
                  clientName={insight.clientName}
                  weekStart={new Date(insight.weekStart)}
                  insights={insight.insights as string[]}
                  sovData={insight.sovData}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Lightbulb className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Los insights se generan semanalmente</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Disponibles cada lunes con análisis de la semana anterior
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Source Tiers */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="intelligence-tiers">
        <h3 className="font-semibold text-gray-900 dark:text-white">Fuentes por Tier</h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Clasificacion de fuentes por alcance e impacto
        </p>
        {sourceTiers.isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TierCard
              tier={1}
              label="Nacionales"
              count={sourceTiers.data?.summary?.tier1 || 0}
              color="emerald"
              description="Medios de alto alcance (3x peso)"
            />
            <TierCard
              tier={2}
              label="Regionales/Especializados"
              count={sourceTiers.data?.summary?.tier2 || 0}
              color="blue"
              description="Medios regionales y nichos (2x peso)"
            />
            <TierCard
              tier={3}
              label="Digitales/Blogs"
              count={sourceTiers.data?.summary?.tier3 || 0}
              color="gray"
              description="Portales y blogs (1x peso)"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Componentes auxiliares

function KPICard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "purple" | "amber" | "emerald";
  subtitle: string;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-900/20">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
    </div>
  );
}

function TopicRow({
  name,
  count,
  sentiment,
  rank,
  isEmerging,
}: {
  name: string;
  count: number;
  sentiment: { positive: number; negative: number; neutral: number };
  rank: number;
  isEmerging?: boolean;
}) {
  const total = sentiment.positive + sentiment.negative + sentiment.neutral;
  const positivePercent = total > 0 ? (sentiment.positive / total) * 100 : 0;
  const negativePercent = total > 0 ? (sentiment.negative / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-900 dark:text-white">{name}</span>
          {isEmerging && (
            <span className="flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              <Zap className="h-3 w-3" /> Nuevo
            </span>
          )}
        </div>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className="bg-emerald-400"
            style={{ width: `${positivePercent}%` }}
          />
          <div
            className="bg-red-400"
            style={{ width: `${negativePercent}%` }}
          />
        </div>
      </div>
      <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{count}</span>
    </div>
  );
}

function InsightCard({
  clientName,
  weekStart,
  insights,
  sovData,
}: {
  clientName: string;
  weekStart: Date;
  insights: string[];
  sovData: { sov: number; trend: string };
}) {
  const TrendIcon =
    sovData.trend === "up" ? TrendingUp : sovData.trend === "down" ? TrendingDown : Minus;
  const trendColor =
    sovData.trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : sovData.trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-500 dark:text-gray-400";

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-gray-900 dark:text-white">{clientName}</span>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-sm ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            {sovData.sov?.toFixed(1) || 0}% SOV
          </span>
        </div>
      </div>
      <ul className="space-y-2">
        {insights.slice(0, 3).map((insight, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <span>{insight}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Semana del {weekStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
      </p>
    </div>
  );
}

function TierCard({
  tier,
  label,
  count,
  color,
  description,
}: {
  tier: number;
  label: string;
  count: number;
  color: "emerald" | "blue" | "gray";
  description: string;
}) {
  const colors = {
    emerald: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20",
    blue: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20",
    gray: "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50",
  };

  const textColors = {
    emerald: "text-emerald-700 dark:text-emerald-400",
    blue: "text-blue-700 dark:text-blue-400",
    gray: "text-gray-700 dark:text-gray-300",
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <span className={`text-lg font-bold ${textColors[color]}`}>Tier {tier}</span>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{count}</span>
      </div>
      <p className="mt-1 font-medium text-gray-700 dark:text-gray-200">{label}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
        <Brain className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
