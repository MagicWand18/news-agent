"use client";

import { trpc } from "@/lib/trpc";
import { SocialMentionRow, SocialMentionRowSkeleton } from "@/components/social-mention-row";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Users, TrendingUp, Hash, AtSign, Search, Share2 } from "lucide-react";
import { FilterBar, FilterSelect, FilterDateRange, FilterChips } from "@/components/filters";

const PLATFORM_OPTIONS = [
  { value: "TWITTER", label: "Twitter" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
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
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      </div>
    </div>
  );
}

function SocialMentionsPageContent() {
  const searchParams = useSearchParams();
  const urlClientId = searchParams.get("clientId");

  const [filters, setFilters] = useState<Filters>({
    clientId: "",
    platform: "",
    sentiment: "",
    sourceType: "",
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    if (urlClientId) {
      setFilters((f) => ({ ...f, clientId: urlClientId }));
    }
  }, [urlClientId]);

  const clients = trpc.clients.list.useQuery();

  const stats = trpc.social.getGlobalSocialStats.useQuery({
    clientId: filters.clientId || undefined,
    days: 7,
  });

  const mentions = trpc.social.listAllSocialMentions.useQuery({
    clientId: filters.clientId || undefined,
    platform: (filters.platform || undefined) as "TWITTER" | "INSTAGRAM" | "TIKTOK" | undefined,
    sentiment: (filters.sentiment || undefined) as "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED" | undefined,
    sourceType: (filters.sourceType || undefined) as "HANDLE" | "HASHTAG" | "KEYWORD" | undefined,
    dateFrom: filters.startDate ? new Date(filters.startDate) : undefined,
    dateTo: filters.endDate ? new Date(filters.endDate + "T23:59:59") : undefined,
    limit: 30,
  });

  const handleExport = () => {
    if (!mentions.data?.mentions.length) return;

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

    const rows = mentions.data.mentions.map((m) => [
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
    link.setAttribute("download", `social-mentions-${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
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
          disabled={!mentions.data?.mentions.length}
          className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

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
            label="Twitter"
            value={stats.data.byPlatform.TWITTER || 0}
            icon={<span className="text-sm font-bold">X</span>}
            color="bg-black dark:bg-gray-700"
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

      {/* Lista de menciones */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        {mentions.isLoading && (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <SocialMentionRowSkeleton key={i} />
            ))}
          </div>
        )}
        {mentions.data?.mentions.map((mention) => (
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
          />
        ))}
        {mentions.data?.mentions.length === 0 && (
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
        {mentions.data?.nextCursor && (
          <p className="mt-4 text-center text-sm text-gray-400 dark:text-gray-500">
            Hay mas resultados. Refina los filtros para ver menos.
          </p>
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
