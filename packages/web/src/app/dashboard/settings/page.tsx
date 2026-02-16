"use client";

import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Save, RotateCcw, Database, AlertCircle, Send } from "lucide-react";
import { TELEGRAM_NOTIFICATION_TYPES } from "@/lib/telegram-notification-types";

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

const NOTIF_TYPES = Object.values(TELEGRAM_NOTIFICATION_TYPES);

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

  const isSuperAdmin = !!(session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin;

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

      {/* Sección Telegram para SuperAdmin */}
      {isSuperAdmin && <TelegramPrefsSection />}

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

/**
 * Sección de preferencias Telegram para SuperAdmin.
 * Muestra campo para ID de Telegram y toggles de 10 tipos de notificación.
 */
function TelegramPrefsSection() {
  const telegramPrefs = trpc.settings.getTelegramPrefs.useQuery();
  const updateTelegramId = trpc.settings.updateTelegramId.useMutation({
    onSuccess: () => {
      telegramPrefs.refetch();
      setTelegramIdEditing(false);
    },
  });
  const updatePrefs = trpc.settings.updateTelegramPrefs.useMutation({
    onSuccess: () => telegramPrefs.refetch(),
  });

  const [telegramIdEditing, setTelegramIdEditing] = useState(false);
  const [telegramIdValue, setTelegramIdValue] = useState("");
  const [localPrefs, setLocalPrefs] = useState<Record<string, boolean>>({});
  const [prefsChanged, setPrefsChanged] = useState(false);

  // Inicializar preferencias locales cuando llegan del server
  useEffect(() => {
    if (telegramPrefs.data) {
      const serverPrefs = telegramPrefs.data.preferences || {};
      const initial: Record<string, boolean> = {};
      for (const type of NOTIF_TYPES) {
        initial[type.key] = serverPrefs[type.key] !== false; // null/undefined = true
      }
      setLocalPrefs(initial);
      setPrefsChanged(false);
    }
  }, [telegramPrefs.data]);

  const handleToggle = (key: string) => {
    setLocalPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      setPrefsChanged(true);
      return updated;
    });
  };

  const savePrefs = () => {
    updatePrefs.mutate({ preferences: localPrefs });
    setPrefsChanged(false);
  };

  const startEditTelegramId = () => {
    setTelegramIdValue(telegramPrefs.data?.telegramUserId || "");
    setTelegramIdEditing(true);
  };

  return (
    <div className="rounded-xl bg-white shadow-sm dark:bg-gray-800 dark:shadow-gray-900/20">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Notificaciones Telegram (Super Admin)
          </h3>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configura tu ID de Telegram y selecciona que notificaciones recibir de TODOS los clientes.
        </p>
      </div>

      <div className="p-6">
        {/* Campo Telegram ID */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tu ID de Telegram
          </label>
          {telegramIdEditing ? (
            <div className="flex items-center gap-2">
              <input
                value={telegramIdValue}
                onChange={(e) => setTelegramIdValue(e.target.value)}
                placeholder="Ej: 123456789"
                className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
              <button
                onClick={() => updateTelegramId.mutate({ telegramUserId: telegramIdValue })}
                disabled={updateTelegramId.isPending || !telegramIdValue.trim()}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {updateTelegramId.isPending ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setTelegramIdEditing(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {telegramPrefs.data?.telegramUserId || "No configurado"}
              </span>
              <button
                onClick={startEditTelegramId}
                className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300"
              >
                {telegramPrefs.data?.telegramUserId ? "Cambiar" : "Configurar"}
              </button>
            </div>
          )}
          {updateTelegramId.error && (
            <p className="mt-1 text-sm text-red-600">{updateTelegramId.error.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Envia /start al bot y usa /vincular para obtener tu ID de Telegram.
          </p>
        </div>

        {/* Toggles de notificaciones */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Tipos de notificacion
          </h4>
          {NOTIF_TYPES.map((type) => (
            <div
              key={type.key}
              className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {type.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {type.description}
                </p>
              </div>
              <button
                onClick={() => handleToggle(type.key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  localPrefs[type.key]
                    ? "bg-brand-600"
                    : "bg-gray-200 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localPrefs[type.key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Botón guardar preferencias */}
        {prefsChanged && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={savePrefs}
              disabled={updatePrefs.isPending}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {updatePrefs.isPending ? "Guardando..." : "Guardar preferencias"}
            </button>
          </div>
        )}
        {updatePrefs.error && (
          <p className="mt-2 text-sm text-red-600">{updatePrefs.error.message}</p>
        )}
      </div>
    </div>
  );
}
