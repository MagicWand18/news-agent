"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  Users,
  Newspaper,
  AlertTriangle,
  Brain,
  Share2,
  BarChart3,
  Target,
  FileText,
  Search,
  Crown,
  Plus,
  Rss,
  Bell,
  CheckSquare,
  MessageSquareReply,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pages = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Ejecutivo", href: "/dashboard/executive", icon: Crown },
  { name: "Clientes", href: "/dashboard/clients", icon: Users },
  { name: "Menciones", href: "/dashboard/mentions", icon: Newspaper },
  { name: "Redes Sociales", href: "/dashboard/social-mentions", icon: Share2 },
  { name: "Analiticas", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Intelligence", href: "/dashboard/intelligence", icon: Brain },
  { name: "Media Brief", href: "/dashboard/briefs", icon: FileText },
  { name: "Crisis", href: "/dashboard/crisis", icon: AlertTriangle },
  {
    name: "Respuestas",
    href: "/dashboard/responses",
    icon: MessageSquareReply,
  },
  { name: "Fuentes", href: "/dashboard/sources", icon: Rss },
  { name: "Reglas de Alerta", href: "/dashboard/alert-rules", icon: Bell },
  { name: "Campanas", href: "/dashboard/campaigns", icon: Target },
  { name: "Tareas", href: "/dashboard/tasks", icon: CheckSquare },
  { name: "Configuracion", href: "/dashboard/settings", icon: Settings },
];

const actions = [
  { name: "Crear cliente", href: "/dashboard/clients/new", icon: Plus },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Busqueda via tRPC (con debounce natural de staleTime)
  const searchQuery = trpc.search.search.useQuery(
    { query, limit: 5 },
    { enabled: open && query.length >= 2, staleTime: 5000 }
  );

  // Resetear query al abrir
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      onOpenChange(false);
    },
    [router, onOpenChange]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Palette */}
      <div className="mx-auto mt-[20vh] w-full max-w-xl px-4">
        <Command
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
          shouldFilter={query.length < 2}
        >
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 dark:border-gray-700">
            <Search className="h-4 w-4 text-gray-400" />
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar paginas, clientes, menciones..."
              className="w-full bg-transparent py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 sm:inline dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No se encontraron resultados.
            </Command.Empty>

            {/* Paginas */}
            <Command.Group
              heading="Paginas"
              className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-400 dark:[&_[cmdk-group-heading]]:text-gray-500"
            >
              {pages.map((page) => (
                <Command.Item
                  key={page.href}
                  value={page.name}
                  onSelect={() => navigate(page.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 aria-selected:bg-gray-100 dark:text-gray-300 dark:aria-selected:bg-gray-700"
                >
                  <page.icon className="h-4 w-4 text-gray-400" />
                  {page.name}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Acciones rapidas */}
            <Command.Group
              heading="Acciones"
              className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-400 dark:[&_[cmdk-group-heading]]:text-gray-500"
            >
              {actions.map((action) => (
                <Command.Item
                  key={action.href}
                  value={action.name}
                  onSelect={() => navigate(action.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 aria-selected:bg-gray-100 dark:text-gray-300 dark:aria-selected:bg-gray-700"
                >
                  <action.icon className="h-4 w-4 text-gray-400" />
                  {action.name}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Resultados de busqueda dinamicos */}
            {query.length >= 2 && searchQuery.data && (
              <>
                {searchQuery.data.clients.length > 0 && (
                  <Command.Group
                    heading="Clientes"
                    className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-400 dark:[&_[cmdk-group-heading]]:text-gray-500"
                  >
                    {searchQuery.data.clients.map(
                      (client: {
                        id: string;
                        name: string;
                        industry: string | null;
                      }) => (
                        <Command.Item
                          key={client.id}
                          value={`client-${client.name}`}
                          onSelect={() =>
                            navigate(`/dashboard/clients/${client.id}`)
                          }
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 aria-selected:bg-gray-100 dark:text-gray-300 dark:aria-selected:bg-gray-700"
                        >
                          <Users className="h-4 w-4 text-gray-400" />
                          <div>
                            <span className="font-medium">{client.name}</span>
                            {client.industry && (
                              <span className="ml-2 text-xs text-gray-400">
                                {client.industry}
                              </span>
                            )}
                          </div>
                        </Command.Item>
                      )
                    )}
                  </Command.Group>
                )}

                {searchQuery.data.mentions.length > 0 && (
                  <Command.Group
                    heading="Menciones"
                    className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-400 dark:[&_[cmdk-group-heading]]:text-gray-500"
                  >
                    {searchQuery.data.mentions.map(
                      (mention: {
                        id: string;
                        sentiment: string | null;
                        aiSummary: string | null;
                        article: { title: string; source: string };
                        client: { name: string };
                      }) => (
                        <Command.Item
                          key={mention.id}
                          value={`mention-${mention.aiSummary}`}
                          onSelect={() =>
                            navigate(`/dashboard/mentions/${mention.id}`)
                          }
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 aria-selected:bg-gray-100 dark:text-gray-300 dark:aria-selected:bg-gray-700"
                        >
                          <Newspaper className="h-4 w-4 text-gray-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {mention.article.title}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {mention.client.name} ·{" "}
                              {mention.article.source}
                            </p>
                          </div>
                          {mention.sentiment && (
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                mention.sentiment === "POSITIVE"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : mention.sentiment === "NEGATIVE"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                              )}
                            >
                              {mention.sentiment === "POSITIVE"
                                ? "+"
                                : mention.sentiment === "NEGATIVE"
                                  ? "\u2212"
                                  : "~"}
                            </span>
                          )}
                        </Command.Item>
                      )
                    )}
                  </Command.Group>
                )}

                {searchQuery.data.socialMentions.length > 0 && (
                  <Command.Group
                    heading="Redes Sociales"
                    className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-400 dark:[&_[cmdk-group-heading]]:text-gray-500"
                  >
                    {searchQuery.data.socialMentions.map(
                      (sm: {
                        id: string;
                        content: string | null;
                        authorHandle: string;
                        platform: string;
                        client: { name: string };
                      }) => (
                        <Command.Item
                          key={sm.id}
                          value={`social-${sm.content}`}
                          onSelect={() =>
                            navigate(`/dashboard/social-mentions/${sm.id}`)
                          }
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 aria-selected:bg-gray-100 dark:text-gray-300 dark:aria-selected:bg-gray-700"
                        >
                          <Share2 className="h-4 w-4 text-gray-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {sm.content?.slice(0, 80) || "Sin contenido"}
                            </p>
                            <p className="text-xs text-gray-400">
                              @{sm.authorHandle} · {sm.platform} ·{" "}
                              {sm.client.name}
                            </p>
                          </div>
                        </Command.Item>
                      )
                    )}
                  </Command.Group>
                )}
              </>
            )}

            {query.length >= 2 && searchQuery.isLoading && (
              <div className="px-4 py-4 text-center text-sm text-gray-400">
                Buscando...
              </div>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 dark:border-gray-700">
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span>
                <kbd className="rounded border border-gray-200 px-1 dark:border-gray-600">
                  {"\u2191\u2193"}
                </kbd>{" "}
                navegar
              </span>
              <span>
                <kbd className="rounded border border-gray-200 px-1 dark:border-gray-600">
                  {"\u21B5"}
                </kbd>{" "}
                seleccionar
              </span>
              <span>
                <kbd className="rounded border border-gray-200 px-1 dark:border-gray-600">
                  esc
                </kbd>{" "}
                cerrar
              </span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
