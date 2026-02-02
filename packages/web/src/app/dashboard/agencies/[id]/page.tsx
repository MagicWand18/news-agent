"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Users,
  Briefcase,
  UserPlus,
  ArrowRightLeft,
  Shield,
  Pencil,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  ANALYST: "Analista",
};

/**
 * Página de detalle de una organización.
 * Muestra usuarios y clientes, permite crear usuarios y reasignar clientes.
 */
export default function AgencyDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const orgId = params.id as string;

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

  return <AgencyDetailContent orgId={orgId} />;
}

function AgencyDetailContent({ orgId }: { orgId: string }) {
  const org = trpc.organizations.getById.useQuery({ id: orgId });
  const allOrgs = trpc.organizations.listForSelector.useQuery();
  const createUser = trpc.organizations.createUserInOrg.useMutation({
    onSuccess: () => {
      org.refetch();
      setShowUserForm(false);
      setUserFormData({
        name: "",
        email: "",
        password: "",
        role: "ANALYST",
        isSuperAdmin: false,
      });
    },
  });
  const reassignClient = trpc.organizations.reassignClient.useMutation({
    onSuccess: () => {
      org.refetch();
      setReassigningClient(null);
    },
  });
  const updateOrg = trpc.organizations.update.useMutation({
    onSuccess: () => {
      org.refetch();
      setIsEditing(false);
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMaxClients, setEditMaxClients] = useState("");
  const [showUserForm, setShowUserForm] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "ANALYST" as "ADMIN" | "SUPERVISOR" | "ANALYST",
    isSuperAdmin: false,
  });
  const [reassigningClient, setReassigningClient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [targetOrgId, setTargetOrgId] = useState("");

  if (org.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!org.data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-gray-500 dark:text-gray-400">Organización no encontrada</p>
        <Link
          href="/dashboard/agencies"
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          Volver a agencias
        </Link>
      </div>
    );
  }

  const { users, clients } = org.data;

  const startEditing = () => {
    setEditName(org.data?.name || "");
    setEditMaxClients(org.data?.maxClients !== null && org.data?.maxClients !== undefined ? String(org.data.maxClients) : "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveEditing = () => {
    updateOrg.mutate({
      id: orgId,
      name: editName,
      maxClients: editMaxClients === "" ? null : parseInt(editMaxClients, 10),
    });
  };

  // Calcular si está cerca del límite
  const maxClients = org.data?.maxClients;
  const clientCount = clients.length;
  const isAtLimit = maxClients !== null && maxClients !== undefined && clientCount >= maxClients;
  const isNearLimit = maxClients !== null && maxClients !== undefined && clientCount >= maxClients * 0.8;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/agencies"
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Building2 className="h-6 w-6 text-gray-400" />
            {org.data.name}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {users.length} usuarios · {clients.length} clientes
            {maxClients !== null && maxClients !== undefined && (
              <span className={isAtLimit ? "text-red-500" : isNearLimit ? "text-amber-500" : ""}>
                {" "}(límite: {maxClients})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={startEditing}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>
      </div>

      {/* Edit Form */}
      {isEditing && (
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
            Editar agencia
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre de la agencia
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre de la agencia"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Límite de clientes
              </label>
              <input
                type="number"
                min="0"
                value={editMaxClients}
                onChange={(e) => setEditMaxClients(e.target.value)}
                placeholder="Sin límite"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Dejar vacío para sin límite. Actualmente: {clientCount} clientes.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={cancelEditing}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
            <button
              onClick={saveEditing}
              disabled={updateOrg.isPending || !editName.trim()}
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {updateOrg.isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
          {updateOrg.error && (
            <p className="mt-2 text-sm text-red-600">{updateOrg.error.message}</p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Users className="h-4 w-4" />
            Usuarios
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {users.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Briefcase className="h-4 w-4" />
            Clientes
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {clients.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Shield className="h-4 w-4" />
            Super Admins
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {users.filter((u) => u.isSuperAdmin).length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Briefcase className="h-4 w-4" />
            Menciones totales
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {clients.reduce((sum, c) => sum + c._count.mentions, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Users Section */}
      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Usuarios</h3>
          <button
            onClick={() => setShowUserForm(!showUserForm)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo usuario
          </button>
        </div>

        {/* Create User Form */}
        {showUserForm && (
          <div className="border-b border-gray-200 p-6 dark:border-gray-700">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUser.mutate({
                  orgId,
                  ...userFormData,
                });
              }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <input
                placeholder="Nombre"
                required
                value={userFormData.name}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, name: e.target.value })
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
              <input
                placeholder="Email"
                type="email"
                required
                value={userFormData.email}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, email: e.target.value })
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
              <input
                placeholder="Contraseña"
                type="password"
                required
                minLength={8}
                value={userFormData.password}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, password: e.target.value })
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
              <select
                value={userFormData.role}
                onChange={(e) =>
                  setUserFormData({
                    ...userFormData,
                    role: e.target.value as "ADMIN" | "SUPERVISOR" | "ANALYST",
                  })
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="ANALYST">Analista</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ADMIN">Administrador</option>
              </select>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={userFormData.isSuperAdmin}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      isSuperAdmin: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Super Admin
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createUser.isPending}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {createUser.isPending ? "Creando..." : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
            {createUser.error && (
              <p className="mt-2 text-sm text-red-600">{createUser.error.message}</p>
            )}
          </div>
        )}

        {/* Users Table */}
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="px-6 py-3 font-medium">Nombre</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Rol</th>
              <th className="px-6 py-3 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-gray-200 last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </span>
                    {user.isSuperAdmin && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        Super Admin
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                  {user.email || "-"}
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("es-MX")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="p-6 text-center text-gray-500 dark:text-gray-400">
            No hay usuarios en esta organización.
          </p>
        )}
      </div>

      {/* Clients Section */}
      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Clientes</h3>
        </div>

        {/* Reassign Modal */}
        {reassigningClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Reasignar cliente
              </h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Mover &ldquo;{reassigningClient.name}&rdquo; a otra organización:
              </p>
              <select
                value={targetOrgId}
                onChange={(e) => setTargetOrgId(e.target.value)}
                className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Seleccionar organización...</option>
                {allOrgs.data
                  ?.filter((o) => o.id !== orgId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setReassigningClient(null);
                    setTargetOrgId("");
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  disabled={!targetOrgId || reassignClient.isPending}
                  onClick={() => {
                    reassignClient.mutate({
                      clientId: reassigningClient.id,
                      targetOrgId,
                    });
                  }}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {reassignClient.isPending ? "Moviendo..." : "Mover cliente"}
                </button>
              </div>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="px-6 py-3 font-medium">Cliente</th>
              <th className="px-6 py-3 font-medium">Estado</th>
              <th className="px-6 py-3 font-medium">Menciones</th>
              <th className="px-6 py-3 font-medium">Keywords</th>
              <th className="px-6 py-3 font-medium">Creado</th>
              <th className="px-6 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.id}
                className="border-b border-gray-200 last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
              >
                <td className="px-6 py-4">
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
                  >
                    {client.name}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      client.active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {client.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                  {client._count.mentions.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                  {client._count.keywords}
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                  {new Date(client.createdAt).toLocaleDateString("es-MX")}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setReassigningClient({ id: client.id, name: client.name })}
                    className="flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    title="Reasignar a otra organización"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Reasignar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <p className="p-6 text-center text-gray-500 dark:text-gray-400">
            No hay clientes en esta organización.
          </p>
        )}
      </div>
    </div>
  );
}
