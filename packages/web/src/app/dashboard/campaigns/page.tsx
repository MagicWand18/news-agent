"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  X as XIcon,
  Loader2,
  AlertTriangle,
  Calendar,
  Newspaper,
  Share2,
  LinkIcon,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  DRAFT: {
    label: "Borrador",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
  ACTIVE: {
    label: "Activa",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  PAUSED: {
    label: "Pausada",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  COMPLETED: {
    label: "Completada",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  CANCELLED: {
    label: "Cancelada",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "ACTIVE", label: "Activa" },
  { value: "PAUSED", label: "Pausada" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

interface FormData {
  name: string;
  clientId: string;
  description: string;
  startDate: string;
  endDate: string;
  crisisAlertId: string;
  tags: string;
}

const INITIAL_FORM: FormData = {
  name: "",
  clientId: "",
  description: "",
  startDate: "",
  endDate: "",
  crisisAlertId: "",
  tags: "",
};

export default function CampaignsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...INITIAL_FORM });
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const utils = trpc.useUtils();
  const campaigns = trpc.campaigns.list.useQuery({
    clientId: clientFilter || undefined,
    status: (statusFilter as "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED") || undefined,
  });
  const clients = trpc.clients.list.useQuery();

  // Crisis activas para vincular
  const crisisAlerts = trpc.crisis.list.useQuery({
    status: "ACTIVE",
    clientId: form.clientId || undefined,
  });

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      closeModal();
    },
  });

  const updateMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      closeModal();
    },
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      setDeletingId(null);
    },
  });

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...INITIAL_FORM });
  }

  function openCreate() {
    setForm({ ...INITIAL_FORM });
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(campaign: {
    id: string;
    name: string;
    clientId: string;
    description: string | null;
    startDate: string | Date | null;
    endDate: string | Date | null;
    crisisAlertId: string | null;
    tags: string[];
  }) {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      clientId: campaign.clientId,
      description: campaign.description || "",
      startDate: campaign.startDate
        ? new Date(campaign.startDate).toISOString().split("T")[0]
        : "",
      endDate: campaign.endDate
        ? new Date(campaign.endDate).toISOString().split("T")[0]
        : "",
      crisisAlertId: campaign.crisisAlertId || "",
      tags: campaign.tags.join(", "),
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        crisisAlertId: form.crisisAlertId || null,
        tags,
      });
    } else {
      createMutation.mutate({
        clientId: form.clientId,
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        crisisAlertId: form.crisisAlertId || undefined,
        tags,
      });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function formatDate(d: string | Date | null) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Campañas
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tracking de campañas de PR con metricas de impacto
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva campaña
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Cliente:
          </label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">Todos los clientes</option>
            {clientOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Estado:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de campañas */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20 overflow-hidden">
        {campaigns.isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        )}

        {campaigns.data && campaigns.data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              No hay campañas creadas.
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Crea una campaña para medir el impacto de tus estrategias de PR.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Crear primera campaña
            </button>
          </div>
        )}

        {campaigns.data && campaigns.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Campaña
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Periodo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Menciones
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {campaigns.data.map((campaign) => {
                  const statusConf =
                    STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
                  const totalMentions =
                    campaign._count.mentions + campaign._count.socialMentions;

                  return (
                    <tr
                      key={campaign.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/campaigns/${campaign.id}`}
                          className="group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
                              <Target className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400">
                                {campaign.name}
                              </span>
                              {campaign.crisisAlert && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                  <span className="text-xs text-red-600 dark:text-red-400">
                                    Vinculada a crisis
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {campaign.client.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            statusConf.color
                          )}
                        >
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {formatDate(campaign.startDate)} -{" "}
                            {formatDate(campaign.endDate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span
                            className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400"
                            title="Menciones de medios"
                          >
                            <Newspaper className="h-3.5 w-3.5" />
                            {campaign._count.mentions}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400"
                            title="Menciones sociales"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            {campaign._count.socialMentions}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(campaign)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            aria-label="Editar campaña"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingId(campaign.id)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            aria-label="Eliminar campaña"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmacion de eliminacion */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Eliminar campaña
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Se eliminaran las notas y vinculos. Las menciones no se borran.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deletingId })}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? "Editar campaña" : "Nueva campaña"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nombre de la campaña
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ej: Defensa caso contratos"
                  required
                  maxLength={200}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Cliente */}
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Cliente
                  </label>
                  <select
                    value={form.clientId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        clientId: e.target.value,
                        crisisAlertId: "",
                      }))
                    }
                    required
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clientOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Descripcion */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Descripcion
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Objetivo y estrategia de la campaña..."
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Vincular a crisis */}
              {form.clientId && crisisAlerts.data?.crises && crisisAlerts.data.crises.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" />
                      Vincular a crisis (opcional)
                    </div>
                  </label>
                  <select
                    value={form.crisisAlertId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        crisisAlertId: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">Sin vincular</option>
                    {crisisAlerts.data.crises.map((ca) => (
                      <option key={ca.id} value={ca.id}>
                        Crisis {ca.severity} - {new Date(ca.createdAt).toLocaleDateString("es-ES")} ({ca.mentionCount} menciones)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tags (separados por coma)
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, tags: e.target.value }))
                  }
                  placeholder="defensa, corrupcion, imagen"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Error */}
              {(createMutation.error || updateMutation.error) && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
                  {createMutation.error?.message ||
                    updateMutation.error?.message}
                </div>
              )}

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Guardar cambios" : "Crear campaña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
