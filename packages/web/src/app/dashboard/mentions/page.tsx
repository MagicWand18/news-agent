"use client";

import { trpc } from "@/lib/trpc";
import { MentionRow } from "@/components/mention-row";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Users, TrendingUp, AlertTriangle, Globe, Clock, Archive } from "lucide-react";
import { exportMentionsToCsv } from "@/lib/csv-export";
import { FilterBar, FilterSelect, FilterDateRange, FilterChips } from "@/components/filters";
import { cn } from "@/lib/cn";
import { FilterBarSkeleton, TableSkeleton } from "@/components/skeletons";

const SENTIMENT_OPTIONS = [
  { value: "POSITIVE", label: "Positivo" },
  { value: "NEGATIVE", label: "Negativo" },
  { value: "NEUTRAL", label: "Neutral" },
  { value: "MIXED", label: "Mixto" },
];

const URGENCY_OPTIONS = [
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Media" },
  { value: "LOW", label: "Baja" },
];

interface Filters {
  clientId: string;
  sentiment: string;
  urgency: string;
  source: string;
  startDate: string | null;
  endDate: string | null;
}

export default function MentionsPage() {
  return (
    <Suspense fallback={<MentionsPageLoading />}>
      <MentionsPageContent />
    </Suspense>
  );
}

function MentionsPageLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Menciones</h2>
      </div>
      <FilterBarSkeleton />
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}

function MentionsPageContent() {
  const searchParams = useSearchParams();
  const urlClientId = searchParams.get("clientId");

  const [showLegacy, setShowLegacy] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    clientId: "",
    sentiment: "",
    urgency: "",
    source: "",
    startDate: null,
    endDate: null,
  });

  // Inicializar el filtro clientId desde la URL
  useEffect(() => {
    if (urlClientId) {
      setFilters((f) => ({ ...f, clientId: urlClientId }));
    }
  }, [urlClientId]);

  const clients = trpc.clients.list.useQuery();

  // Extract unique sources from mentions for the filter
  const allMentions = trpc.mentions.list.useQuery({ limit: 50 });
  const sourceOptions = useMemo(() => {
    if (!allMentions.data?.mentions) return [];
    const sources = new Set(allMentions.data.mentions.map((m) => m.article.source));
    return Array.from(sources).map((s) => ({ value: s, label: s }));
  }, [allMentions.data]);

  const mentions = trpc.mentions.list.useQuery({
    clientId: filters.clientId || undefined,
    sentiment: (filters.sentiment || undefined) as "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED" | undefined,
    urgency: (filters.urgency || undefined) as "HIGH" | "MEDIUM" | "LOW" | undefined,
    source: filters.source || undefined,
    dateFrom: filters.startDate ? new Date(filters.startDate) : undefined,
    dateTo: filters.endDate ? new Date(filters.endDate + "T23:59:59") : undefined,
    isLegacy: showLegacy,
    limit: 30,
  });

  const handleExport = () => {
    if (mentions.data?.mentions) {
      exportMentionsToCsv(mentions.data.mentions);
    }
  };

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  const activeFilterCount = [
    filters.clientId,
    filters.sentiment,
    filters.urgency,
    filters.source,
    filters.startDate,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilters({
      clientId: "",
      sentiment: "",
      urgency: "",
      source: "",
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
    if (filters.sentiment) {
      const sentiment = SENTIMENT_OPTIONS.find((s) => s.value === filters.sentiment);
      chips.push({ key: "sentiment", label: "Sentimiento", value: sentiment?.label || filters.sentiment });
    }
    if (filters.urgency) {
      const urgency = URGENCY_OPTIONS.find((u) => u.value === filters.urgency);
      chips.push({ key: "urgency", label: "Urgencia", value: urgency?.label || filters.urgency });
    }
    if (filters.source) {
      chips.push({ key: "source", label: "Fuente", value: filters.source });
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Menciones</h2>
        <button
          onClick={handleExport}
          disabled={!mentions.data?.mentions.length}
          className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {/* Tabs: Recientes / Contexto histórico */}
      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        <button
          onClick={() => setShowLegacy(false)}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            !showLegacy
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          <Clock className="h-4 w-4" />
          Recientes
        </button>
        <button
          onClick={() => setShowLegacy(true)}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            showLegacy
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          <Archive className="h-4 w-4" />
          Historial
        </button>
      </div>

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
          label="Sentimiento"
          value={filters.sentiment}
          options={SENTIMENT_OPTIONS}
          onChange={(v) => setFilters((f) => ({ ...f, sentiment: v }))}
          placeholder="Todos"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <FilterSelect
          label="Urgencia"
          value={filters.urgency}
          options={URGENCY_OPTIONS}
          onChange={(v) => setFilters((f) => ({ ...f, urgency: v }))}
          placeholder="Todas"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <FilterSelect
          label="Fuente"
          value={filters.source}
          options={sourceOptions}
          onChange={(v) => setFilters((f) => ({ ...f, source: v }))}
          placeholder="Todas las fuentes"
          icon={<Globe className="h-4 w-4" />}
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
          <TableSkeleton rows={8} cols={5} />
        )}
        {mentions.data?.mentions.map((mention) => (
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
            publishedAt={mention.article.publishedAt}
            url={mention.article.url}
            summary={mention.aiSummary}
            action={mention.aiAction}
            isLegacy={mention.isLegacy}
          />
        ))}
        {mentions.data?.mentions.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay menciones que coincidan con los filtros.</p>
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
