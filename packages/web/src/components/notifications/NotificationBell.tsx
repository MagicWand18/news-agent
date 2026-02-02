"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { NotificationDropdown } from "./NotificationDropdown";

const POLL_INTERVAL = 30000; // 30 segundos

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  // Obtener contador de no leídas con polling
  const { data } = trpc.notifications.getUnreadCount.useQuery(undefined, {
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: true,
  });

  const unreadCount = data?.count || 0;

  // Cerrar dropdown cuando se cambia de página
  useEffect(() => {
    const handleRouteChange = () => {
      setIsOpen(false);
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  return (
    <div className="relative" data-tour-id="notification-bell">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative rounded-lg p-2 transition-colors",
          isOpen
            ? "bg-white/20 text-white"
            : "text-gray-300 hover:bg-white/10 hover:text-white"
        )}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
      >
        <Bell className="h-5 w-5" />

        {/* Badge de contador */}
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white",
              unreadCount > 9 ? "h-5 min-w-5 px-1" : "h-4 w-4"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
