"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  Shield,
  Eye,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  User,
  ExternalLink,
  Send,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Activa", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  MONITORING: { label: "Monitoreo", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  RESOLVED: { label: "Resuelta", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  DISMISSED: { label: "Descartada", color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  CRITICAL: { label: "Critica", color: "text-red-700 dark:text-red-400", border: "border-red-500" },
  HIGH: { label: "Alta", color: "text-orange-700 dark:text-orange-400", border: "border-orange-500" },
  MEDIUM: { label: "Media", color: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-500" },
};

const NOTE_TYPE_ICONS: Record<string, { icon: typeof MessageSquare; color: string }> = {
  NOTE: { icon: MessageSquare, color: "text-blue-500" },
  ACTION: { icon: CheckCircle, color: "text-green-500" },
  STATUS_CHANGE: { icon: Clock, color: "text-amber-500" },
};

export default function CrisisDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<"NOTE" | "ACTION">("NOTE");

  const { data: crisis, isLoading, refetch } = trpc.crisis.getById.useQuery({ id });
  const teamMembers = trpc.team.list.useQuery();

  const updateStatusMutation = trpc.crisis.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const addNoteMutation = trpc.crisis.addNote.useMutation({
    onSuccess: () => {
      setNoteContent("");
      refetch();
    },
  });

  const assignMutation = trpc.crisis.assignResponsible.useMutation({
    onSuccess: () => refetch(),
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    addNoteMutation.mutate({
      crisisAlertId: id,
      content: noteContent,
      type: noteType,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  if (!crisis) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/crisis" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> Volver a crisis
        </Link>
        <p className="text-gray-500 dark:text-gray-400">Crisis no encontrada.</p>
      </div>
    );
  }

  const sevConfig = SEVERITY_CONFIG[crisis.severity] || SEVERITY_CONFIG.MEDIUM;
  const statConfig = STATUS_CONFIG[crisis.status] || STATUS_CONFIG.ACTIVE;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/crisis" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft className="h-4 w-4" /> Volver a crisis
      </Link>

      {/* Header */}
      <div className={cn("rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20 border-l-4", sevConfig.border)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <AlertTriangle className={cn("h-6 w-6", sevConfig.color)} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Crisis - {crisis.client.name}
              </h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className={cn("rounded-full border px-3 py-1 text-sm font-medium", sevConfig.color,
                crisis.severity === "CRITICAL" ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20" :
                crisis.severity === "HIGH" ? "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20" :
                "border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20"
              )}>
                Severidad: {sevConfig.label}
              </span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium", statConfig.color)}>
                {statConfig.label}
              </span>
              {crisis.triggerType && (
                <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo: {crisis.triggerType}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Creada: {new Date(crisis.createdAt).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Status change buttons */}
          <div className="flex flex-wrap gap-2">
            {crisis.status === "ACTIVE" && (
              <>
                <button
                  onClick={() => updateStatusMutation.mutate({ id, status: "MONITORING" })}
                  disabled={updateStatusMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  Monitorear
                </button>
                <button
                  onClick={() => updateStatusMutation.mutate({ id, status: "RESOLVED" })}
                  disabled={updateStatusMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Resolver
                </button>
                <button
                  onClick={() => updateStatusMutation.mutate({ id, status: "DISMISSED" })}
                  disabled={updateStatusMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Descartar
                </button>
              </>
            )}
            {crisis.status === "MONITORING" && (
              <>
                <button
                  onClick={() => updateStatusMutation.mutate({ id, status: "RESOLVED" })}
                  disabled={updateStatusMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Resolver
                </button>
                <button
                  onClick={() => updateStatusMutation.mutate({ id, status: "DISMISSED" })}
                  disabled={updateStatusMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Descartar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Assigned */}
        <div className="mt-4 flex items-center gap-3">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Asignado a:</span>
          <select
            value={crisis.assignedToId || ""}
            onChange={(e) => assignMutation.mutate({ id, assignedToId: e.target.value || null })}
            className="rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
          >
            <option value="">Sin asignar</option>
            {teamMembers.data?.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Notes + Timeline */}
        <div className="space-y-6">
          {/* Add Note Form */}
          <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agregar nota</h3>
            <form onSubmit={handleAddNote} className="mt-4 space-y-3">
              <textarea
                rows={3}
                placeholder="Escribe una nota o accion..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteType("NOTE")}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      noteType === "NOTE"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}
                  >
                    Nota
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteType("ACTION")}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      noteType === "ACTION"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}
                  >
                    Accion
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!noteContent.trim() || addNoteMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {addNoteMutation.isPending ? "Guardando..." : "Agregar"}
                </button>
              </div>
            </form>
          </div>

          {/* Timeline */}
          <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Linea de tiempo</h3>
            <div className="mt-4 space-y-4">
              {/* Crisis creation event */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="mt-1 flex-1 border-l border-gray-200 dark:border-gray-700" />
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Crisis creada</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(crisis.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {crisis.crisisNotes.map((note, index) => {
                const noteConfig = NOTE_TYPE_ICONS[note.type] || NOTE_TYPE_ICONS.NOTE;
                const NoteIcon = noteConfig.icon;
                return (
                  <div key={note.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                        <NoteIcon className={cn("h-4 w-4", noteConfig.color)} />
                      </div>
                      {index < crisis.crisisNotes.length - 1 && (
                        <div className="mt-1 flex-1 border-l border-gray-200 dark:border-gray-700" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{note.content}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{note.user.name}</span>
                        <span>-</span>
                        <span>
                          {new Date(note.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {crisis.crisisNotes.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin notas aun.</p>
              )}
            </div>
          </div>
        </div>

        {/* Related Mentions */}
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Menciones negativas relacionadas</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Menciones negativas del cliente en las ultimas 24h de la crisis
          </p>
          <div className="mt-4 space-y-3">
            {crisis.relatedMentions && crisis.relatedMentions.length > 0 ? (
              crisis.relatedMentions.map((mention) => (
                <Link
                  key={mention.id}
                  href={`/dashboard/mentions/${mention.id}`}
                  className="block rounded-lg border dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {mention.article.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{mention.article.source}</span>
                    <span>-</span>
                    <span>
                      {new Date(mention.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {mention.article.url && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400">
                      <ExternalLink className="h-3 w-3" />
                      Ver articulo
                    </span>
                  )}
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No se encontraron menciones negativas relacionadas.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
