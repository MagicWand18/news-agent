"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard,
  Users,
  Newspaper,
  CheckSquare,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Brain,
  Sun,
  Moon,
  Rss,
  Share2,
  Building2,
  Shield,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  MessageSquareReply,
  Bell,
  FileText,
  Target,
  Crown,
  Volume2,
  VolumeX,
  Tag,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "./theme-provider";
import { NotificationBell } from "./notifications";
import { TourButton } from "./onboarding";
import { useSidebar } from "@/hooks/use-sidebar";
import { useNotificationSound } from "@/hooks/use-notification-sound";

// Mapeo de href a tour-id para el tour de onboarding
const tourIdMap: Record<string, string> = {
  "/dashboard": "nav-dashboard",
  "/dashboard/executive": "nav-executive",
  "/dashboard/agencies": "nav-agencies",
  "/dashboard/clients": "nav-clients",
  "/dashboard/mentions": "nav-mentions",
  "/dashboard/social-mentions": "nav-social",
  "/dashboard/analytics": "nav-analytics",
  "/dashboard/intelligence": "nav-intelligence",
  "/dashboard/briefs": "nav-briefs",
  "/dashboard/crisis": "nav-crisis",
  "/dashboard/responses": "nav-responses",
  "/dashboard/sources": "nav-sources",
  "/dashboard/alert-rules": "nav-alert-rules",
  "/dashboard/topics": "nav-topics",
  "/dashboard/campaigns": "nav-campaigns",
  "/dashboard/tasks": "nav-tasks",
  "/dashboard/team": "nav-team",
  "/dashboard/settings": "nav-settings",
};

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Ejecutivo", href: "/dashboard/executive", icon: Crown, superAdminOnly: true },
  { name: "Clientes", href: "/dashboard/clients", icon: Users, separator: true },
  { name: "Menciones", href: "/dashboard/mentions", icon: Newspaper },
  { name: "Redes Sociales", href: "/dashboard/social-mentions", icon: Share2 },
  { name: "Analiticas", href: "/dashboard/analytics", icon: BarChart3, separator: true },
  { name: "Intelligence", href: "/dashboard/intelligence", icon: Brain },
  { name: "Temas", href: "/dashboard/topics", icon: Tag },
  { name: "Media Brief", href: "/dashboard/briefs", icon: FileText },
  { name: "Crisis", href: "/dashboard/crisis", icon: AlertTriangle },
  { name: "Respuestas", href: "/dashboard/responses", icon: MessageSquareReply },
  { name: "Fuentes", href: "/dashboard/sources", icon: Rss, separator: true },
  { name: "Reglas de Alerta", href: "/dashboard/alert-rules", icon: Bell },
  { name: "Campañas", href: "/dashboard/campaigns", icon: Target },
  { name: "Tareas", href: "/dashboard/tasks", icon: CheckSquare },
  { name: "Equipo", href: "/dashboard/team", icon: UserCog, separator: true },
  { name: "Agencias", href: "/dashboard/agencies", icon: Building2, superAdminOnly: true },
  { name: "Configuracion", href: "/dashboard/settings", icon: Settings, superAdminOnly: true },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { collapsed, toggle } = useSidebar();
  const { soundEnabled, toggleSound } = useNotificationSound();

  // Badge de crisis activas
  const activeCrisis = trpc.crisis.getActiveCrisisCount.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Badge de temas negativos activos
  const negativeTopics = trpc.topics.getNegativeCount.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const filteredNavigation = navigation.filter((item) => {
    if ("superAdminOnly" in item && item.superAdminOnly) {
      return (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true;
    }
    if ("adminOnly" in item && (item as { adminOnly?: boolean }).adminOnly) {
      return (session?.user as { role?: string })?.role === "ADMIN";
    }
    return true;
  });

  /**
   * Renderiza el contenido del sidebar.
   * @param isCollapsed - Indica si el sidebar esta colapsado (solo aplica en desktop)
   */
  const renderSidebarContent = (isCollapsed: boolean) => (
    <>
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-3">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <Newspaper className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">MediaBot</h1>
          </div>
        ) : (
          <div className="flex w-full items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <Newspaper className="h-4.5 w-4.5" />
            </div>
          </div>
        )}
        {!isCollapsed && (
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={toggleSound}
              className="rounded-lg p-1.5 text-gray-300 hover:bg-white/10 transition-colors"
              aria-label={soundEnabled ? "Silenciar alertas" : "Activar sonido de alertas"}
              title={soundEnabled ? "Sonido activado" : "Sonido silenciado"}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleTheme}
              data-tour-id="theme-toggle"
              className="rounded-lg p-1.5 text-gray-300 hover:bg-white/10 transition-colors"
              aria-label={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            {/* Collapse toggle - solo desktop */}
            <button
              onClick={toggle}
              className="hidden rounded-lg p-1.5 text-gray-300 hover:bg-white/10 transition-colors lg:block"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Close mobile sidebar */}
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-1 text-gray-300 hover:bg-white/10 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Notificaciones, tema y expand cuando esta colapsado */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-1 px-1 mb-2">
          <button
            onClick={toggle}
            className="rounded-lg p-1.5 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <NotificationBell />
          <button
            onClick={toggleSound}
            className="rounded-lg p-1.5 text-gray-300 hover:bg-white/10 transition-colors"
            aria-label={soundEnabled ? "Silenciar alertas" : "Activar sonido de alertas"}
            title={soundEnabled ? "Sonido activado" : "Sonido silenciado"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleTheme}
            data-tour-id="theme-toggle"
            className="rounded-lg p-1.5 text-gray-300 hover:bg-white/10 transition-colors"
            aria-label={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {/* Navegacion */}
      <nav className={cn("flex-1 space-y-0.5 px-3 py-4", isCollapsed && "px-2")} data-tour-id="sidebar">
        {filteredNavigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const tourId = tourIdMap[item.href];
          return (
            <div key={item.name}>
              {"separator" in item && item.separator && (
                <div className="my-2 border-t border-white/10" />
              )}
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                data-tour-id={tourId}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isCollapsed && "justify-center px-0",
                  isActive
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-blue-300")} />
                {!isCollapsed && item.name}
                {/* Badge de crisis activas */}
                {!isCollapsed && item.href === "/dashboard/crisis" && (activeCrisis.data?.count ?? 0) > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {activeCrisis.data!.count}
                  </span>
                )}
                {/* Badge de temas negativos */}
                {!isCollapsed && item.href === "/dashboard/topics" && (negativeTopics.data?.count ?? 0) > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                    {negativeTopics.data!.count}
                  </span>
                )}
                {!isCollapsed && isActive && item.href !== "/dashboard/crisis" && !(item.href === "/dashboard/topics" && (negativeTopics.data?.count ?? 0) > 0) && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                )}
                {/* Red dot para crisis activas en modo colapsado */}
                {isCollapsed && item.href === "/dashboard/crisis" && (activeCrisis.data?.count ?? 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-brand-900" />
                )}
                {/* Orange dot para temas negativos en modo colapsado */}
                {isCollapsed && item.href === "/dashboard/topics" && (negativeTopics.data?.count ?? 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-brand-900" />
                )}
                {isCollapsed && (
                  <span className="absolute left-full ml-2 hidden rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block whitespace-nowrap z-50">
                    {item.name}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        {/* Info de usuario expandida */}
        {!isCollapsed && session?.user && (
          <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-white">
                  {session.user.name}
                </p>
                {(session.user as { isSuperAdmin?: boolean }).isSuperAdmin && (
                  <span title="Super Admin">
                    <Shield className="h-3.5 w-3.5 text-purple-400" />
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-gray-400">
                {session.user.email}
              </p>
            </div>
          </div>
        )}

        {/* Avatar colapsado */}
        {isCollapsed && session?.user && (
          <div className="mb-2 flex justify-center">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white"
              title={session.user.name || ""}
            >
              {userInitials}
            </div>
          </div>
        )}

        {/* Boton cerrar sesion */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={isCollapsed ? "Cerrar sesion" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && "Cerrar sesion"}
        </button>

        {/* Boton de tour */}
        {!isCollapsed && <TourButton variant="full" className="mt-2 w-full" />}
      </div>
    </>
  );

  return (
    <>
      {/* Boton toggle mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-brand-900 p-2 text-white shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar mobile - siempre expandido */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-900 text-white transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {renderSidebarContent(false)}
      </div>

      {/* Sidebar desktop - colapsable */}
      <div
        className={cn(
          "hidden lg:flex h-full flex-col bg-brand-900 text-white transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {renderSidebarContent(collapsed)}
      </div>
    </>
  );
}
