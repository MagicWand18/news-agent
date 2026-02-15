"use client";

import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  AlertTriangle,
  Shield,
  Eye,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
} from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/filters";

const STATUS_TABS = [
  { value: "", label: "Todas" },
  { value: "ACTIVE", label: "Activas" },
  { value: "MONITORING", label: "Monitoreo" },
  { value: "RESOLVED", label: "Resueltas" },
  { value: "DISMISSED", label: "Descartadas" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  ACTIVE: { label: "Activa", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  MONITORING: { label: "Monitoreo", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Eye },
  RESOLVED: { label: "Resuelta", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  DISMISSED: { label: "Descartada", color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400", icon: XCircle },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Critica", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" },
  HIGH: { label: "Alta", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800" },
  MEDIUM: { label: "Media", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800" },
};

const SEVERITY_OPTIONS = [
  { value: "CRITICAL", label: "Critica" },
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Media" },
];

export default function CrisisPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");

  const clients = trpc.clients.list.useQuery();
  const crises = trpc.crisis.list.useQuery({
    status: (statusFilter || undefined) as "ACTIVE" | "MONITORING" | "RESOLVED" | "DISMISSED" | undefined,
    clientId: clientFilter || undefined,
    severity: (severityFilter || undefined) as "CRITICAL" | "HIGH" | "MEDIUM" | undefined,
    limit: 50,
  });

  const activeCrisisCount = trpc.crisis.getActiveCrisisCount.useQuery();

  const clientOptions = useMemo(() => {
    if (!clients.data) return [];
    return clients.data.map((c) => ({ value: c.id, label: c.name }));
  }, [clients.data]);

  const activeFilterCount = [clientFilter, severityFilter].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          <Shield className="mr-2 inline-block h-7 w-7 text-red-600" />
          Gestion de Crisis
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitorea y gestiona alertas de crisis de tus clientes
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-red-700 dark:text-red-400">Crisis activas</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-300">
                {activeCrisisCount.data?.count ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total este mes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {crises.data?.crises.length ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Resueltas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {crises.data?.crises.filter(c => c.status === "RESOLVED").length ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
              statusFilter === tab.value
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <FilterBar activeCount={activeFilterCount} onClear={() => { setClientFilter(""); setSeverityFilter(""); }}>
        <FilterSelect
          label="Cliente"
          value={clientFilter}
          options={clientOptions}
          onChange={setClientFilter}
          placeholder="Todos"
          icon={<Users className="h-4 w-4" />}
        />
        <FilterSelect
          label="Severidad"
          value={severityFilter}
          options={SEVERITY_OPTIONS}
          onChange={setSeverityFilter}
          placeholder="Todas"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </FilterBar>

      {/* Crisis List */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/20">
        {crises.isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="px-6 py-3 font-medium">Cliente</th>
              <th className="px-6 py-3 font-medium">Severidad</th>
              <th className="px-6 py-3 font-medium">Tipo</th>
              <th className="px-6 py-3 font-medium">Notas</th>
              <th className="px-6 py-3 font-medium">Estado</th>
              <th className="px-6 py-3 font-medium">Asignado</th>
              <th className="px-6 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {crises.data?.crises.map((crisis) => {
              const sevConfig = SEVERITY_CONFIG[crisis.severity] || SEVERITY_CONFIG.MEDIUM;
              const statConfig = STATUS_CONFIG[crisis.status] || STATUS_CONFIG.ACTIVE;

              return (
                <tr key={crisis.id} className="border-b last:border-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/crisis/${crisis.id}`}
                      className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      {crisis.client.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", sevConfig.color)}>
                      {sevConfig.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                    {crisis.triggerType || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {crisis._count.crisisNotes}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", statConfig.color)}>
                      {statConfig.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {crisis.assignedTo?.name || "Sin asignar"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(crisis.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {crises.data?.crises.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">No hay alertas de crisis.</p>
          </div>
        )}
      </div>
    </div>
  );
}
