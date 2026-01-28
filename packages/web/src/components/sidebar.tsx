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
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clientes", href: "/dashboard/clients", icon: Users },
  { name: "Menciones", href: "/dashboard/mentions", icon: Newspaper },
  { name: "Analiticas", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Tareas", href: "/dashboard/tasks", icon: CheckSquare },
  { name: "Equipo", href: "/dashboard/team", icon: UserCog },
  { name: "Configuracion", href: "/dashboard/settings", icon: Settings, adminOnly: true },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1 text-gray-300 hover:bg-white/10 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navigation
          .filter((item) => !("adminOnly" in item && item.adminOnly) || (session?.user as { role?: string })?.role === "ADMIN")
          .map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
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
              <p className="truncate text-sm font-medium text-white">
                {session.user.name}
              </p>
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
