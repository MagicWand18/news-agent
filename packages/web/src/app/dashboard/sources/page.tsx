"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Rss,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Globe,
  MapPin,
  Building2,
  Briefcase,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  ExternalLink,
  Send,
  FileText,
} from "lucide-react";

type Tab = "sources" | "requests";

const typeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  NATIONAL: { label: "Nacional", icon: <Globe className="h-4 w-4" /> },
  STATE: { label: "Estatal", icon: <MapPin className="h-4 w-4" /> },
  MUNICIPAL: { label: "Municipal", icon: <Building2 className="h-4 w-4" /> },
  SPECIALIZED: { label: "Especializado", icon: <Briefcase className="h-4 w-4" /> },
};

const tierLabels: Record<number, string> = {
  1: "Tier 1 - Nacional",
  2: "Tier 2 - Estatal",
  3: "Tier 3 - Local",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  APPROVED: { label: "Aprobada", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  REJECTED: { label: "Rechazada", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  INTEGRATED: { label: "Integrada", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
};

export default function SourcesPage() {
  const { data: session, status: authStatus } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  const [tab, setTab] = useState<Tab>("sources");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [stateFilter, setStateFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [editingSource, setEditingSource] = useState<{
    id: string;
    name: string;
    url: string;
    tier: number;
    type: string;
    state: string | null;
    city: string | null;
  } | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formTier, setFormTier] = useState(3);
  const [formType, setFormType] = useState("NATIONAL");
  const [formState, setFormState] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Queries
  const sourcesQuery = trpc.sources.list.useQuery({
    search: search || undefined,
    type: (typeFilter as "NATIONAL" | "STATE" | "MUNICIPAL" | "SPECIALIZED") || undefined,
    state: stateFilter || undefined,
    tier: tierFilter ? parseInt(tierFilter) : undefined,
    active: activeFilter === "" ? undefined : activeFilter === "true",
    page,
    limit: 20,
  });

  const statsQuery = trpc.sources.stats.useQuery();
  const statesQuery = trpc.sources.states.useQuery();
  const requestsQuery = trpc.sources.listRequests.useQuery({
    status: (statusFilter as "PENDING" | "APPROVED" | "REJECTED" | "INTEGRATED") || undefined,
    page: requestPage,
    limit: 20,
  });
  const requestStatsQuery = trpc.sources.requestStats.useQuery(undefined, {
    enabled: isAdmin,
  });

  // Mutations
  const createMutation = trpc.sources.create.useMutation({
    onSuccess: () => {
      sourcesQuery.refetch();
      statsQuery.refetch();
      setShowCreateModal(false);
      resetForm();
    },
  });

  const updateMutation = trpc.sources.update.useMutation({
    onSuccess: () => {
      sourcesQuery.refetch();
      setEditingSource(null);
      resetForm();
    },
  });

  const deleteMutation = trpc.sources.delete.useMutation({
    onSuccess: () => {
      sourcesQuery.refetch();
      statsQuery.refetch();
    },
  });

  const toggleMutation = trpc.sources.toggleActive.useMutation({
    onSuccess: () => {
      sourcesQuery.refetch();
      statsQuery.refetch();
    },
  });

  const resetErrorsMutation = trpc.sources.resetErrors.useMutation({
    onSuccess: () => sourcesQuery.refetch(),
  });

  const requestMutation = trpc.sources.requestSource.useMutation({
    onSuccess: () => {
      requestsQuery.refetch();
      setShowRequestModal(false);
      resetForm();
    },
  });

  const approveMutation = trpc.sources.approveRequest.useMutation({
    onSuccess: () => {
      requestsQuery.refetch();
      requestStatsQuery.refetch();
    },
  });

  const rejectMutation = trpc.sources.rejectRequest.useMutation({
    onSuccess: () => {
      requestsQuery.refetch();
      requestStatsQuery.refetch();
    },
  });

  const integrateMutation = trpc.sources.integrateRequest.useMutation({
    onSuccess: () => {
      requestsQuery.refetch();
      requestStatsQuery.refetch();
      sourcesQuery.refetch();
      statsQuery.refetch();
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormTier(3);
    setFormType("NATIONAL");
    setFormState("");
    setFormCity("");
    setFormNotes("");
  };

  const openEditModal = (source: typeof editingSource) => {
    if (!source) return;
    setEditingSource(source);
    setFormName(source.name);
    setFormUrl(source.url);
    setFormTier(source.tier);
    setFormType(source.type);
    setFormState(source.state || "");
    setFormCity(source.city || "");
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formName,
      url: formUrl,
      tier: formTier,
      type: formType as "NATIONAL" | "STATE" | "MUNICIPAL" | "SPECIALIZED",
      state: formState || undefined,
      city: formCity || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingSource) return;
    updateMutation.mutate({
      id: editingSource.id,
      name: formName,
      url: formUrl,
      tier: formTier,
      type: formType as "NATIONAL" | "STATE" | "MUNICIPAL" | "SPECIALIZED",
      state: formState || null,
      city: formCity || null,
    });
  };

  const handleRequest = () => {
    requestMutation.mutate({
      name: formName,
      url: formUrl,
      state: formState || undefined,
      city: formCity || undefined,
      notes: formNotes || undefined,
    });
  };

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Fuentes de Medios</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {statsQuery.data?.total || 0} fuentes configuradas, {statsQuery.data?.active || 0} activas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <Send className="h-4 w-4" />
            Solicitar Fuente
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Nueva Fuente
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsQuery.data?.byType?.NATIONAL || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Nacionales</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsQuery.data?.byType?.STATE || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Estatales</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsQuery.data?.byType?.MUNICIPAL || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Municipales</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Briefcase className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsQuery.data?.byType?.SPECIALIZED || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Especializados</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsQuery.data?.failing || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Con errores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setTab("sources")}
            className={`border-b-2 pb-3 text-sm font-medium ${
              tab === "sources"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <Rss className="mr-2 inline h-4 w-4" />
            Fuentes RSS
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`border-b-2 pb-3 text-sm font-medium ${
              tab === "requests"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <FileText className="mr-2 inline h-4 w-4" />
            Solicitudes
            {isAdmin && requestStatsQuery.data?.PENDING && (
              <span className="ml-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-800 dark:text-yellow-400">
                {requestStatsQuery.data.PENDING}
              </span>
            )}
          </button>
        </nav>
      </div>

      {tab === "sources" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar fuentes..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">Todos los tipos</option>
              <option value="NATIONAL">Nacional</option>
              <option value="STATE">Estatal</option>
              <option value="MUNICIPAL">Municipal</option>
              <option value="SPECIALIZED">Especializado</option>
            </select>
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">Todos los estados</option>
              {statesQuery.data?.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">Todos los tiers</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>

          {/* Sources Table */}
          <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Fuente</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Estatus</th>
                  <th className="px-4 py-3">Ultimo Fetch</th>
                  {isAdmin && <th className="px-4 py-3">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sourcesQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                    </td>
                  </tr>
                ) : sourcesQuery.data?.sources.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No se encontraron fuentes
                    </td>
                  </tr>
                ) : (
                  sourcesQuery.data?.sources.map((source) => (
                    <tr key={source.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Rss className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{source.name}</p>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600"
                            >
                              {source.url.slice(0, 50)}...
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-300">
                          {typeLabels[source.type]?.icon}
                          {typeLabels[source.type]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {source.type === "NATIONAL"
                          ? "Nacional"
                          : source.city && source.state
                            ? `${source.city}, ${source.state}`
                            : source.state || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 dark:bg-gray-600 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-200">
                          Tier {source.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {source.active ? (
                          source.errorCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-xs">{source.errorCount} errores</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Activo</span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs">Inactivo</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {source.lastFetch ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(source.lastFetch).toLocaleDateString("es-MX", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                openEditModal({
                                  id: source.id,
                                  name: source.name,
                                  url: source.url,
                                  tier: source.tier,
                                  type: source.type,
                                  state: source.state,
                                  city: source.city,
                                })
                              }
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toggleMutation.mutate({ id: source.id })}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200"
                              title={source.active ? "Desactivar" : "Activar"}
                            >
                              {source.active ? (
                                <ToggleRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </button>
                            {source.errorCount > 0 && (
                              <button
                                onClick={() => resetErrorsMutation.mutate({ id: source.id })}
                                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-yellow-600 dark:hover:text-yellow-400"
                                title="Resetear errores"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm("Eliminar esta fuente?")) {
                                  deleteMutation.mutate({ id: source.id });
                                }
                              }}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {sourcesQuery.data && sourcesQuery.data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Mostrando {(page - 1) * 20 + 1} - {Math.min(page * 20, sourcesQuery.data.total)} de{" "}
                  {sourcesQuery.data.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-200">
                    {page} / {sourcesQuery.data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(sourcesQuery.data!.totalPages, p + 1))}
                    disabled={page === sourcesQuery.data.totalPages}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "requests" && (
        <>
          {/* Request Filters */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setRequestPage(1);
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">Todos los estatus</option>
              <option value="PENDING">Pendientes</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="REJECTED">Rechazadas</option>
              <option value="INTEGRATED">Integradas</option>
            </select>
          </div>

          {/* Requests Table */}
          <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Fuente Solicitada</th>
                  <th className="px-4 py-3">Ubicacion</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                  {isAdmin && <th className="px-4 py-3">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {requestsQuery.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                    </td>
                  </tr>
                ) : requestsQuery.data?.requests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay solicitudes
                    </td>
                  </tr>
                ) : (
                  requestsQuery.data?.requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{request.name}</p>
                          <a
                            href={request.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600"
                          >
                            {request.url.slice(0, 50)}...
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {request.notes && (
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{request.notes}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {request.city && request.state
                          ? `${request.city}, ${request.state}`
                          : request.state || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            statusLabels[request.status]?.color
                          }`}
                        >
                          {statusLabels[request.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(request.createdAt).toLocaleDateString("es-MX")}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {request.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => approveMutation.mutate({ id: request.id })}
                                  className="rounded bg-green-100 dark:bg-green-900/30 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                                >
                                  Aprobar
                                </button>
                                <button
                                  onClick={() => {
                                    const notes = prompt("Razón del rechazo (opcional):");
                                    rejectMutation.mutate({ id: request.id, notes: notes || undefined });
                                  }}
                                  className="rounded bg-red-100 dark:bg-red-900/30 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}
                            {request.status === "APPROVED" && (
                              <button
                                onClick={() => integrateMutation.mutate({ id: request.id })}
                                className="rounded bg-blue-100 dark:bg-blue-900/30 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                              >
                                Integrar
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {requestsQuery.data && requestsQuery.data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Página {requestPage} de {requestsQuery.data.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRequestPage((p) => Math.max(1, p - 1))}
                    disabled={requestPage === 1}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      setRequestPage((p) => Math.min(requestsQuery.data!.totalPages, p + 1))
                    }
                    disabled={requestPage === requestsQuery.data.totalPages}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSource) && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingSource ? "Editar Fuente" : "Nueva Fuente"}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="El Universal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL del Feed RSS</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="https://ejemplo.com/feed"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="NATIONAL">Nacional</option>
                    <option value="STATE">Estatal</option>
                    <option value="MUNICIPAL">Municipal</option>
                    <option value="SPECIALIZED">Especializado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tier</label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(parseInt(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  >
                    <option value={1}>Tier 1 - Nacional</option>
                    <option value={2}>Tier 2 - Estatal</option>
                    <option value={3}>Tier 3 - Local</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado (geo)</label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Jalisco"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ciudad</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Guadalajara"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingSource(null);
                  resetForm();
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={editingSource ? handleUpdate : handleCreate}
                disabled={createMutation.isPending || updateMutation.isPending || !formName || !formUrl}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Guardando..."
                  : editingSource
                  ? "Guardar Cambios"
                  : "Crear Fuente"}
              </button>
            </div>
            {(createMutation.isError || updateMutation.isError) && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {createMutation.error?.message || updateMutation.error?.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Solicitar Nueva Fuente</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sugiere un medio para agregar al sistema. Un administrador revisará tu solicitud.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Medio</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="Diario de Monterrey"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL del Feed RSS</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="https://ejemplo.com/feed"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado (geo)</label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Nuevo León"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ciudad</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Monterrey"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas (opcional)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  rows={2}
                  placeholder="Información adicional sobre el medio..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  resetForm();
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleRequest}
                disabled={requestMutation.isPending || !formName || !formUrl}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {requestMutation.isPending ? "Enviando..." : "Enviar Solicitud"}
              </button>
            </div>
            {requestMutation.isError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{requestMutation.error?.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
