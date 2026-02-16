"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  X as XIcon,
  Loader2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Clock,
  BarChart3,
  Activity,
  AlertCircle,
} from "lucide-react";

const RULE_TYPES = [
  { value: "NEGATIVE_SPIKE", label: "Pico de menciones negativas", icon: AlertTriangle },
  { value: "VOLUME_SURGE", label: "Aumento de volumen", icon: TrendingUp },
  { value: "NO_MENTIONS", label: "Sin menciones", icon: Clock },
  { value: "SOV_DROP", label: "Caida de Share of Voice", icon: TrendingDown },
  { value: "COMPETITOR_SPIKE", label: "Pico de competidor", icon: BarChart3 },
  { value: "SENTIMENT_SHIFT", label: "Cambio de sentimiento", icon: Activity },
] as const;

const CHANNEL_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
];

// Condiciones por defecto segun tipo de regla
const DEFAULT_CONDITIONS: Record<string, Record<string, number>> = {
  NEGATIVE_SPIKE: { threshold: 5, timeWindowHours: 24 },
  VOLUME_SURGE: { percentageIncrease: 50, comparisonDays: 7 },
  NO_MENTIONS: { hours: 48 },
  SOV_DROP: { dropThreshold: 10, days: 7 },
  COMPETITOR_SPIKE: { spikeThreshold: 30, days: 7 },
  SENTIMENT_SHIFT: { shiftThreshold: 15, days: 7 },
};

// Etiquetas de campos de condicion por tipo
const CONDITION_LABELS: Record<string, Record<string, string>> = {
  NEGATIVE_SPIKE: { threshold: "Umbral (cantidad)", timeWindowHours: "Ventana (horas)" },
  VOLUME_SURGE: { percentageIncrease: "Incremento (%)", comparisonDays: "Dias de comparacion" },
  NO_MENTIONS: { hours: "Horas sin menciones" },
  SOV_DROP: { dropThreshold: "Caida minima (%)", days: "Periodo (dias)" },
  COMPETITOR_SPIKE: { spikeThreshold: "Pico minimo (%)", days: "Periodo (dias)" },
  SENTIMENT_SHIFT: { shiftThreshold: "Cambio minimo (pp)", days: "Periodo (dias)" },
};

type RuleType = (typeof RULE_TYPES)[number]["value"];

interface FormData {
  name: string;
  type: RuleType;
  clientId: string;
  condition: Record<string, number>;
  channels: string[];
}

const INITIAL_FORM: FormData = {
  name: "",
  type: "NEGATIVE_SPIKE",
  clientId: "",
  condition: { ...DEFAULT_CONDITIONS.NEGATIVE_SPIKE },
  channels: ["dashboard"],
};

