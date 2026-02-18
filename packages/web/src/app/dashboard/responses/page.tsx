"use client";

import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  AlertCircle,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Send,
  Newspaper,
  Share2,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/filters";
import { TableSkeleton } from "@/components/skeletons";

const STATUS_TABS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "IN_REVIEW", label: "En revision" },
  { value: "APPROVED", label: "Aprobados" },
  { value: "PUBLISHED", label: "Publicados" },
  { value: "DISCARDED", label: "Descartados" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300", icon: FileText },
  IN_REVIEW: { label: "En revision", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Eye },
  APPROVED: { label: "Aprobado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  PUBLISHED: { label: "Publicado", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Send },
  DISCARDED: { label: "Descartado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

export default function ResponsesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const clients = trpc.clients.list.useQuery();
  const responses = trpc.responses.list.useQuery({
    status: (statusFilter || undefined) as "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "DISCARDED" | undefined,
    clientId: clientFilter || undefined,
    limit: 50,
  });

  const updateStatusMutation = trpc.responses.updateStatus.useMutation({
    onSuccess: () => responses.refetch(),
  });

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  // Contadores por estado
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { DRAFT: 0, IN_REVIEW: 0, APPROVED: 0, PUBLISHED: 0, DISCARDED: 0 };
    if (responses.data?.drafts) {
      for (const d of responses.data.drafts) {
        counts[d.status] = (counts[d.status] || 0) + 1;
      }
    }
    return counts;
  }, [responses.data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Respuestas</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestiona borradores de comunicados de prensa
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                statusFilter === key
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-400"
                  : "border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{config.label}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {statusCounts[key] || 0}
              </p>
            </button>
          );
        })}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
              statusFilter === tab.value
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Client Filter */}
      <FilterBar activeCount={clientFilter ? 1 : 0} onClear={() => setClientFilter("")}>
        <FilterSelect
          label="Cliente"
          value={clientFilter}
          options={clientOptions}
          onChange={setClientFilter}
          placeholder="Todos los clientes"
          icon={<Users className="h-4 w-4" />}
        />
      </FilterBar>

      {/* Responses List */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20">
        {responses.isLoading && (
          <TableSkeleton rows={6} cols={4} />
        )}

        {responses.isError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="mt-4 text-red-600 dark:text-red-400">Error al cargar respuestas</p>
            <p className="mt-1 text-sm text-gray-500">{responses.error?.message}</p>
            <button onClick={() => responses.refetch()} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
              Reintentar
            </button>
          </div>
        )}

        {responses.data?.drafts.map((draft) => {
          const statusInfo = STATUS_CONFIG[draft.status] || STATUS_CONFIG.DRAFT;
          const StatusIcon = statusInfo.icon;
          const isExpanded = expandedId === draft.id;
          const clientName = draft.mention?.client?.name || draft.socialMention?.client?.name || "-";
          const source = draft.mention
            ? draft.mention.article.source
            : draft.socialMention
              ? `@${draft.socialMention.authorHandle}`
              : "-";

          return (
            <div
              key={draft.id}
              className="border-b last:border-0 dark:border-gray-700"
            >
              {/* Row */}
              <div
                className="flex cursor-pointer items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => setExpandedId(isExpanded ? null : draft.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{draft.title}</p>
                    {draft.mention && (
                      <span className="inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                        <Newspaper className="h-3 w-3" />
                        Mencion
                      </span>
                    )}
                    {draft.socialMention && (
                      <span className="inline-flex items-center gap-1 rounded bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">
                        <Share2 className="h-3 w-3" />
                        Red social
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{source}</span>
                    <span>{clientName}</span>
                    <span>
                      {new Date(draft.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {draft.createdBy && <span>por {draft.createdBy.name}</span>}
                  </div>
                </div>

                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", statusInfo.color)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusInfo.label}
                </span>

                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-6 py-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Cuerpo</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">
                      {draft.body}
                    </p>
                  </div>

                  {draft.keyMessages && (draft.keyMessages as string[]).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Mensajes clave</p>
                      <ul className="mt-1 space-y-1">
                        {(draft.keyMessages as string[]).map((msg, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                            {msg}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Linked mention/social mention */}
                  {draft.mention && (
                    <Link
                      href={`/dashboard/mentions/${draft.mention.id}`}
                      className="inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <Newspaper className="h-3.5 w-3.5" />
                      Ver mencion original: {draft.mention.article.title.slice(0, 60)}...
                    </Link>
                  )}
                  {draft.socialMention && (
                    <Link
                      href={`/dashboard/social-mentions/${draft.socialMention.id}`}
                      className="inline-flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Ver mencion social: @{draft.socialMention.authorHandle}
                    </Link>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {draft.status === "DRAFT" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatusMutation.mutate({ id: draft.id, status: "IN_REVIEW" });
                        }}
                        disabled={updateStatusMutation.isPending}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Enviar a revision
                      </button>
                    )}
                    {draft.status === "IN_REVIEW" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatusMutation.mutate({ id: draft.id, status: "APPROVED" });
                        }}
                        disabled={updateStatusMutation.isPending}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                    )}
                    {draft.status === "APPROVED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatusMutation.mutate({ id: draft.id, status: "PUBLISHED" });
                        }}
                        disabled={updateStatusMutation.isPending}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        Marcar publicado
                      </button>
                    )}
                    {(draft.status === "DRAFT" || draft.status === "IN_REVIEW" || draft.status === "APPROVED") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatusMutation.mutate({ id: draft.id, status: "DISCARDED" });
                        }}
                        disabled={updateStatusMutation.isPending}
                        className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                      >
                        Descartar
                      </button>
                    )}
                    {draft.status === "DISCARDED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatusMutation.mutate({ id: draft.id, status: "DRAFT" });
                        }}
                        disabled={updateStatusMutation.isPending}
                        className="rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                      >
                        Restaurar como borrador
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!responses.isError && responses.data?.drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">No hay respuestas.</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Genera comunicados desde el detalle de una mencion.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
