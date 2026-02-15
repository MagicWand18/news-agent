"use client";

import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import { Plus, ListFilter, Users, AlertTriangle, Newspaper, Share2 } from "lucide-react";
import { FilterBar, FilterSelect, FilterChips } from "@/components/filters";
import Link from "next/link";

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Urgente", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  HIGH: { label: "Alta", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  MEDIUM: { label: "Media", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  LOW: { label: "Baja", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

const PRIORITY_OPTIONS = [
  { value: "URGENT", label: "Urgente" },
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Media" },
  { value: "LOW", label: "Baja" },
];

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as "URGENT" | "HIGH" | "MEDIUM" | "LOW",
    clientId: "",
  });

  const clients = trpc.clients.list.useQuery();
  const tasks = trpc.tasks.list.useQuery({
    status: (statusFilter || undefined) as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined,
    clientId: clientFilter || undefined,
    priority: (priorityFilter || undefined) as "URGENT" | "HIGH" | "MEDIUM" | "LOW" | undefined,
  });
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      tasks.refetch();
      setShowForm(false);
      setFormData({ title: "", description: "", priority: "MEDIUM", clientId: "" });
    },
  });
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => tasks.refetch(),
  });

  // Opciones de clientes para el filtro
  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  // Conteo de filtros activos
  const activeFilterCount = [statusFilter, clientFilter, priorityFilter].filter(Boolean).length;

  // Chips de filtros activos
  const filterChips = useMemo(() => {
    const chips = [];
    if (statusFilter) {
      const label = STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label || statusFilter;
      chips.push({ key: "status", label: "Estado", value: label });
    }
    if (priorityFilter) {
      const label = PRIORITY_OPTIONS.find((p) => p.value === priorityFilter)?.label || priorityFilter;
      chips.push({ key: "priority", label: "Prioridad", value: label });
    }
    if (clientFilter) {
      const label = clientOptions.find((c) => c.value === clientFilter)?.label || clientFilter;
      chips.push({ key: "client", label: "Cliente", value: label });
    }
    return chips;
  }, [statusFilter, priorityFilter, clientFilter, clientOptions]);

  const handleClearFilters = () => {
    setStatusFilter("");
    setPriorityFilter("");
    setClientFilter("");
  };

  const handleRemoveChip = (key: string) => {
    if (key === "status") setStatusFilter("");
    if (key === "priority") setPriorityFilter("");
    if (key === "client") setClientFilter("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tareas</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nueva tarea
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Nueva tarea</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTask.mutate({
                ...formData,
                clientId: formData.clientId || undefined,
              });
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <input
              placeholder="Titulo"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="rounded-lg border px-3 py-2 sm:col-span-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <input
              placeholder="Descripcion (opcional)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="rounded-lg border px-3 py-2 sm:col-span-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: e.target.value as "URGENT" | "HIGH" | "MEDIUM" | "LOW" })
              }
              className="rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="URGENT">Urgente</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Baja</option>
            </select>
            <select
              value={formData.clientId}
              onChange={(e) =>
                setFormData({ ...formData, clientId: e.target.value })
              }
              className="rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Sin cliente</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={createTask.isPending}
              className="rounded-lg bg-brand-600 px-6 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Crear tarea
            </button>
          </form>
        </div>
      )}

      {/* Filtros modernos */}
      <FilterBar activeCount={activeFilterCount} onClear={handleClearFilters}>
        <FilterSelect
          label="Estado"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={setStatusFilter}
          placeholder="Todos"
          icon={<ListFilter className="h-4 w-4" />}
        />
        <FilterSelect
          label="Prioridad"
          value={priorityFilter}
          options={PRIORITY_OPTIONS}
          onChange={setPriorityFilter}
          placeholder="Todas"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <FilterSelect
          label="Cliente"
          value={clientFilter}
          options={clientOptions}
          onChange={setClientFilter}
          placeholder="Todos"
          icon={<Users className="h-4 w-4" />}
        />
      </FilterBar>

      {/* Chips de filtros activos */}
      <FilterChips chips={filterChips} onRemove={handleRemoveChip} />

      {/* Tasks table */}
      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="px-6 py-3 font-medium">Tarea</th>
              <th className="px-6 py-3 font-medium">Cliente</th>
              <th className="px-6 py-3 font-medium">Asignado</th>
              <th className="px-6 py-3 font-medium">Prioridad</th>
              <th className="px-6 py-3 font-medium">Estado</th>
              <th className="px-6 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tasks.data?.map((task) => (
              <tr key={task.id} className="border-b last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                  {task.mention?.article && (
                    <Link
                      href={`/dashboard/mentions/${(task as Record<string, unknown>).mentionId as string}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <Newspaper className="h-3 w-3" />
                      <span className="rounded bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">De mencion</span>
                      {task.mention.article.title.slice(0, 50)}...
                    </Link>
                  )}
                  {task.socialMention && (
                    <Link
                      href={`/dashboard/social-mentions/${(task as Record<string, unknown>).socialMentionId as string}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <Share2 className="h-3 w-3" />
                      <span className="rounded bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">De red social</span>
                      @{task.socialMention.authorHandle}
                    </Link>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                  {task.client?.name || "-"}
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                  {task.assignee?.name || "Sin asignar"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-medium",
                      priorityConfig[task.priority]?.color
                    )}
                  >
                    {priorityConfig[task.priority]?.label}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{statusLabels[task.status]}</span>
                </td>
                <td className="px-6 py-4">
                  {task.status === "PENDING" && (
                    <button
                      onClick={() =>
                        updateTask.mutate({ id: task.id, status: "IN_PROGRESS" })
                      }
                      className="text-sm text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Iniciar
                    </button>
                  )}
                  {task.status === "IN_PROGRESS" && (
                    <button
                      onClick={() =>
                        updateTask.mutate({ id: task.id, status: "COMPLETED" })
                      }
                      className="text-sm text-green-600 hover:underline dark:text-green-400"
                    >
                      Completar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.data?.length === 0 && (
          <p className="p-6 text-center text-gray-500 dark:text-gray-400">No hay tareas.</p>
        )}
      </div>
    </div>
  );
}
