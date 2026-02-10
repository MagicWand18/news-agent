"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { NotificationItem } from "./NotificationItem";
import { Loader2, Inbox, CheckCheck, X } from "lucide-react";

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({
  isOpen,
  onClose,
}: NotificationDropdownProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Obtener últimas 10 notificaciones
  const { data, isLoading } = trpc.notifications.list.useQuery(
    { limit: 10 },
    { enabled: isOpen }
  );

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

  // Cerrar al hacer click fuera (incluye el contenedor padre con el botón bell)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const parentContainer = dropdownRef.current?.closest("[data-tour-id='notification-bell']");
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        (!parentContainer || !parentContainer.contains(event.target as Node))
      ) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Cerrar con Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const notifications = data?.notifications || [];
  const hasUnread = notifications.some((n) => !n.read);

  const handleNotificationClick = (notification: (typeof notifications)[0]) => {
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
    } else {
      router.push("/dashboard/notifications");
    }

    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Notificaciones
        </h3>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <button
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Cerrar notificaciones"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lista de notificaciones */}
      <div className="max-h-96 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Inbox className="h-10 w-10" />
            <p className="mt-2 text-sm">No tienes notificaciones</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                id={notification.id}
                type={notification.type}
                title={notification.title}
                message={notification.message}
                read={notification.read}
                createdAt={notification.createdAt}
                onClick={() => handleNotificationClick(notification)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        <button
          onClick={() => {
            router.push("/dashboard/notifications");
            onClose();
          }}
          className="w-full text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Ver todas las notificaciones
        </button>
      </div>
    </div>
  );
}
