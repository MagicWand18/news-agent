"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus } from "lucide-react";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  ANALYST: "Analista",
};

export default function TeamPage() {
  const team = trpc.team.list.useQuery();
  const createUser = trpc.team.create.useMutation({
    onSuccess: () => {
      team.refetch();
      setShowForm(false);
      setFormData({ name: "", email: "", password: "", role: "ANALYST", telegramUserId: "" });
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "ANALYST" as "ADMIN" | "SUPERVISOR" | "ANALYST",
    telegramUserId: "",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Equipo</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo miembro
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold">Agregar miembro</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createUser.mutate({
                ...formData,
                telegramUserId: formData.telegramUserId || undefined,
              });
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <input
              placeholder="Nombre"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Contrasena"
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="rounded-lg border px-3 py-2"
            />
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as "ADMIN" | "SUPERVISOR" | "ANALYST" })
              }
              className="rounded-lg border px-3 py-2"
            >
              <option value="ANALYST">Analista</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <input
              placeholder="Telegram User ID (opcional)"
              value={formData.telegramUserId}
              onChange={(e) =>
                setFormData({ ...formData, telegramUserId: e.target.value })
              }
              className="rounded-lg border px-3 py-2"
            />
            <button
              type="submit"
              disabled={createUser.isPending}
              className="rounded-lg bg-brand-600 px-6 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {createUser.isPending ? "Creando..." : "Agregar miembro"}
            </button>
          </form>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-6 py-3 font-medium">Nombre</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Rol</th>
              <th className="px-6 py-3 font-medium">Telegram</th>
              <th className="px-6 py-3 font-medium">Tareas activas</th>
            </tr>
          </thead>
          <tbody>
            {team.data?.map((user) => (
              <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{user.name}</td>
                <td className="px-6 py-4 text-gray-500">{user.email || "-"}</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {user.telegramUserId ? "Vinculado" : "No vinculado"}
                </td>
                <td className="px-6 py-4">{user._count.assignedTasks}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {team.data?.length === 0 && (
          <p className="p-6 text-center text-gray-500">
            No hay miembros en el equipo.
          </p>
        )}
      </div>
    </div>
  );
}
