"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Plus,
  Building2,
  Users,
  Briefcase,
  ChevronRight,
  Pencil,
  Trash2,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

/**
 * Página de gestión de organizaciones (agencias).
 * Solo visible para Super Admin.
 */
export default function AgenciesPage() {
  const { data: session, status } = useSession();

  // Redirigir si no es Super Admin
  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!session?.user?.isSuperAdmin) {
    redirect("/dashboard");
  }

  return <AgenciesContent />;
}

function AgenciesContent() {
  const organizations = trpc.organizations.list.useQuery();
  const globalStats = trpc.organizations.globalStats.useQuery();
  const createOrg = trpc.organizations.create.useMutation({
    onSuccess: () => {
      organizations.refetch();
      setShowForm(false);
      setFormData({ name: "" });
    },
  });
  const deleteOrg = trpc.organizations.delete.useMutation({
    onSuccess: () => {
      organizations.refetch();
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [editingOrg, setEditingOrg] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Agencias</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestiona las organizaciones del sistema
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nueva agencia
        </button>
      </div>

      {/* Stats Cards */}
      {globalStats.data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            icon={Building2}
            label="Agencias"
            value={globalStats.data.organizations}
          />
          <StatCard
            icon={Users}
            label="Usuarios"
            value={globalStats.data.users}
          />
          <StatCard
            icon={Briefcase}
            label="Clientes activos"
            value={globalStats.data.activeClients}
          />
          <StatCard
            icon={BarChart3}
            label="Menciones hoy"
            value={globalStats.data.mentionsToday}
          />
          <StatCard
            icon={BarChart3}
            label="Menciones semana"
            value={globalStats.data.mentionsWeek}
          />
          <StatCard
            icon={BarChart3}
            label="Crisis activas"
            value={globalStats.data.activeCrises}
            highlight={globalStats.data.activeCrises > 0}
          />
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
            Crear nueva agencia
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createOrg.mutate(formData);
            }}
            className="flex gap-4"
          >
            <input
              placeholder="Nombre de la agencia"
              required
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={createOrg.isPending}
              className="rounded-lg bg-brand-600 px-6 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {createOrg.isPending ? "Creando..." : "Crear agencia"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormData({ name: "" });
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editingOrg && (
        <EditOrgModal
          org={editingOrg}
          onClose={() => setEditingOrg(null)}
          onSuccess={() => {
            organizations.refetch();
            setEditingOrg(null);
          }}
        />
      )}

      {/* Organizations List */}
      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="px-6 py-3 font-medium">Agencia</th>
              <th className="px-6 py-3 font-medium">Usuarios</th>
              <th className="px-6 py-3 font-medium">Clientes</th>
              <th className="px-6 py-3 font-medium">Creada</th>
              <th className="px-6 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {organizations.data?.map((org) => (
              <tr
                key={org.id}
                className="border-b border-gray-200 last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
              >
                <td className="px-6 py-4">
                  <Link
                    href={`/dashboard/agencies/${org.id}`}
                    className="flex items-center gap-2 font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
                  >
                    <Building2 className="h-4 w-4 text-gray-400" />
                    {org.name}
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                    <Users className="h-4 w-4 text-gray-400" />
                    {org._count.users}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    {org._count.clients}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                  {new Date(org.createdAt).toLocaleDateString("es-MX", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingOrg({ id: org.id, name: org.name })}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {org._count.users === 0 && org._count.clients === 0 && (
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar la agencia "${org.name}"?`)) {
                            deleteOrg.mutate({ id: org.id });
                          }
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {organizations.data?.length === 0 && (
          <p className="p-6 text-center text-gray-500 dark:text-gray-400">
            No hay agencias registradas.
          </p>
        )}
        {organizations.isLoading && (
          <p className="p-6 text-center text-gray-500 dark:text-gray-400">
            Cargando agencias...
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Tarjeta de estadística
 */
function StatCard({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-red-50 dark:bg-red-900/20" : "bg-white dark:bg-gray-800"} shadow-sm dark:shadow-gray-900/20`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${highlight ? "text-red-500" : "text-gray-400"}`} />
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${highlight ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/**
 * Modal para editar organización
 */
function EditOrgModal({
  org,
  onClose,
  onSuccess,
}: {
  org: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(org.name);
  const updateOrg = trpc.organizations.update.useMutation({
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Editar agencia
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateOrg.mutate({ id: org.id, name });
          }}
          className="space-y-4"
        >
          <input
            placeholder="Nombre de la agencia"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateOrg.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {updateOrg.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
