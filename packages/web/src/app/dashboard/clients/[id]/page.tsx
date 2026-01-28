"use client";

import { trpc } from "@/lib/trpc";
import { MentionRow } from "@/components/mention-row";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, X, BarChart3 } from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
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
  const id = params.id as string;

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

  const [newKeyword, setNewKeyword] = useState<{
    word: string;
    type: (typeof KEYWORD_TYPES)[number];
  }>({ word: "", type: "NAME" });

  if (client.isLoading) return <div>Cargando...</div>;
  if (!client.data) return <div>Cliente no encontrado</div>;

  const c = client.data;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a clientes
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{c.name}</h2>
          <p className="text-gray-500">
            {c.industry || "Sin industria"} · {c.description || "Sin descripcion"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            c.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
          }`}
        >
          {c.active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Menciones</p>
          <p className="text-2xl font-bold">{c._count.mentions}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Tareas</p>
          <p className="text-2xl font-bold">{c._count.tasks}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Keywords</p>
          <p className="text-2xl font-bold">{c.keywords.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Grupo TG</p>
          <p className="text-2xl font-bold">{c.telegramGroupId ? "Si" : "No"}</p>
        </div>
      </div>

      {/* Keywords */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold">Keywords</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {c.keywords.map((kw) => (
            <span
              key={kw.id}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
            >
              <span className="text-xs text-gray-400">{typeLabels[kw.type]}</span>
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
            className="flex-1 rounded-lg border px-3 py-2"
          />
          <select
            value={newKeyword.type}
            onChange={(e) =>
              setNewKeyword({
                ...newKeyword,
                type: e.target.value as (typeof KEYWORD_TYPES)[number],
              })
            }
            className="rounded-lg border px-3 py-2"
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

      {/* Competitor Comparison */}
      <CompetitorComparison clientId={id} />

      {/* Recent Mentions */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold">Menciones recientes</h3>
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
          <p className="text-gray-500">No hay menciones aun.</p>
        )}
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
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold">Comparacion con Competidores</h3>
        <div className="flex h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      </div>
    );
  }

  if (!comparison.data?.competitors.length) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold">Comparacion con Competidores</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <BarChart3 className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No hay competidores configurados</p>
          <p className="mt-1 text-xs text-gray-400">
            Agrega keywords de tipo "Competidor" para ver la comparacion
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
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Comparacion con Competidores</h3>
          <p className="text-sm text-gray-500">Ultimos {days} dias</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={60}>60 dias</option>
          <option value={90}>90 dias</option>
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
            <tr className="border-b text-left">
              <th className="pb-2 font-medium text-gray-500">Entidad</th>
              <th className="pb-2 text-right font-medium text-gray-500">Menciones</th>
              <th className="pb-2 text-right font-medium text-gray-500">% Positivo</th>
              <th className="pb-2 text-right font-medium text-gray-500">% Negativo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-blue-50">
              <td className="py-2 font-medium text-blue-700">{data.client.name}</td>
              <td className="py-2 text-right">{data.client.mentions}</td>
              <td className="py-2 text-right text-green-600">
                {calculateSentimentPercent(data.client.sentiment).positive}%
              </td>
              <td className="py-2 text-right text-red-600">
                {calculateSentimentPercent(data.client.sentiment).negative}%
              </td>
            </tr>
            {data.competitors.map((comp) => {
              const percent = calculateSentimentPercent(comp.sentiment);
              return (
                <tr key={comp.name} className="border-b">
                  <td className="py-2 text-gray-700">{comp.name}</td>
                  <td className="py-2 text-right">{comp.mentions}</td>
                  <td className="py-2 text-right text-green-600">{percent.positive}%</td>
                  <td className="py-2 text-right text-red-600">{percent.negative}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
