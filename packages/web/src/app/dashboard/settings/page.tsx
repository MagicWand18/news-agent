"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Save, RotateCcw, Database, AlertCircle } from "lucide-react";

const categoryLabels: Record<string, string> = {
  general: "General",
  analysis: "Analisis AI",
  notifications: "Notificaciones",
  ui: "Interfaz",
  crisis: "Deteccion de Crisis",
};

const categoryDescriptions: Record<string, string> = {
  analysis: "Configuraciones para el analisis de menciones con inteligencia artificial",
  notifications: "Parametros para notificaciones y digests",
  ui: "Configuraciones de la interfaz de usuario",
  crisis: "Umbrales y parametros para deteccion automatica de crisis",
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const settings = trpc.settings.list.useQuery();
  const updateSetting = trpc.settings.update.useMutation({
    onSuccess: () => {
      settings.refetch();
      setEditingKey(null);
      setEditValue("");
    },
  });
  const resetSetting = trpc.settings.reset.useMutation({
    onSuccess: () => settings.refetch(),
  });
  const seedDefaults = trpc.settings.seedDefaults.useMutation({
    onSuccess: () => settings.refetch(),
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Check for admin role
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const startEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const saveEdit = (key: string) => {
    updateSetting.mutate({ key, value: editValue });
  };

  const handleReset = (key: string) => {
    if (confirm("Restablecer este valor al predeterminado?")) {
      resetSetting.mutate({ key });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuracion</h2>
          <p className="mt-1 text-sm text-gray-500">
            Ajusta los parametros del sistema. Los cambios se aplican inmediatamente.
          </p>
        </div>
        <button
          onClick={() => seedDefaults.mutate()}
          disabled={seedDefaults.isPending}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          <Database className="h-4 w-4" />
          {seedDefaults.isPending ? "Creando..." : "Inicializar valores"}
        </button>
      </div>

      {settings.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : settings.data?.categories.length === 0 ? (
        <div className="rounded-xl bg-yellow-50 p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
          <h3 className="mt-4 font-semibold text-yellow-800">No hay configuraciones</h3>
          <p className="mt-2 text-sm text-yellow-700">
            Haz clic en &quot;Inicializar valores&quot; para crear las configuraciones por defecto.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {settings.data?.categories.map((category) => (
            <div key={category} className="rounded-xl bg-white shadow-sm">
              <div className="border-b px-6 py-4">
                <h3 className="font-semibold text-gray-900">
                  {categoryLabels[category] || category}
                </h3>
                {categoryDescriptions[category] && (
                  <p className="mt-1 text-sm text-gray-500">
                    {categoryDescriptions[category]}
                  </p>
                )}
              </div>
              <div className="divide-y">
                {settings.data?.grouped[category]?.map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">
                        {setting.label || setting.key}
                      </p>
                      {setting.description && (
                        <p className="mt-0.5 text-sm text-gray-500">
                          {setting.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        Clave: <code className="rounded bg-gray-100 px-1">{setting.key}</code>
                        {" | "}
                        Tipo: <code className="rounded bg-gray-100 px-1">{setting.type}</code>
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      {editingKey === setting.key ? (
                        <>
                          <input
                            type={setting.type === "NUMBER" ? "number" : "text"}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-32 rounded-lg border px-3 py-1.5 text-sm"
                            step={setting.type === "NUMBER" ? "0.1" : undefined}
                          />
                          <button
                            onClick={() => saveEdit(setting.key)}
                            disabled={updateSetting.isPending}
                            className="rounded-lg bg-brand-600 p-2 text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-mono text-sm">
                            {setting.value}
                          </span>
                          <button
                            onClick={() => startEdit(setting.key, setting.value)}
                            className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleReset(setting.key)}
                            disabled={resetSetting.isPending}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Restablecer al valor predeterminado"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(updateSetting.isError || resetSetting.isError) && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Error: {updateSetting.error?.message || resetSetting.error?.message}
        </div>
      )}
    </div>
  );
}
