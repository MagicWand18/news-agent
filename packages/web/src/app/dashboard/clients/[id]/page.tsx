"use client";

import { trpc } from "@/lib/trpc";
import { MentionRow } from "@/components/mention-row";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, X, BarChart3, Target, TrendingUp, TrendingDown, Minus, Trash2, Settings, Search, Calendar, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts";

const KEYWORD_TYPES = ["NAME", "BRAND", "COMPETITOR", "TOPIC", "ALIAS"] as const;
const typeLabels: Record<string, string> = {
  NAME: "Nombre",
  BRAND: "Marca",
  COMPETITOR: "Competidor",
  TOPIC: "Tema",
  ALIAS: "Alias",
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const client = trpc.clients.getById.useQuery({ id });
  const addKeyword = trpc.clients.addKeyword.useMutation({
    onSuccess: () => {
      client.refetch();
      setNewKeyword({ word: "", type: "NAME" });
    },
  });
  const removeKeyword = trpc.clients.removeKeyword.useMutation({
    onSuccess: () => client.refetch(),
  });
  const deleteClient = trpc.clients.delete.useMutation({
    onSuccess: () => {
      router.push("/dashboard/clients");
    },
  });

  const [newKeyword, setNewKeyword] = useState<{
    word: string;
    type: (typeof KEYWORD_TYPES)[number];
  }>({ word: "", type: "NAME" });

  if (client.isLoading) return <div className="text-gray-500 dark:text-gray-400">Cargando...</div>;
  if (!client.data) return <div className="text-gray-500 dark:text-gray-400">Cliente no encontrado</div>;

  const c = client.data;

  const handleDelete = () => {
    deleteClient.mutate({ id });
  };

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a clientes
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{c.name}</h2>
          <p className="text-gray-500 dark:text-gray-400">
            {c.industry || "Sin industria"} · {c.description || "Sin descripcion"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              c.active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {c.active ? "Activo" : "Inactivo"}
          </span>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              ¿Eliminar cliente?
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Esta acción eliminará permanentemente a <strong>{c.name}</strong> junto con todas sus menciones, keywords y tareas asociadas. Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteClient.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteClient.isPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <p className="text-sm text-gray-500 dark:text-gray-400">Menciones</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{c._count.mentions}</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <p className="text-sm text-gray-500 dark:text-gray-400">Tareas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{c._count.tasks}</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <p className="text-sm text-gray-500 dark:text-gray-400">Keywords</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.keywords.length}</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <p className="text-sm text-gray-500 dark:text-gray-400">Grupo TG</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.telegramGroupId ? "Si" : "No"}</p>
        </div>
      </div>

      {/* Share of Voice */}
      <SOVSection clientId={id} />

      {/* Keywords */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Keywords</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {c.keywords.map((kw) => (
            <span
              key={kw.id}
              className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200"
            >
              <span className="text-xs text-gray-400 dark:text-gray-500">{typeLabels[kw.type]}</span>
              {kw.word}
              <button
                onClick={() => removeKeyword.mutate({ id: kw.id })}
                className="ml-1 text-gray-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newKeyword.word.trim()) {
              addKeyword.mutate({ clientId: id, ...newKeyword });
            }
          }}
          className="flex gap-2"
        >
          <input
            placeholder="Nuevo keyword"
            value={newKeyword.word}
            onChange={(e) => setNewKeyword({ ...newKeyword, word: e.target.value })}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <select
            value={newKeyword.type}
            onChange={(e) =>
              setNewKeyword({
                ...newKeyword,
                type: e.target.value as (typeof KEYWORD_TYPES)[number],
              })
            }
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
          >
            {KEYWORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </form>
      </div>

      {/* Grounding Config */}
      <GroundingConfigSection clientId={id} />

      {/* Competitor Comparison */}
      <CompetitorComparison clientId={id} />

      {/* Recent Mentions */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Menciones recientes</h3>
        {c.mentions.map((mention) => (
          <MentionRow
            key={mention.id}
            id={mention.id}
            title={mention.article.title}
            source={mention.article.source}
            clientName={c.name}
            sentiment={mention.sentiment}
            relevance={mention.relevance}
            urgency={mention.urgency}
            date={mention.createdAt}
            url={mention.article.url}
            summary={mention.aiSummary}
          />
        ))}
        {c.mentions.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">No hay menciones aún.</p>
        )}
      </div>
    </div>
  );
}

