"use client";

import { trpc } from "@/lib/trpc";
import { SocialMentionRow, SocialMentionRowSkeleton } from "@/components/social-mention-row";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Users, TrendingUp, Hash, Share2, Trash2, Loader2, X } from "lucide-react";
import { FilterBar, FilterSelect, FilterDateRange, FilterChips } from "@/components/filters";
import { FilterBarSkeleton, TableSkeleton } from "@/components/skeletons";

const PLATFORM_OPTIONS = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE", label: "YouTube" },
];

const SENTIMENT_OPTIONS = [
  { value: "POSITIVE", label: "Positivo" },
  { value: "NEGATIVE", label: "Negativo" },
  { value: "NEUTRAL", label: "Neutral" },
  { value: "MIXED", label: "Mixto" },
];

const SOURCE_TYPE_OPTIONS = [
  { value: "HANDLE", label: "Cuenta" },
  { value: "HASHTAG", label: "Hashtag" },
  { value: "KEYWORD", label: "Keyword" },
];

interface Filters {
  clientId: string;
  platform: string;
  sentiment: string;
  sourceType: string;
  startDate: string | null;
  endDate: string | null;
}

export default function SocialMentionsPage() {
  return (
    <Suspense fallback={<SocialMentionsPageLoading />}>
      <SocialMentionsPageContent />
    </Suspense>
  );
}

function SocialMentionsPageLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Share2 className="h-6 w-6 text-brand-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Redes Sociales</h2>
        </div>
      </div>
      <FilterBarSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MentionItem = any;

