"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { MentionRow } from "@/components/mention-row";
import { SocialMentionRow, SocialMentionRowSkeleton } from "@/components/social-mention-row";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, X, BarChart3, Target, TrendingUp, TrendingDown, Minus, Trash2, Settings, Search, Calendar, Loader2, MessageCircle, Building2, Users, User, RefreshCw, ArrowRightLeft } from "lucide-react";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const client = trpc.clients.getById.useQuery({ id });

  // Solo para Super Admin: lista de organizaciones para transferir
  const organizations = trpc.organizations.listForSelector.useQuery(undefined, {
    enabled: isSuperAdmin,
  });
  const reassignClient = trpc.organizations.reassignClient.useMutation({
    onSuccess: () => {
      client.refetch();
      setShowTransferModal(false);
    },
  });
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

  // Pagination state for mentions
  const [mentionPage, setMentionPage] = useState(1);
  const [mentionPageSize, setMentionPageSize] = useState(10);

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

      {/* Transfer Client Modal - Solo Super Admin */}
      {showTransferModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-purple-600" />
                Transferir cliente
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Mover <strong>{c.name}</strong> a otra organización.
              {c.org && (
                <span className="block mt-1">
                  Actualmente en: <strong>{c.org.name}</strong>
                </span>
              )}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nueva organización
                </label>
                <select
                  id="transfer-org-select"
                  defaultValue=""
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
                >
                  <option value="" disabled>
                    Seleccionar organización...
                  </option>
                  {organizations.data
                    ?.filter((org) => org.id !== c.org?.id)
                    .map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                </select>
              </div>
              {reassignClient.isError && (
                <p className="text-sm text-red-500">
                  {reassignClient.error.message || "Error al transferir cliente"}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const select = document.getElementById("transfer-org-select") as HTMLSelectElement;
                    if (select.value) {
                      reassignClient.mutate({ clientId: id, targetOrgId: select.value });
                    }
                  }}
                  disabled={reassignClient.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {reassignClient.isPending ? "Transfiriendo..." : "Transferir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Organización actual - Solo Super Admin */}
      {isSuperAdmin && c.org && (
        <div className="flex items-center justify-between rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm text-purple-700 dark:text-purple-300">
              Organización: <strong>{c.org.name}</strong>
            </span>
          </div>
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Transferir
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-tour-id="client-stats">
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
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="client-keywords">
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

      {/* Competidores */}
      <CompetitorsSection clientId={id} keywords={c.keywords} addKeyword={addKeyword} removeKeyword={removeKeyword} />

      {/* Grounding Config */}
      <GroundingConfigSection clientId={id} />

      {/* Competitor Comparison */}
      <CompetitorComparison clientId={id} />

      {/* Telegram Recipients */}
      <TelegramRecipientsSection clientId={id} clientName={c.name} />

      {/* Social Accounts Management */}
      <SocialAccountsSection clientId={id} />

      {/* Social Stats Section */}
      <SocialStatsSection clientId={id} />

      {/* Social Mentions Section */}
      <SocialMentionsSection clientId={id} clientName={c.name} />

      {/* Recent Mentions */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Menciones recientes</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Mostrar:</span>
              <select
                value={mentionPageSize}
                onChange={(e) => {
                  setMentionPageSize(Number(e.target.value));
                  setMentionPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            {c._count.mentions > 50 && (
              <Link
                href={`/dashboard/mentions?clientId=${id}`}
                className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Ver todas ({c._count.mentions})
              </Link>
            )}
          </div>
        </div>
        {(() => {
          const startIndex = (mentionPage - 1) * mentionPageSize;
          const endIndex = startIndex + mentionPageSize;
          const paginatedMentions = c.mentions.slice(startIndex, endIndex);
          const totalPages = Math.ceil(c.mentions.length / mentionPageSize);

          return (
            <>
              {paginatedMentions.map((mention) => (
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
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Mostrando {startIndex + 1}-{Math.min(endIndex, c.mentions.length)} de {c.mentions.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMentionPage((p) => Math.max(1, p - 1))}
                      disabled={mentionPage === 1}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Anterior
                    </button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {mentionPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setMentionPage((p) => Math.min(totalPages, p + 1))}
                      disabled={mentionPage === totalPages}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

function CompetitorsSection({
  clientId,
  keywords,
  addKeyword,
  removeKeyword
}: {
  clientId: string;
  keywords: { id: string; word: string; type: string }[];
  addKeyword: { mutate: (data: { clientId: string; word: string; type: "NAME" | "BRAND" | "COMPETITOR" | "TOPIC" | "ALIAS" }) => void; isPending: boolean };
  removeKeyword: { mutate: (data: { id: string }) => void };
}) {
  const [newCompetitor, setNewCompetitor] = useState("");
  const competitors = keywords.filter((kw) => kw.type === "COMPETITOR");

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Target className="h-5 w-5 text-orange-500" />
        Competidores
      </h3>
      <div className="mb-4 flex flex-wrap gap-2">
        {competitors.map((kw) => (
          <span
            key={kw.id}
            className="flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1 text-sm text-orange-700 dark:text-orange-400"
          >
            {kw.word}
            <button
              onClick={() => removeKeyword.mutate({ id: kw.id })}
              className="ml-1 text-orange-500 hover:text-red-500"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {competitors.length === 0 && (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            Sin competidores configurados. Agrega uno para ver la comparación.
          </span>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newCompetitor.trim()) {
            addKeyword.mutate({
              clientId,
              word: newCompetitor.trim(),
              type: "COMPETITOR",
            });
            setNewCompetitor("");
          }
        }}
        className="flex gap-2"
      >
        <input
          placeholder="Nombre del competidor"
          value={newCompetitor}
          onChange={(e) => setNewCompetitor(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400"
        />
        <button
          type="submit"
          disabled={addKeyword.isPending || !newCompetitor.trim()}
          className="flex items-center gap-1 rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </form>
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
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="client-sov">
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
    ...data.competitors.map((c: { name: string; mentions: number }) => ({
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
            {data.competitors.map((comp: { name: string; mentions: number; sentiment: { positive: number; negative: number; neutral: number; mixed: number } }) => {
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

const RECIPIENT_TYPES = {
  AGENCY_INTERNAL: { icon: Building2, label: "Interno", color: "blue" },
  CLIENT_GROUP: { icon: Users, label: "Cliente (Grupo)", color: "green" },
  CLIENT_INDIVIDUAL: { icon: User, label: "Cliente (Individual)", color: "purple" },
} as const;

type RecipientType = keyof typeof RECIPIENT_TYPES;

function TelegramRecipientsSection({ clientId, clientName }: { clientId: string; clientName: string }) {
  const utils = trpc.useUtils();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    chatId: "",
    type: "AGENCY_INTERNAL" as RecipientType,
    label: "",
  });

  const recipients = trpc.clients.getRecipients.useQuery({ clientId });
  const addRecipient = trpc.clients.addRecipient.useMutation({
    onSuccess: () => {
      utils.clients.getRecipients.invalidate({ clientId });
      setShowAddModal(false);
      setNewRecipient({ chatId: "", type: "AGENCY_INTERNAL", label: "" });
    },
  });
  const removeRecipient = trpc.clients.removeRecipient.useMutation({
    onSuccess: () => utils.clients.getRecipients.invalidate({ clientId }),
  });
  const updateRecipient = trpc.clients.updateRecipient.useMutation({
    onSuccess: () => utils.clients.getRecipients.invalidate({ clientId }),
  });

  if (recipients.isLoading) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-brand-600" />
          Destinatarios de Telegram
        </h3>
        <div className="flex h-[100px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 dark:border-gray-600 border-t-brand-600" />
        </div>
      </div>
    );
  }

  const data = recipients.data;
  type RecipientData = NonNullable<typeof data>["recipients"][number];
  const activeRecipients = data?.recipients.filter((r: RecipientData) => r.active) || [];
  const hasRecipients = activeRecipients.length > 0;

  // Agrupar por tipo
  const grouped = activeRecipients.reduce(
    (acc: Record<RecipientType, RecipientData[]>, r: RecipientData) => {
      if (!acc[r.type as RecipientType]) {
        acc[r.type as RecipientType] = [];
      }
      acc[r.type as RecipientType].push(r);
      return acc;
    },
    {} as Record<RecipientType, RecipientData[]>
  );

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="client-telegram">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-brand-600" />
          Destinatarios de Telegram
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {activeRecipients.length} activo{activeRecipients.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </div>
      </div>

      {/* Modal para agregar destinatario */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Agregar destinatario de Telegram
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addRecipient.mutate({
                  clientId,
                  chatId: newRecipient.chatId,
                  type: newRecipient.type,
                  label: newRecipient.label || undefined,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chat ID de Telegram *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: -1001234567890"
                  value={newRecipient.chatId}
                  onChange={(e) => setNewRecipient({ ...newRecipient, chatId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Agrega el bot @NewsAiBot_bot al grupo y escribe /start para obtener el Chat ID
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de destinatario *
                </label>
                <select
                  value={newRecipient.type}
                  onChange={(e) => setNewRecipient({ ...newRecipient, type: e.target.value as RecipientType })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
                >
                  <option value="AGENCY_INTERNAL">Interno (equipo de agencia)</option>
                  <option value="CLIENT_GROUP">Grupo del cliente</option>
                  <option value="CLIENT_INDIVIDUAL">Individual del cliente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Etiqueta (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Grupo de PR, Juan CMO"
                  value={newRecipient.label}
                  onChange={(e) => setNewRecipient({ ...newRecipient, label: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>

              {addRecipient.isError && (
                <p className="text-sm text-red-500">
                  {addRecipient.error.message || "Error al agregar destinatario"}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addRecipient.isPending || !newRecipient.chatId}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {addRecipient.isPending ? "Agregando..." : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!hasRecipients ? (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Sin destinatarios configurados
              </h4>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                Las menciones importantes no generarán alertas de Telegram.
              </p>
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
                Para vincular: agrega el bot @MediaBotPR a un grupo y envía{" "}
                <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">/vincular {clientName}</code>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {(["AGENCY_INTERNAL", "CLIENT_GROUP", "CLIENT_INDIVIDUAL"] as RecipientType[]).map((type) => {
            const typeRecipients = grouped[type];
            if (!typeRecipients || typeRecipients.length === 0) return null;

            const { icon: Icon, label, color } = RECIPIENT_TYPES[type];
            const colorClasses = {
              blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
              green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
              purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
            };

            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${colorClasses[color].split(" ")[1]}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                  <span className="text-xs text-gray-400">({typeRecipients.length})</span>
                </div>
                <div className="space-y-2 ml-6">
                  {typeRecipients.map((recipient: RecipientData) => (
                    <div
                      key={recipient.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${colorClasses[color]}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{recipient.label || "Sin nombre"}</span>
                        <span className="text-xs opacity-60">
                          ID: ...{recipient.chatId.slice(-8)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeRecipient.mutate({ id: recipient.id })}
                        disabled={removeRecipient.isPending}
                        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                        title="Eliminar destinatario"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Instrucciones */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Agregar más:</strong> Usa <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/vincular {clientName} [tipo]</code> en el bot de Telegram.
              Tipos: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">interno</code> | <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">cliente</code>
            </p>
          </div>
        </div>
      )}
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
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="client-grounding">
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

          {/* Búsqueda manual con selector de días */}
          <ManualGroundingButton clientId={clientId} executeGrounding={executeGrounding} />

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

/**
 * Componente para búsqueda manual con selector de días.
 */
function ManualGroundingButton({
  clientId,
  executeGrounding,
}: {
  clientId: string;
  executeGrounding: ReturnType<typeof trpc.clients.executeManualGrounding.useMutation>;
}) {
  const [manualGroundingDays, setManualGroundingDays] = useState(30);

  return (
    <div className="flex gap-2">
      <select
        value={manualGroundingDays}
        onChange={(e) => setManualGroundingDays(Number(e.target.value))}
        disabled={executeGrounding.isPending}
        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white disabled:opacity-50"
      >
        <option value={7}>7 días</option>
        <option value={14}>14 días</option>
        <option value={30}>30 días</option>
        <option value={45}>45 días</option>
        <option value={60}>60 días</option>
      </select>
      <button
        onClick={() => executeGrounding.mutate({ clientId, days: manualGroundingDays })}
        disabled={executeGrounding.isPending}
        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {executeGrounding.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Buscar noticias
          </>
        )}
      </button>
    </div>
  );
}

// Tipos de plataformas sociales
type SocialPlatform = "TWITTER" | "INSTAGRAM" | "TIKTOK";

const PLATFORMS: { value: SocialPlatform; label: string; icon: string }[] = [
  { value: "TWITTER", label: "Twitter/X", icon: "𝕏" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
  { value: "TIKTOK", label: "TikTok", icon: "🎵" },
];

/**
 * Sección para gestionar cuentas de redes sociales y hashtags de un cliente.
 */
function SocialAccountsSection({ clientId }: { clientId: string }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState<{
    platform: SocialPlatform;
    handle: string;
    label: string;
    isOwned: boolean;
  }>({ platform: "TWITTER", handle: "", label: "", isOwned: false });
  const [newHashtag, setNewHashtag] = useState("");
  const utils = trpc.useUtils();

  const socialData = trpc.social.getSocialAccounts.useQuery(
    { clientId },
    { refetchOnWindowFocus: false }
  );

  const addAccount = trpc.social.addSocialAccount.useMutation({
    onSuccess: () => {
      utils.social.getSocialAccounts.invalidate({ clientId });
      setNewAccount({ platform: "TWITTER", handle: "", label: "", isOwned: false });
      setShowAddForm(false);
    },
  });

  const removeAccount = trpc.social.removeSocialAccount.useMutation({
    onSuccess: () => utils.social.getSocialAccounts.invalidate({ clientId }),
  });

  const updateConfig = trpc.social.updateSocialConfig.useMutation({
    onSuccess: () => utils.social.getSocialAccounts.invalidate({ clientId }),
  });

  const handleAddHashtag = () => {
    if (!newHashtag.trim() || !socialData.data) return;
    const current = (socialData.data.socialHashtags as string[]) || [];
    const clean = newHashtag.replace(/^#/, "").trim();
    if (current.includes(clean)) return;
    updateConfig.mutate({ clientId, socialHashtags: [...current, clean] });
    setNewHashtag("");
  };

  const handleRemoveHashtag = (tag: string) => {
    if (!socialData.data) return;
    const current = (socialData.data.socialHashtags as string[]) || [];
    updateConfig.mutate({ clientId, socialHashtags: current.filter((h) => h !== tag) });
  };

  const handleToggleMonitoring = () => {
    if (!socialData.data) return;
    updateConfig.mutate({
      clientId,
      socialMonitoringEnabled: !socialData.data.socialMonitoringEnabled,
    });
  };

  if (socialData.isLoading) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 h-20 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    );
  }

  const accounts = socialData.data?.accounts.filter((a) => a.active) || [];
  const hashtags = (socialData.data?.socialHashtags as string[]) || [];
  const monitoringEnabled = socialData.data?.socialMonitoringEnabled ?? false;

  const platformLabels: Record<string, string> = {
    TWITTER: "Twitter/X",
    INSTAGRAM: "Instagram",
    TIKTOK: "TikTok",
  };

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="client-social-accounts">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" />
            Cuentas Sociales
          </h3>
          <button
            onClick={handleToggleMonitoring}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              monitoringEnabled
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {monitoringEnabled ? "Monitoreo activo" : "Monitoreo inactivo"}
          </button>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar cuenta
        </button>
      </div>

      {/* Formulario para agregar cuenta */}
      {showAddForm && (
        <div className="mb-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plataforma</label>
              <select
                value={newAccount.platform}
                onChange={(e) => setNewAccount({ ...newAccount, platform: e.target.value as SocialPlatform })}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Handle</label>
              <input
                type="text"
                value={newAccount.handle}
                onChange={(e) => setNewAccount({ ...newAccount, handle: e.target.value })}
                placeholder="@usuario"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Etiqueta</label>
              <input
                type="text"
                value={newAccount.label}
                onChange={(e) => setNewAccount({ ...newAccount, label: e.target.value })}
                placeholder="Cuenta oficial, Competidor..."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAccount.isOwned}
                  onChange={(e) => setNewAccount({ ...newAccount, isOwned: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">Propia</span>
              </label>
              <button
                onClick={() => {
                  if (newAccount.handle.trim()) {
                    addAccount.mutate({
                      clientId,
                      platform: newAccount.platform,
                      handle: newAccount.handle,
                      label: newAccount.label || undefined,
                      isOwned: newAccount.isOwned,
                    });
                  }
                }}
                disabled={addAccount.isPending || !newAccount.handle.trim()}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {addAccount.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Agregar"
                )}
              </button>
            </div>
          </div>
          {addAccount.isError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{addAccount.error.message}</p>
          )}
        </div>
      )}

      {/* Lista de cuentas */}
      {accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-gray-200 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {platformLabels[account.platform] || account.platform}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">@{account.handle}</span>
                {account.label && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">{account.label}</span>
                )}
                {account.isOwned && (
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-400">
                    Propia
                  </span>
                )}
              </div>
              <button
                onClick={() => removeAccount.mutate({ id: account.id })}
                disabled={removeAccount.isPending}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          Sin cuentas configuradas. Agrega cuentas para monitorear redes sociales.
        </p>
      )}

      {/* Hashtags */}
      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hashtags monitoreados</p>
        <div className="flex flex-wrap gap-2">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-3 py-1 text-sm text-purple-700 dark:text-purple-300"
            >
              #{tag}
              <button
                onClick={() => handleRemoveHashtag(tag)}
                className="ml-1 text-purple-400 hover:text-purple-700 dark:hover:text-purple-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddHashtag(); }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              value={newHashtag}
              onChange={(e) => setNewHashtag(e.target.value)}
              placeholder="Agregar hashtag..."
              className="w-32 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!newHashtag.trim() || updateConfig.isPending}
              className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Colores de plataformas sociales para gráficas
const SOCIAL_PLATFORM_COLORS: Record<string, string> = {
  TWITTER: "#000000",
  INSTAGRAM: "#E4405F",
  TIKTOK: "#000000",
};

/**
 * Sección de estadísticas de redes sociales con gráficas.
 */
function SocialStatsSection({ clientId }: { clientId: string }) {
  const [days, setDays] = useState(7);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(["TWITTER", "INSTAGRAM", "TIKTOK"]);
  const [collectHandles, setCollectHandles] = useState(true);
  const [collectHashtags, setCollectHashtags] = useState(true);
  const utils = trpc.useUtils();

  const stats = trpc.social.getSocialStats.useQuery(
    { clientId, days },
    { refetchOnWindowFocus: false }
  );

  const trend = trpc.social.getSocialTrend.useQuery(
    { clientId, days },
    { refetchOnWindowFocus: false }
  );

  const triggerCollection = trpc.social.triggerCollection.useMutation({
    onSuccess: () => {
      setShowOptions(false);
      // Refrescar datos después de unos segundos
      setTimeout(() => {
        utils.social.getSocialStats.invalidate({ clientId });
        utils.social.getSocialTrend.invalidate({ clientId });
        utils.social.getSocialMentions.invalidate({ clientId });
      }, 5000);
    },
  });

  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleCollect = () => {
    const platforms = selectedPlatforms.length === 3 ? undefined : selectedPlatforms;
    triggerCollection.mutate({
      clientId,
      platforms,
      collectHandles,
      collectHashtags,
    });
  };

  if (stats.isLoading || trend.isLoading) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-600" />
          Redes Sociales
        </h3>
        <div className="flex h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 dark:border-gray-600 border-t-brand-600" />
        </div>
      </div>
    );
  }

  if (!stats.data) {
    return null;
  }

  const { total, byPlatform, bySentiment } = stats.data;
  const trendData = trend.data?.trend || [];

  // Datos para el pie chart de plataformas
  const pieData = Object.entries(byPlatform)
    .filter(([, count]) => count > 0)
    .map(([platform, count]) => ({
      name: platform,
      value: count,
      fill: SOCIAL_PLATFORM_COLORS[platform] || "#6b7280",
    }));

  // Datos para el chart de tendencia
  const chartTrendData = trendData.map((t) => ({
    date: new Date(t.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    count: t.count,
  }));

  const platformLabels: Record<string, string> = {
    TWITTER: "Twitter/X",
    INSTAGRAM: "Instagram",
    TIKTOK: "TikTok",
  };

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20" data-tour-id="client-social">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-600" />
            Redes Sociales
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Últimos {days} días</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowOptions(!showOptions)}
              disabled={triggerCollection.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {triggerCollection.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recolectando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Recolectar
                  <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>

            {/* Dropdown con opciones */}
            {showOptions && !triggerCollection.isPending && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 z-10">
                <div className="p-3 space-y-3">
                  {/* Plataformas */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Plataformas</p>
                    <div className="space-y-1">
                      {PLATFORMS.map((p) => (
                        <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPlatforms.includes(p.value)}
                            onChange={() => togglePlatform(p.value)}
                            className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {p.icon} {p.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tipos de fuente */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Fuentes</p>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={collectHandles}
                          onChange={(e) => setCollectHandles(e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          👤 Cuentas monitoreadas
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={collectHashtags}
                          onChange={(e) => setCollectHashtags(e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          #️⃣ Hashtags
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Botón de ejecutar */}
                  <button
                    onClick={handleCollect}
                    disabled={selectedPlatforms.length === 0 || (!collectHandles && !collectHashtags)}
                    className="w-full mt-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Iniciar recolección
                  </button>
                </div>
              </div>
            )}
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

      {/* Mensaje de éxito/error */}
      {triggerCollection.isSuccess && (
        <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
          Recolección iniciada. Los resultados aparecerán en unos momentos.
        </div>
      )}
      {triggerCollection.isError && (
        <div className={cn(
          "mb-4 rounded-lg border p-3 text-sm",
          triggerCollection.error.data?.code === "TOO_MANY_REQUESTS"
            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
        )}>
          {triggerCollection.error.message || "Error al iniciar recoleccion"}
        </div>
      )}

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
        </div>
        {(["TWITTER", "INSTAGRAM", "TIKTOK"] as const).map((platform) => (
          <div key={platform} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{platformLabels[platform]}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {byPlatform[platform] || 0}
            </p>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <BarChart3 className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sin menciones sociales en este período</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Configura cuentas y hashtags para monitorear
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Donut Chart - Distribución por plataforma */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Por plataforma</p>
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
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="truncate text-gray-600 dark:text-gray-300">
                        {platformLabels[entry.name] || entry.name}
                      </span>
                      <span className="ml-auto font-semibold text-gray-900 dark:text-white">
                        {entry.value}
                      </span>
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

          {/* Area Chart - Tendencia */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Tendencia</p>
            {chartTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartTrendData}>
                  <defs>
                    <linearGradient id="socialTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                    formatter={(value: number) => [value, "Menciones"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#socialTrendGradient)"
                    dot={{ fill: "#8b5cf6", r: 3 }}
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
      )}
    </div>
  );
}

/**
 * Sección de menciones sociales recientes con paginación.
 */
function SocialMentionsSection({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [pageSize, setPageSize] = useState(10);

  const mentions = trpc.social.getSocialMentions.useQuery(
    { clientId, days: 30, limit: pageSize },
    { refetchOnWindowFocus: false }
  );

  if (mentions.isLoading) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Menciones Sociales Recientes</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <SocialMentionRowSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const data = mentions.data;
  const items = data?.items || [];
  const hasMore = data?.hasMore || false;

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Menciones Sociales Recientes</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <Link
            href={`/dashboard/social-mentions?clientId=${clientId}`}
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Ver todas →
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <BarChart3 className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay menciones sociales</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Configura cuentas y hashtags para comenzar a monitorear
          </p>
        </div>
      ) : (
        <>
          {items.map((mention) => (
            <SocialMentionRow
              key={mention.id}
              id={mention.id}
              platform={mention.platform}
              postUrl={mention.postUrl}
              content={mention.content}
              authorHandle={mention.authorHandle}
              authorName={mention.authorName}
              authorFollowers={mention.authorFollowers}
              likes={mention.likes}
              comments={mention.comments}
              shares={mention.shares}
              views={mention.views}
              sentiment={mention.sentiment}
              relevance={mention.relevance}
              sourceType={mention.sourceType}
              sourceValue={mention.sourceValue}
              clientName={clientName}
              postedAt={mention.postedAt}
              createdAt={mention.createdAt}
              commentsAnalyzed={mention.commentsAnalyzed}
              commentsSentiment={mention.commentsSentiment}
            />
          ))}
          {hasMore && (
            <div className="mt-4 text-center">
              <Link
                href={`/dashboard/social-mentions?clientId=${clientId}`}
                className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Ver más menciones →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