const SOV_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function SOVSection({ clientId }: { clientId: string }) {
  const [days, setDays] = useState(30);
  const sov = trpc.intelligence.getSOV.useQuery(
    { clientId, days, includeCompetitors: true },
    { refetchOnWindowFocus: false }
  );

  if (sov.isLoading) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Target className="h-5 w-5 text-brand-600" />
          Share of Voice
        </h3>
        <div className="flex h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 dark:border-gray-600 border-t-brand-600" />
        </div>
      </div>
    );
  }

  if (!sov.data) {
    return null;
  }

  const { clientSOV, competitorSOV, history } = sov.data;

  // Datos para el donut chart
  const pieData = [
    { name: clientSOV.name, value: clientSOV.sov },
    ...competitorSOV.map((c) => ({ name: c.name, value: c.sov })),
  ];
  const totalSov = pieData.reduce((sum, d) => sum + d.value, 0);
  if (totalSov < 100 && totalSov > 0) {
    pieData.push({ name: "Otros", value: 100 - totalSov });
  }

  // Datos para el chart de tendencia
  const trendData = history.map((h) => ({
    week: new Date(h.week).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    sov: Number(h.sov.toFixed(1)),
    mentions: h.mentions,
  }));

  // Determinar tendencia
  const currentSov = history[history.length - 1]?.sov || 0;
  const previousSov = history[history.length - 2]?.sov || 0;
  const trend = currentSov > previousSov * 1.05 ? "up" : currentSov < previousSov * 0.95 ? "down" : "stable";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-600 dark:text-emerald-400" : trend === "down" ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400";

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-brand-600" />
            Share of Voice
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Últimos {days} días</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            <span className="text-lg font-bold">{clientSOV.sov.toFixed(1)}%</span>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
          >
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Donut Chart */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">vs Competidores</p>
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
                    paddingAngle={2}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={SOV_COLORS[index % SOV_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {pieData.slice(0, 6).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SOV_COLORS[index % SOV_COLORS.length] }}
                    />
                    <span className="truncate text-gray-600 dark:text-gray-300">{entry.name}</span>
                    <span className="ml-auto font-semibold text-gray-900 dark:text-white">{entry.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[180px] items-center justify-center text-gray-400 dark:text-gray-500">
              Sin datos
            </div>
          )}
        </div>

        {/* Trend Chart */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Tendencia SOV</p>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="sovGradientClient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  domain={[0, "auto"]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "SOV"]}
                />
                <Area
                  type="monotone"
                  dataKey="sov"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#sovGradientClient)"
                  dot={{ fill: "#3b82f6", r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-gray-400 dark:text-gray-500">
              Sin datos de tendencia
            </div>
          )}
        </div>
      </div>

      {/* Weighted SOV info */}
      <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-300">SOV Ponderado (por tier de fuente)</span>
          <span className="font-semibold text-gray-900 dark:text-white">{clientSOV.weightedSov.toFixed(1)}%</span>
        </div>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Tier 1 (nacionales) = 3x | Tier 2 (regionales) = 2x | Tier 3 (digitales) = 1x
        </p>
      </div>
    </div>
  );
}

