"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import {
  Bell,
  CheckCheck,
  Trash2,
  Loader2,
  Inbox,
  Filter,
  AlertCircle,
  AlertTriangle,
  FileText,
  TrendingUp,
  Info,
} from "lucide-react";
import { FilterBar, FilterSelect, FilterChips } from "@/components/filters";
import type { NotificationType } from "@prisma/client";

const typeConfig: Record<
  NotificationType,
  { icon: typeof Bell; label: string; color: string; bgColor: string }
> = {
  MENTION_CRITICAL: {
    icon: AlertCircle,
    label: "Mención crítica",
    color: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  MENTION_HIGH: {
    icon: AlertTriangle,
    label: "Mención importante",
    color: "text-orange-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  CRISIS_ALERT: {
    icon: AlertCircle,
    label: "Alerta de crisis",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  WEEKLY_REPORT: {
    icon: FileText,
    label: "Reporte semanal",
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  EMERGING_TOPIC: {
    icon: TrendingUp,
    label: "Tema emergente",
    color: "text-purple-500",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  SYSTEM: {
    icon: Info,
    label: "Sistema",
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-700/30",
  },
};

const TYPE_OPTIONS = [
  { value: "MENTION_CRITICAL", label: "Menciones críticas" },
  { value: "MENTION_HIGH", label: "Menciones importantes" },
  { value: "CRISIS_ALERT", label: "Alertas de crisis" },
  { value: "WEEKLY_REPORT", label: "Reportes semanales" },
  { value: "EMERGING_TOPIC", label: "Temas emergentes" },
  { value: "SYSTEM", label: "Sistema" },
];

const READ_OPTIONS = [
  { value: "false", label: "No leídas" },
  { value: "true", label: "Leídas" },
];

/**
 * Calcula el tiempo relativo desde la fecha dada
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [readFilter, setReadFilter] = useState<string>("");
  const utils = trpc.useUtils();

  // Obtener notificaciones paginadas
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.notifications.list.useInfiniteQuery(
      {
        type: (typeFilter || undefined) as NotificationType | undefined,
        read: readFilter === "" ? undefined : readFilter === "true",
        limit: 20,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  // Obtener contador de no leídas
  const { data: unreadData } = trpc.notifications.getUnreadCount.useQuery();

  // Marcar como leída
  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  // Marcar todas como leídas
  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  // Eliminar notificación
  const deleteNotification = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  // Eliminar todas las leídas
  const deleteAllRead = trpc.notifications.deleteAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
    },
  });

  const notifications = data?.pages.flatMap((page) => page.notifications) || [];
  const unreadCount = unreadData?.count || 0;

  // Filtros activos
  const activeFilterCount = [typeFilter, readFilter].filter(Boolean).length;

  const filterChips = useMemo(() => {
    const chips = [];
    if (typeFilter) {
      const label =
        TYPE_OPTIONS.find((t) => t.value === typeFilter)?.label || typeFilter;
      chips.push({ key: "type", label: "Tipo", value: label });
    }
    if (readFilter) {
      const label =
        READ_OPTIONS.find((r) => r.value === readFilter)?.label || readFilter;
      chips.push({ key: "read", label: "Estado", value: label });
    }
    return chips;
  }, [typeFilter, readFilter]);

  const handleClearFilters = () => {
    setTypeFilter("");
    setReadFilter("");
  };

  const handleRemoveChip = (key: string) => {
    if (key === "type") setTypeFilter("");
    if (key === "read") setReadFilter("");
  };

  const handleNotificationClick = (
    notification: (typeof notifications)[0]
  ) => {
    // Marcar como leída si no lo está
    if (!notification.read) {
      markAsRead.mutate({ id: notification.id });
    }

    // Navegar según el tipo de notificación
    const notifData = notification.data as Record<string, unknown> | null;

    if (notifData?.mentionId) {
      router.push(`/dashboard/mentions/${notifData.mentionId}`);
    } else if (notifData?.clientId) {
      router.push(`/dashboard/clients/${notifData.clientId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Notificaciones
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {unreadCount > 0
              ? `${unreadCount} notificaciones sin leer`
              : "Todas las notificaciones leídas"}
          </p>
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como leídas
            </button>
          )}

          <button
            onClick={() => deleteAllRead.mutate()}
            disabled={deleteAllRead.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Trash2 className="h-4 w-4" />
            Limpiar leídas
          </button>
        </div>
      </div>

      {/* Filtros */}
      <FilterBar activeCount={activeFilterCount} onClear={handleClearFilters}>
        <FilterSelect
          label="Tipo"
          value={typeFilter}
          options={TYPE_OPTIONS}
          onChange={setTypeFilter}
          placeholder="Todos"
          icon={<Filter className="h-4 w-4" />}
        />
        <FilterSelect
          label="Estado"
          value={readFilter}
          options={READ_OPTIONS}
          onChange={setReadFilter}
          placeholder="Todos"
          icon={<Bell className="h-4 w-4" />}
        />
      </FilterBar>

      {/* Chips de filtros activos */}
      <FilterChips chips={filterChips} onRemove={handleRemoveChip} />

      {/* Lista de notificaciones */}
      <div className="rounded-xl bg-white shadow-sm dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Inbox className="h-16 w-16" />
            <p className="mt-4 text-lg font-medium">No hay notificaciones</p>
            <p className="mt-1 text-sm">
              {activeFilterCount > 0
                ? "Intenta ajustar los filtros"
                : "Las notificaciones aparecerán aquí"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map((notification) => {
              const config = typeConfig[notification.type];
              const Icon = config.icon;

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-4 p-4 transition-colors",
                    notification.read
                      ? "bg-white dark:bg-gray-800"
                      : "bg-blue-50/50 dark:bg-blue-900/10"
                  )}
                >
                  {/* Icono */}
                  <div className={cn("rounded-lg p-2.5", config.bgColor)}>
                    <Icon className={cn("h-5 w-5", config.color)} />
                  </div>

                  {/* Contenido */}
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm",
                          notification.read
                            ? "text-gray-700 dark:text-gray-300"
                            : "font-medium text-gray-900 dark:text-white"
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {notification.message}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                      <span>{config.label}</span>
                      <span>•</span>
                      <span>{getRelativeTime(new Date(notification.createdAt))}</span>
                    </div>
                  </button>

                  {/* Acciones */}
                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead.mutate({ id: notification.id });
                        }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                        title="Marcar como leída"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification.mutate({ id: notification.id });
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cargar más */}
        {hasNextPage && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-700">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-50 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </>
              ) : (
                "Cargar más notificaciones"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
