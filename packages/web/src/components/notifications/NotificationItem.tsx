"use client";

import { cn } from "@/lib/cn";
import {
  AlertTriangle,
  Bell,
  FileText,
  TrendingUp,
  AlertCircle,
  Info,
} from "lucide-react";
import type { NotificationType } from "@prisma/client";

interface NotificationItemProps {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  onClick?: () => void;
}

const typeConfig: Record<
  NotificationType,
  { icon: typeof Bell; color: string; bgColor: string }
> = {
  MENTION_CRITICAL: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  MENTION_HIGH: {
    icon: AlertTriangle,
    color: "text-orange-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  CRISIS_ALERT: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  WEEKLY_REPORT: {
    icon: FileText,
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  EMERGING_TOPIC: {
    icon: TrendingUp,
    color: "text-purple-500",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  SYSTEM: {
    icon: Info,
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-700/30",
  },
};

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
  });
}

export function NotificationItem({
  type,
  title,
  message,
  read,
  createdAt,
  onClick,
}: NotificationItemProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors",
        read
          ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          : "bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30"
      )}
    >
      <div className={cn("mt-0.5 rounded-lg p-2", config.bgColor)}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm",
              read
                ? "text-gray-700 dark:text-gray-300"
                : "font-medium text-gray-900 dark:text-white"
            )}
          >
            {title}
          </p>
          {!read && (
            <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
          )}
        </div>

        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
          {message}
        </p>

        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {getRelativeTime(new Date(createdAt))}
        </p>
      </div>
    </button>
  );
}