function CompetitorComparison({ clientId }: { clientId: string }) {
  const [days, setDays] = useState(30);
  const comparison = trpc.clients.compareCompetitors.useQuery(
    { clientId, days },
    { refetchOnWindowFocus: false }
  );

  if (comparison.isLoading) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Comparación con Competidores</h3>
        <div className="flex h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 dark:border-gray-600 border-t-brand-600" />
        </div>
      </div>
    );
  }

  if (!comparison.data?.competitors.length) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Comparación con Competidores</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <BarChart3 className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay competidores configurados</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Agrega keywords de tipo "Competidor" para ver la comparación
          </p>
        </div>
      </div>
    );
  }

  const data = comparison.data;

  // Prepare chart data
  const chartData = [
    {
      name: data.client.name,
      mentions: data.client.mentions,
      fill: "#3b82f6",
      isClient: true,
    },
    ...data.competitors.map((c) => ({
      name: c.name,
      mentions: c.mentions,
      fill: "#9ca3af",
      isClient: false,
    })),
  ];

  // Calculate sentiment percentages
  const calculateSentimentPercent = (sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  }) => {
    const total = sentiment.positive + sentiment.negative + sentiment.neutral + sentiment.mixed;
    if (total === 0) return { positive: 0, negative: 0 };
    return {
      positive: Math.round((sentiment.positive / total) * 100),
      negative: Math.round((sentiment.negative / total) * 100),
    };
  };

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Comparación con Competidores</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Últimos {days} días</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
        >
          <option value={7}>7 días</option>
          <option value={30}>30 días</option>
          <option value={60}>60 días</option>
          <option value={90}>90 días</option>
        </select>
      </div>

      {/* Bar Chart */}
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <XAxis type="number" axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
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
          <Bar dataKey="mentions" name="Menciones" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Detailed Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">Entidad</th>
              <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Menciones</th>
              <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">% Positivo</th>
              <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">% Negativo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
              <td className="py-2 font-medium text-blue-700 dark:text-blue-400">{data.client.name}</td>
              <td className="py-2 text-right text-gray-900 dark:text-white">{data.client.mentions}</td>
              <td className="py-2 text-right text-green-600 dark:text-green-400">
                {calculateSentimentPercent(data.client.sentiment).positive}%
              </td>
              <td className="py-2 text-right text-red-600 dark:text-red-400">
                {calculateSentimentPercent(data.client.sentiment).negative}%
              </td>
            </tr>
            {data.competitors.map((comp) => {
              const percent = calculateSentimentPercent(comp.sentiment);
              return (
                <tr key={comp.name} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-2 text-gray-700 dark:text-gray-300">{comp.name}</td>
                  <td className="py-2 text-right text-gray-900 dark:text-white">{comp.mentions}</td>
                  <td className="py-2 text-right text-green-600 dark:text-green-400">{percent.positive}%</td>
                  <td className="py-2 text-right text-red-600 dark:text-red-400">{percent.negative}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

function GroundingConfigSection({ clientId }: { clientId: string }) {
  const utils = trpc.useUtils();
  const config = trpc.clients.getGroundingConfig.useQuery({ clientId });
  const updateConfig = trpc.clients.updateGroundingConfig.useMutation({
    onSuccess: () => {
      utils.clients.getGroundingConfig.invalidate({ clientId });
    },
  });
  const executeGrounding = trpc.clients.executeManualGrounding.useMutation({
    onSuccess: () => {
      utils.clients.getGroundingConfig.invalidate({ clientId });
    },
  });

  const [localConfig, setLocalConfig] = useState<{
    groundingEnabled: boolean;
    minDailyMentions: number;
    consecutiveDaysThreshold: number;
    groundingArticleCount: number;
    weeklyGroundingEnabled: boolean;
    weeklyGroundingDay: number;
  } | null>(null);

  // Sincronizar config remota con local cuando cambia
  const data = config.data;
  if (data && localConfig === null) {
    setLocalConfig({
      groundingEnabled: data.groundingEnabled,
      minDailyMentions: data.minDailyMentions,
      consecutiveDaysThreshold: data.consecutiveDaysThreshold,
      groundingArticleCount: data.groundingArticleCount,
      weeklyGroundingEnabled: data.weeklyGroundingEnabled,
      weeklyGroundingDay: data.weeklyGroundingDay,
    });
  }

  // Guardar cambios con debounce
  const handleSave = (updates: Partial<typeof localConfig>) => {
    if (!localConfig) return;
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    updateConfig.mutate({ clientId, ...updates });
  };

  if (config.isLoading) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-brand-600" />
          Configuración de Búsqueda Automática
        </h3>
        <div className="flex h-[100px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 dark:border-gray-600 border-t-brand-600" />
        </div>
      </div>
    );
  }

  if (!config.data || !localConfig) {
    return null;
  }

  const lastResult = config.data.lastGroundingResult as {
    articlesFound?: number;
    mentionsCreated?: number;
    trigger?: string;
    error?: string;
    executedAt?: string;
  } | null;

  const formatLastGrounding = () => {
    if (!config.data?.lastGroundingAt) return "Nunca ejecutado";
    const date = new Date(config.data.lastGroundingAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    let timeAgo = "";
    if (diffDays > 0) {
      timeAgo = `hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
    } else if (diffHours > 0) {
      timeAgo = `hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
    } else {
      timeAgo = "hace menos de 1 hora";
    }

    if (lastResult?.articlesFound !== undefined) {
      return `${timeAgo} (${lastResult.articlesFound} artículos, ${lastResult.mentionsCreated || 0} menciones nuevas)`;
    }
    return timeAgo;
  };

  const triggerLabels: Record<string, string> = {
    manual: "Manual",
    auto_low_mentions: "Auto (pocas menciones)",
    weekly: "Semanal programado",
    onboarding: "Onboarding",
  };

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Settings className="h-5 w-5 text-brand-600" />
        Configuración de Búsqueda Automática
      </h3>

      <div className="space-y-6">
        {/* Grounding Automático */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Search className="h-4 w-4" />
                Grounding Automático
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Busca noticias automáticamente cuando hay pocas menciones
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={localConfig.groundingEnabled}
                onChange={(e) => handleSave({ groundingEnabled: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:border-gray-600 dark:bg-gray-700" />
            </label>
          </div>

          {localConfig.groundingEnabled && (
            <div className="ml-6 space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-gray-700 dark:text-gray-300">
                <span>Si hay menos de</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={localConfig.minDailyMentions}
                  onChange={(e) => handleSave({ minDailyMentions: parseInt(e.target.value) || 3 })}
                  className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-center text-gray-900 dark:text-white"
                />
                <span>menciones diarias por</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={localConfig.consecutiveDaysThreshold}
                  onChange={(e) => handleSave({ consecutiveDaysThreshold: parseInt(e.target.value) || 3 })}
                  className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-center text-gray-900 dark:text-white"
                />
                <span>días consecutivos,</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-gray-700 dark:text-gray-300">
                <span>buscar automáticamente</span>
                <input
                  type="number"
                  min={5}
                  max={30}
                  value={localConfig.groundingArticleCount}
                  onChange={(e) => handleSave({ groundingArticleCount: parseInt(e.target.value) || 10 })}
                  className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-center text-gray-900 dark:text-white"
                />
                <span>artículos.</span>
              </div>
            </div>
          )}
        </div>

        {/* Grounding Semanal */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Grounding Semanal
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ejecuta una búsqueda programada cada semana
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={localConfig.weeklyGroundingEnabled}
                onChange={(e) => handleSave({ weeklyGroundingEnabled: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:border-gray-600 dark:bg-gray-700" />
            </label>
          </div>

          {localConfig.weeklyGroundingEnabled && (
            <div className="ml-6 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span>Ejecutar búsqueda cada:</span>
              <select
                value={localConfig.weeklyGroundingDay}
                onChange={(e) => handleSave({ weeklyGroundingDay: parseInt(e.target.value) })}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-gray-900 dark:text-white"
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Estado y acciones */}
        <div className="space-y-4">
          {/* Última búsqueda */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Última búsqueda
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatLastGrounding()}
                </p>
                {lastResult?.trigger && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Disparador: {triggerLabels[lastResult.trigger] || lastResult.trigger}
                  </p>
                )}
                {lastResult?.error && (
                  <p className="text-xs text-red-500 mt-1">Error: {lastResult.error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Botón de búsqueda manual */}
          <button
            onClick={() => executeGrounding.mutate({ clientId, days: 30 })}
            disabled={executeGrounding.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {executeGrounding.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Ejecutar búsqueda ahora
              </>
            )}
          </button>

          {executeGrounding.isSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400 text-center">
              Búsqueda iniciada. Los resultados aparecerán en unos momentos.
            </p>
          )}
          {executeGrounding.isError && (
            <p className="text-sm text-red-500 text-center">
              Error al iniciar la búsqueda. Intenta de nuevo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
