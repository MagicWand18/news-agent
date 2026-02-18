"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { useState, useMemo } from "react";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Zap,
  Lightbulb,
  Users,
  ChevronDown,
  Loader2,
  BarChart3,
  MessageSquare,
  Share2,
} from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/filters";
import { CardGridSkeleton } from "@/components/skeletons";
import { ExportButton } from "@/components/export-button";

interface BriefContent {
  highlights: string[];
  comparison: {
    mentionsDelta: number;
    sentimentShift: string;
    sovChange: string;
  };
  watchList: string[];
  emergingTopics: string[];
  pendingActions: string[];
}

interface BriefStats {
  mentions: number;
  sentiment: { positive: number; negative: number; neutral: number; mixed: number };
  sov: number;
  socialPosts: number;
  engagement: number;
}

export default function BriefsPage() {
  const [clientId, setClientId] = useState<string>("");

  const clients = trpc.clients.list.useQuery();
  const briefs = trpc.briefs.list.useInfiniteQuery(
    { clientId: clientId || undefined, limit: 10 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  const allBriefs = briefs.data?.pages.flatMap((p) => p.briefs) ?? [];
  const latestBrief = allBriefs[0];
  const olderBriefs = allBriefs.slice(1);

  const activeFilterCount = clientId ? 1 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          <FileText className="mr-2 inline-block h-7 w-7 text-brand-600" />
          AI Media Brief
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Briefings diarios generados por IA con insights accionables
        </p>
      </div>

      {/* Filtros */}
      <FilterBar activeCount={activeFilterCount} onClear={() => setClientId("")}>
        <FilterSelect
          label="Cliente"
          value={clientId}
          options={clientOptions}
          onChange={setClientId}
          placeholder="Todos los clientes"
          icon={<Users className="h-4 w-4" />}
        />
      </FilterBar>

      {/* Brief mas reciente destacado */}
      {briefs.isLoading ? (
        <LoadingSpinner />
      ) : latestBrief ? (
        <>
          <LatestBriefCard brief={latestBrief} />

          {/* Timeline de briefs anteriores */}
          {olderBriefs.length > 0 && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Briefs anteriores
              </h3>
              <div className="space-y-3">
                {olderBriefs.map((brief) => (
                  <CollapsibleBriefCard key={brief.id} brief={brief} />
                ))}
              </div>
            </div>
          )}

          {/* Cargar mas */}
          {briefs.hasNextPage && (
            <button
              onClick={() => briefs.fetchNextPage()}
              disabled={briefs.isFetchingNextPage}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
            >
              {briefs.isFetchingNextPage ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </span>
              ) : (
                "Cargar mas briefs"
              )}
            </button>
          )}
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function LatestBriefCard({ brief }: { brief: { id: string; date: string | Date; content: unknown; stats: unknown; client: { id: string; name: string } } }) {
  const content = brief.content as BriefContent;
  const stats = brief.stats as BriefStats;
  const date = new Date(brief.date);

  const deltaSign = (content.comparison?.mentionsDelta ?? 0) > 0 ? "+" : "";
  const deltaColor = (content.comparison?.mentionsDelta ?? 0) > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : (content.comparison?.mentionsDelta ?? 0) < 0
      ? "text-red-600 dark:text-red-400"
      : "text-gray-500";

  return (
    <div className="rounded-xl border-2 border-brand-200 dark:border-brand-800 bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20 overflow-hidden">
      {/* Header */}
      <div className="bg-brand-50 dark:bg-brand-900/20 px-6 py-4 border-b border-brand-100 dark:border-brand-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/40">
              <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Brief de hoy — {brief.client.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton type="brief" referenceId={brief.id} />
            <span className="rounded-full bg-brand-100 dark:bg-brand-900/40 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
              Ultimo brief
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats mini */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBadge
            icon={<BarChart3 className="h-4 w-4" />}
            label="Menciones"
            value={String(stats.mentions ?? 0)}
            delta={content.comparison?.mentionsDelta}
          />
          <StatBadge
            icon={<TrendingUp className="h-4 w-4" />}
            label="SOV"
            value={`${(stats.sov ?? 0).toFixed(1)}%`}
          />
          <StatBadge
            icon={<Share2 className="h-4 w-4" />}
            label="Posts sociales"
            value={String(stats.socialPosts ?? 0)}
          />
          <StatBadge
            icon={<MessageSquare className="h-4 w-4" />}
            label="Engagement"
            value={formatNumber(stats.engagement ?? 0)}
          />
        </div>

        {/* Comparativa */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">vs. dia anterior</h4>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className={cn("flex items-center gap-1", deltaColor)}>
              {(content.comparison?.mentionsDelta ?? 0) > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (content.comparison?.mentionsDelta ?? 0) < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              {deltaSign}{content.comparison?.mentionsDelta ?? 0} menciones
            </span>
            <span className="text-gray-600 dark:text-gray-300">
              Sentimiento: {content.comparison?.sentimentShift || "estable"}
            </span>
            <span className="text-gray-600 dark:text-gray-300">
              SOV: {content.comparison?.sovChange || "sin cambios"}
            </span>
          </div>
        </div>

        {/* Highlights */}
        {content.highlights?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Puntos clave
            </h4>
            <ul className="space-y-2">
              {content.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Watch List */}
        {content.watchList?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              Que vigilar hoy
            </h4>
            <ul className="space-y-2">
              {content.watchList.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Eye className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Emerging Topics + Pending Actions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {content.emergingTopics?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Temas emergentes
              </h4>
              <div className="flex flex-wrap gap-2">
                {content.emergingTopics.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {content.pendingActions?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                Acciones sugeridas
              </h4>
              <ul className="space-y-1">
                {content.pendingActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CollapsibleBriefCard({ brief }: { brief: { id: string; date: string | Date; content: unknown; stats: unknown; client: { id: string; name: string } } }) {
  const [expanded, setExpanded] = useState(false);
  const content = brief.content as BriefContent;
  const stats = brief.stats as BriefStats;
  const date = new Date(brief.date);

  const deltaSign = (content.comparison?.mentionsDelta ?? 0) > 0 ? "+" : "";

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20 overflow-hidden">
      {/* Header clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
            <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">{brief.client.name}</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {stats.mentions ?? 0} menciones ({deltaSign}{content.comparison?.mentionsDelta ?? 0})
          </span>
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {/* Highlights */}
          {content.highlights?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Puntos clave</h4>
              <ul className="space-y-1.5">
                {content.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Watch + Actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {content.watchList?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Que vigilar</h4>
                <ul className="space-y-1">
                  {content.watchList.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Eye className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {content.pendingActions?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Acciones</h4>
                <ul className="space-y-1">
                  {content.pendingActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span>SOV: {(stats.sov ?? 0).toFixed(1)}%</span>
            <span>Social: {stats.socialPosts ?? 0} posts</span>
            <span>Engagement: {formatNumber(stats.engagement ?? 0)}</span>
            <span>Sentimiento: {content.comparison?.sentimentShift || "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number;
}) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-bold text-gray-900 dark:text-white">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={cn("text-xs font-medium", delta > 0 ? "text-emerald-600" : "text-red-600")}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function LoadingSpinner() {
  return <CardGridSkeleton count={3} />;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
        <FileText className="h-7 w-7 text-brand-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sin briefs disponibles</h3>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Los briefs se generan automaticamente cada dia con el digest. Apareceran aqui cuando se ejecute el proximo ciclo.
      </p>
    </div>
  );
}
