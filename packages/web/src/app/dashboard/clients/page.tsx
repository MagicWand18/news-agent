"use client";

import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Building2, CheckCircle } from "lucide-react";
import { FilterBar, FilterSelect, FilterChips } from "@/components/filters";

const STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
];

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
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    industry: "",
  });

  // Extract unique industries from clients
  const industryOptions = useMemo(() => {
    if (!clients.data) return [];
    const industries = new Set(
      clients.data.map((c) => c.industry).filter((i): i is string => Boolean(i))
    );
    return Array.from(industries).map((i) => ({ value: i, label: i }));
  }, [clients.data]);

  const filtered = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.filter((c) => {
      // Search filter
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Industry filter
      if (industry && c.industry !== industry) {
        return false;
      }
      // Status filter
      if (status === "active" && !c.active) {
        return false;
      }
      if (status === "inactive" && c.active) {
        return false;
      }
      return true;
    });
  }, [clients.data, search, industry, status]);

  const activeFilterCount = [search, industry, status].filter(Boolean).length;

  const handleClearFilters = () => {
    setSearch("");
    setIndustry("");
    setStatus("");
  };

  const filterChips = useMemo(() => {
    const chips = [];
    if (search) {
      chips.push({ key: "search", label: "Busqueda", value: search });
    }
    if (industry) {
      chips.push({ key: "industry", label: "Industria", value: industry });
    }
    if (status) {
      const statusLabel = STATUS_OPTIONS.find((s) => s.value === status);
      chips.push({ key: "status", label: "Estado", value: statusLabel?.label || status });
    }
    return chips;
  }, [search, industry, status]);

  const handleRemoveChip = (key: string) => {
    if (key === "search") setSearch("");
    if (key === "industry") setIndustry("");
    if (key === "status") setStatus("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clientes</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Agregar cliente</h3>
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
              className="rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <input
              placeholder="Descripcion"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <input
              placeholder="Industria"
              value={formData.industry}
              onChange={(e) =>
                setFormData({ ...formData, industry: e.target.value })
              }
              className="rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
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

      {/* Filtros */}
      <FilterBar activeCount={activeFilterCount} onClear={handleClearFilters}>
        <div className="relative flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm transition-colors hover:border-gray-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 dark:hover:border-gray-500"
            />
          </div>
        </div>
        <FilterSelect
          label="Industria"
          value={industry}
          options={industryOptions}
          onChange={setIndustry}
          placeholder="Todas"
          icon={<Building2 className="h-4 w-4" />}
        />
        <FilterSelect
          label="Estado"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
          placeholder="Todos"
          icon={<CheckCircle className="h-4 w-4" />}
        />
      </FilterBar>

      {/* Chips de filtros activos */}
      <FilterChips chips={filterChips} onRemove={handleRemoveChip} />

      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
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
              <tr key={client.id} className="border-b last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4">
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {client.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{client.industry || "-"}</td>
                <td className="px-6 py-4 dark:text-gray-300">{client._count.keywords}</td>
                <td className="px-6 py-4 dark:text-gray-300">{client._count.mentions}</td>
                <td className="px-6 py-4 dark:text-gray-300">{client._count.tasks}</td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      client.active
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
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
          <p className="p-6 text-center text-gray-500 dark:text-gray-400">
            No se encontraron clientes.
          </p>
        )}
      </div>
    </div>
  );
}