function exportMentionsToCsv(mentionsList: MentionItem[], filename: string) {
  if (!mentionsList.length) return;

  const headers = [
    "Plataforma",
    "Autor",
    "Contenido",
    "Likes",
    "Comentarios",
    "Shares",
    "Views",
    "Sentimiento",
    "Relevancia",
    "Fuente",
    "Cliente",
    "Fecha",
    "URL",
  ];

  const rows = mentionsList.map((m) => [
    m.platform,
    `@${m.authorHandle}`,
    (m.content || "").replace(/"/g, '""'),
    m.likes,
    m.comments,
    m.shares,
    m.views || "",
    m.sentiment || "",
    m.relevance || "",
    `${m.sourceType}: ${m.sourceValue}`,
    m.client.name,
    m.postedAt ? new Date(m.postedAt).toISOString() : new Date(m.createdAt).toISOString(),
    m.postUrl,
  ]);

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
}

function SocialMentionsPageContent() {
  const searchParams = useSearchParams();
  const urlClientId = searchParams.get("clientId");
  const utils = trpc.useUtils();

  const [filters, setFilters] = useState<Filters>({
    clientId: "",
    platform: "",
    sentiment: "",
    sourceType: "",
    startDate: null,
    endDate: null,
  });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (urlClientId) {
      setFilters((f) => ({ ...f, clientId: urlClientId }));
    }
  }, [urlClientId]);

  // Limpiar selección cuando cambien filtros
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

  const clients = trpc.clients.list.useQuery();

  const stats = trpc.social.getGlobalSocialStats.useQuery({
    clientId: filters.clientId || undefined,
    days: 7,
  });

  const mentions = trpc.social.listAllSocialMentions.useInfiniteQuery(
    {
      clientId: filters.clientId || undefined,
      platform: (filters.platform || undefined) as "TWITTER" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | undefined,
      sentiment: (filters.sentiment || undefined) as "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED" | undefined,
      sourceType: (filters.sourceType || undefined) as "HANDLE" | "HASHTAG" | "KEYWORD" | undefined,
      dateFrom: filters.startDate ? new Date(filters.startDate) : undefined,
      dateTo: filters.endDate ? new Date(filters.endDate + "T23:59:59") : undefined,
      limit: 30,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const allMentions = useMemo(
    () => mentions.data?.pages.flatMap((p) => p.mentions) || [],
    [mentions.data]
  );

  const deleteMutation = trpc.social.deleteSocialMentions.useMutation({
    onSuccess: (data) => {
      setActionMessage({ type: "success", text: `${data.deletedCount} mencion${data.deletedCount !== 1 ? "es" : ""} eliminada${data.deletedCount !== 1 ? "s" : ""}` });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      utils.social.listAllSocialMentions.invalidate();
      utils.social.getGlobalSocialStats.invalidate();
    },
    onError: (error) => {
      setActionMessage({ type: "error", text: error.message });
      setShowDeleteConfirm(false);
    },
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === allMentions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allMentions.map((m) => m.id)));
    }
  }, [allMentions, selectedIds.size]);

  const handleExport = () => {
    exportMentionsToCsv(allMentions, `social-mentions-${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleExportSelected = () => {
    const selected = allMentions.filter((m) => selectedIds.has(m.id));
    exportMentionsToCsv(selected, `social-mentions-selected-${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleBulkDelete = () => {
    deleteMutation.mutate({ ids: Array.from(selectedIds) });
  };

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  const activeFilterCount = [
    filters.clientId,
    filters.platform,
    filters.sentiment,
    filters.sourceType,
    filters.startDate,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilters({
      clientId: "",
      platform: "",
      sentiment: "",
      sourceType: "",
      startDate: null,
      endDate: null,
    });
  };

  const filterChips = useMemo(() => {
    const chips = [];
    if (filters.clientId) {
      const client = clients.data?.find((c) => c.id === filters.clientId);
      chips.push({ key: "clientId", label: "Cliente", value: client?.name || filters.clientId });
    }
    if (filters.platform) {
      const platform = PLATFORM_OPTIONS.find((p) => p.value === filters.platform);
      chips.push({ key: "platform", label: "Plataforma", value: platform?.label || filters.platform });
    }
    if (filters.sentiment) {
      const sentiment = SENTIMENT_OPTIONS.find((s) => s.value === filters.sentiment);
      chips.push({ key: "sentiment", label: "Sentimiento", value: sentiment?.label || filters.sentiment });
    }
    if (filters.sourceType) {
      const source = SOURCE_TYPE_OPTIONS.find((s) => s.value === filters.sourceType);
      chips.push({ key: "sourceType", label: "Tipo", value: source?.label || filters.sourceType });
    }
    if (filters.startDate && filters.endDate) {
      chips.push({ key: "date", label: "Periodo", value: `${filters.startDate} - ${filters.endDate}` });
    } else if (filters.startDate) {
      chips.push({ key: "date", label: "Desde", value: filters.startDate });
    }
    return chips;
  }, [filters, clients.data]);

  const handleRemoveChip = (key: string) => {
    if (key === "date") {
      setFilters((f) => ({ ...f, startDate: null, endDate: null }));
    } else {
      setFilters((f) => ({ ...f, [key]: "" }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Share2 className="h-6 w-6 text-brand-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Redes Sociales</h2>
        </div>
        <button
          onClick={handleExport}
          disabled={!allMentions.length}
          className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {/* Mensaje de acción */}
      {actionMessage && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ${
          actionMessage.type === "success"
            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      {stats.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total"
            value={stats.data.total}
            icon={<Share2 className="h-5 w-5" />}
            color="bg-brand-500"
          />
          <StatCard
            label="Instagram"
            value={stats.data.byPlatform.INSTAGRAM || 0}
            icon={<span className="text-sm font-bold">IG</span>}
            color="bg-gradient-to-r from-purple-500 to-pink-500"
          />
          <StatCard
            label="TikTok"
            value={stats.data.byPlatform.TIKTOK || 0}
            icon={<span className="text-sm font-bold">TT</span>}
            color="bg-black dark:bg-gray-700"
          />
          <StatCard
            label="YouTube"
            value={stats.data.byPlatform.YOUTUBE || 0}
            icon={<span className="text-sm font-bold">YT</span>}
            color="bg-red-600"
          />
        </div>
      )}

      {/* Filtros */}
      <FilterBar activeCount={activeFilterCount} onClear={handleClearFilters}>
        <FilterSelect
          label="Cliente"
          value={filters.clientId}
          options={clientOptions}
          onChange={(v) => setFilters((f) => ({ ...f, clientId: v }))}
          placeholder="Todos los clientes"
          icon={<Users className="h-4 w-4" />}
        />
        <FilterSelect
          label="Plataforma"
          value={filters.platform}
          options={PLATFORM_OPTIONS}
          onChange={(v) => setFilters((f) => ({ ...f, platform: v }))}
          placeholder="Todas"
          icon={<Share2 className="h-4 w-4" />}
        />
        <FilterSelect
          label="Sentimiento"
          value={filters.sentiment}
          options={SENTIMENT_OPTIONS}
          onChange={(v) => setFilters((f) => ({ ...f, sentiment: v }))}
          placeholder="Todos"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <FilterSelect
          label="Tipo Fuente"
          value={filters.sourceType}
          options={SOURCE_TYPE_OPTIONS}
          onChange={(v) => setFilters((f) => ({ ...f, sourceType: v }))}
          placeholder="Todos"
          icon={<Hash className="h-4 w-4" />}
        />
        <FilterDateRange
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={(start, end) => setFilters((f) => ({ ...f, startDate: start, endDate: end }))}
        />
      </FilterBar>

      {/* Chips de filtros activos */}
      <FilterChips chips={filterChips} onRemove={handleRemoveChip} />

      {/* Barra de acciones de selección */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
              {selectedIds.size} mencion{selectedIds.size !== 1 ? "es" : ""} seleccionada{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-200"
            >
              Deseleccionar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSelected}
              className="flex items-center gap-1.5 rounded-md bg-white dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación bulk */}
      {showDeleteConfirm && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Eliminar {selectedIds.size} mencion{selectedIds.size !== 1 ? "es" : ""} permanentemente?
          </p>
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            Se eliminaran las metricas de engagement, analisis de sentimiento, resumenes IA y comentarios extraidos de cada mencion.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleteMutation.isPending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Confirmar eliminacion"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de menciones */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        {mentions.isLoading && (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <SocialMentionRowSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Select all header */}
        {allMentions.length > 0 && (
          <div className="mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={selectedIds.size === allMentions.length && allMentions.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
              />
              Seleccionar todos
            </label>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Mostrando {allMentions.length} menciones
            </span>
          </div>
        )}

        {allMentions.map((mention) => (
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
            clientName={mention.client.name}
            postedAt={mention.postedAt}
            createdAt={mention.createdAt}
            commentsAnalyzed={mention.commentsAnalyzed}
            commentsSentiment={mention.commentsSentiment}
            selected={selectedIds.has(mention.id)}
            onToggleSelect={() => toggleSelect(mention.id)}
          />
        ))}
        {allMentions.length === 0 && !mentions.isLoading && (
          <div className="py-12 text-center">
            <Share2 className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              No hay menciones sociales que coincidan con los filtros.
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Las menciones aparecen cuando el sistema recolecta posts de redes sociales.
            </p>
          </div>
        )}

        {/* Paginación */}
        {mentions.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => mentions.fetchNextPage()}
              disabled={mentions.isFetchingNextPage}
              className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {mentions.isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </>
              ) : (
                "Cargar mas menciones"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color} text-white`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
