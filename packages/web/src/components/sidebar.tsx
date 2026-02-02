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
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { useTheme } from "./theme-provider";
import { NotificationBell } from "./notifications";
import { TourButton } from "./onboarding";

// Mapeo de href a tour-id para el tour de onboarding
const tourIdMap: Record<string, string> = {
  "/dashboard": "nav-dashboard",
  "/dashboard/agencies": "nav-agencies",
  "/dashboard/clients": "nav-clients",
  "/dashboard/mentions": "nav-mentions",
  "/dashboard/social-mentions": "nav-social",
  "/dashboard/analytics": "nav-analytics",
  "/dashboard/intelligence": "nav-intelligence",
  "/dashboard/sources": "nav-sources",
  "/dashboard/tasks": "nav-tasks",
  "/dashboard/team": "nav-team",
  "/dashboard/settings": "nav-settings",
};

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Agencias", href: "/dashboard/agencies", icon: Building2, superAdminOnly: true },
  { name: "Clientes", href: "/dashboard/clients", icon: Users },
  { name: "Menciones", href: "/dashboard/mentions", icon: Newspaper },
  { name: "Redes Sociales", href: "/dashboard/social-mentions", icon: Share2 },
  { name: "Analiticas", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Intelligence", href: "/dashboard/intelligence", icon: Brain },
  { name: "Fuentes", href: "/dashboard/sources", icon: Rss },
  { name: "Tareas", href: "/dashboard/tasks", icon: CheckSquare },
  { name: "Equipo", href: "/dashboard/team", icon: UserCog },
  { name: "Configuracion", href: "/dashboard/settings", icon: Settings, superAdminOnly: true },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

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

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <Newspaper className="h-4.5 w-4.5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">MediaBot</h1>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
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
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 text-gray-300 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4" data-tour-id="sidebar">
        {navigation
          .filter((item) => {
            // Super Admin only items
            if ("superAdminOnly" in item && item.superAdminOnly) {
              return (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true;
            }
            // Admin only items
            if ("adminOnly" in item && item.adminOnly) {
              return (session?.user as { role?: string })?.role === "ADMIN";
            }
            return true;
          })
          .map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const tourId = tourIdMap[item.href];
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                data-tour-id={tourId}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-blue-300")} />
                {item.name}
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                )}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-white/10 p-3">
        {session?.user && (
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
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesion
        </button>
        <TourButton variant="full" className="mt-2 w-full" />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-brand-900 p-2 text-white shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-900 text-white transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full w-64 flex-col bg-brand-900 text-white">
        {sidebarContent}
      </div>
    </>
  );
}