export default function AlertRulesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...INITIAL_FORM });
  const [clientFilter, setClientFilter] = useState<string>("");

  const utils = trpc.useUtils();
  const rules = trpc.alertRules.list.useQuery({
    clientId: clientFilter || undefined,
  });
  const clients = trpc.clients.list.useQuery();

  const createMutation = trpc.alertRules.create.useMutation({
    onSuccess: () => {
      utils.alertRules.list.invalidate();
      closeModal();
    },
  });

  const updateMutation = trpc.alertRules.update.useMutation({
    onSuccess: () => {
      utils.alertRules.list.invalidate();
      closeModal();
    },
  });

  const deleteMutation = trpc.alertRules.delete.useMutation({
    onSuccess: () => {
      utils.alertRules.list.invalidate();
      setDeletingId(null);
    },
  });

  const toggleMutation = trpc.alertRules.toggle.useMutation({
    onSuccess: () => {
      utils.alertRules.list.invalidate();
    },
  });

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  /**
   * Cierra el modal y resetea el formulario.
   */
  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...INITIAL_FORM });
  }

  /**
   * Abre el modal en modo creacion.
   */
  function openCreate() {
    setForm({ ...INITIAL_FORM });
    setEditingId(null);
    setShowModal(true);
  }

  /**
   * Abre el modal en modo edicion con los datos de la regla.
   */
  function openEdit(rule: {
    id: string;
    name: string;
    type: string;
    clientId: string;
    condition: unknown;
    channels: string[];
  }) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      type: rule.type as RuleType,
      clientId: rule.clientId,
      condition: (rule.condition as Record<string, number>) || {},
      channels: rule.channels,
    });
    setShowModal(true);
  }

  /**
   * Maneja el envio del formulario.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: form.name,
        type: form.type,
        condition: form.condition,
        channels: form.channels,
      });
    } else {
      createMutation.mutate({
        clientId: form.clientId,
        name: form.name,
        type: form.type,
        condition: form.condition,
        channels: form.channels,
      });
    }
  }

  /**
   * Cambia el tipo de regla y resetea las condiciones al default.
   */
  function handleTypeChange(type: RuleType) {
    setForm((prev) => ({
      ...prev,
      type,
      condition: { ...DEFAULT_CONDITIONS[type] },
    }));
  }

  /**
   * Alterna un canal en la lista de canales seleccionados.
   */
  function toggleChannel(channel: string) {
    setForm((prev) => {
      const has = prev.channels.includes(channel);
      const next = has
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel];
      // Debe tener al menos un canal
      if (next.length === 0) return prev;
      return { ...prev, channels: next };
    });
  }

  /**
   * Actualiza un campo de condicion.
   */
  function updateCondition(key: string, value: number) {
    setForm((prev) => ({
      ...prev,
      condition: { ...prev.condition, [key]: value },
    }));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  /**
   * Obtiene la informacion visual del tipo de regla.
   */
  function getRuleTypeInfo(type: string) {
    return RULE_TYPES.find((r) => r.value === type) || RULE_TYPES[0];
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reglas de Alerta
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configura reglas automaticas para recibir alertas
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva regla
        </button>
      </div>

      {/* Filtro por cliente */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Cliente:
        </label>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="">Todos los clientes</option>
          {clientOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla de reglas */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20 overflow-hidden">
        {rules.isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        )}

        {rules.isError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="mt-4 text-red-600 dark:text-red-400">
              Error al cargar reglas
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {rules.error?.message}
            </p>
            <button
              onClick={() => rules.refetch()}
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
            >
              Reintentar
            </button>
          </div>
        )}

        {rules.data && rules.data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              No hay reglas de alerta configuradas.
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Crea una regla para recibir notificaciones automaticas.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Crear primera regla
            </button>
          </div>
        )}

        {rules.data && rules.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Canales
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rules.data.map((rule) => {
                  const typeInfo = getRuleTypeInfo(rule.type);
                  const TypeIcon = typeInfo.icon;

                  return (
                    <tr
                      key={rule.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg",
                              rule.active
                                ? "bg-brand-50 dark:bg-brand-900/20"
                                : "bg-gray-100 dark:bg-gray-700"
                            )}
                          >
                            <TypeIcon
                              className={cn(
                                "h-4 w-4",
                                rule.active
                                  ? "text-brand-600 dark:text-brand-400"
                                  : "text-gray-400 dark:text-gray-500"
                              )}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {rule.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {rule.client.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {rule.channels.map((ch) => (
                            <span
                              key={ch}
                              className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleMutation.mutate({ id: rule.id })}
                          disabled={toggleMutation.isPending}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                          style={{
                            backgroundColor: rule.active ? "#2563eb" : "#d1d5db",
                          }}
                          aria-label={
                            rule.active ? "Desactivar regla" : "Activar regla"
                          }
                        >
                          <span
                            className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              rule.active ? "translate-x-6" : "translate-x-1"
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(rule)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            aria-label="Editar regla"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingId(rule.id)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            aria-label="Eliminar regla"
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
                  Eliminar regla
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Esta accion no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deletingId })}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
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
            {/* Header del modal */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? "Editar regla" : "Nueva regla de alerta"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nombre de la regla
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ej: Alerta de negatividad alta"
                  required
                  maxLength={200}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Cliente (solo al crear) */}
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Cliente
                  </label>
                  <select
                    value={form.clientId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, clientId: e.target.value }))
                    }
                    required
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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

              {/* Tipo de regla */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tipo de regla
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RULE_TYPES.map((rt) => {
                    const Icon = rt.icon;
                    const isSelected = form.type === rt.value;
                    return (
                      <button
                        key={rt.value}
                        type="button"
                        onClick={() => handleTypeChange(rt.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                          isSelected
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 dark:border-brand-400"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isSelected
                              ? "text-brand-600 dark:text-brand-400"
                              : "text-gray-400 dark:text-gray-500"
                          )}
                        />
                        <span className="truncate">{rt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Condiciones dinamicas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Condiciones
                </label>
                <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  {Object.entries(
                    CONDITION_LABELS[form.type] || {}
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {label}
                      </label>
                      <input
                        type="number"
                        value={form.condition[key] ?? 0}
                        onChange={(e) =>
                          updateCondition(key, Number(e.target.value))
                        }
                        min={0}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Canales de notificacion */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Canales de notificacion
                </label>
                <div className="flex gap-2">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const isActive = form.channels.includes(ch.value);
                    return (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() => toggleChannel(ch.value)}
                        className={cn(
                          "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 dark:border-brand-400"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                        )}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Selecciona al menos un canal.
                </p>
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
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Guardar cambios" : "Crear regla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
