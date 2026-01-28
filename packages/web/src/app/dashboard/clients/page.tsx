"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

export default function ClientsPage() {
  const clients = trpc.clients.list.useQuery();
  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => {
      clients.refetch();
      setShowForm(false);
      setFormData({ name: "", description: "", industry: "" });
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    industry: "",
  });

  const filtered = clients.data?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold">Agregar cliente</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createClient.mutate(formData);
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <input
              placeholder="Nombre"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Descripcion"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Industria"
              value={formData.industry}
              onChange={(e) =>
                setFormData({ ...formData, industry: e.target.value })
              }
              className="rounded-lg border px-3 py-2"
            />
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={createClient.isPending}
                className="rounded-lg bg-brand-600 px-6 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createClient.isPending ? "Creando..." : "Crear cliente"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-white py-2 pl-10 pr-4"
        />
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500">
              <th className="px-6 py-3 font-medium">Nombre</th>
              <th className="px-6 py-3 font-medium">Industria</th>
              <th className="px-6 py-3 font-medium">Keywords</th>
              <th className="px-6 py-3 font-medium">Menciones</th>
              <th className="px-6 py-3 font-medium">Tareas</th>
              <th className="px-6 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((client) => (
              <tr key={client.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {client.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-gray-500">{client.industry || "-"}</td>
                <td className="px-6 py-4">{client._count.keywords}</td>
                <td className="px-6 py-4">{client._count.mentions}</td>
                <td className="px-6 py-4">{client._count.tasks}</td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      client.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {client.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered?.length === 0 && (
          <p className="p-6 text-center text-gray-500">
            No se encontraron clientes.
          </p>
        )}
      </div>
    </div>
  );
}
