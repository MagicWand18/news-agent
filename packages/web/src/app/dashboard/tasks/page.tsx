"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Plus } from "lucide-react";

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Urgente", color: "bg-red-100 text-red-800" },
  HIGH: { label: "Alta", color: "bg-orange-100 text-orange-800" },
  MEDIUM: { label: "Media", color: "bg-yellow-100 text-yellow-800" },
  LOW: { label: "Baja", color: "bg-green-100 text-green-800" },
};

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tareas</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nueva tarea
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold">Nueva tarea</h3>
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
              className="rounded-lg border px-3 py-2 sm:col-span-2"
            />
            <input
              placeholder="Descripcion (opcional)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="rounded-lg border px-3 py-2 sm:col-span-2"
            />
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: e.target.value as "URGENT" | "HIGH" | "MEDIUM" | "LOW" })
              }
              className="rounded-lg border px-3 py-2"
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
              className="rounded-lg border px-3 py-2"
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

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="COMPLETED">Completada</option>
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2"
        >
          <option value="">Todos los clientes</option>
          {clients.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tasks table */}
      <div className="rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
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
              <tr key={task.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="font-medium">{task.title}</p>
                  {task.mention?.article && (
                    <p className="text-xs text-gray-400">
                      Desde: {task.mention.article.title.slice(0, 50)}...
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {task.client?.name || "-"}
                </td>
                <td className="px-6 py-4 text-gray-500">
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
                  <span className="text-sm">{statusLabels[task.status]}</span>
                </td>
                <td className="px-6 py-4">
                  {task.status === "PENDING" && (
                    <button
                      onClick={() =>
                        updateTask.mutate({ id: task.id, status: "IN_PROGRESS" })
                      }
                      className="text-sm text-brand-600 hover:underline"
                    >
                      Iniciar
                    </button>
                  )}
                  {task.status === "IN_PROGRESS" && (
                    <button
                      onClick={() =>
                        updateTask.mutate({ id: task.id, status: "COMPLETED" })
                      }
                      className="text-sm text-green-600 hover:underline"
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
          <p className="p-6 text-center text-gray-500">No hay tareas.</p>
        )}
      </div>
    </div>
  );
}
