"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { sentimentConfig, urgencyConfig } from "@/lib/mention-config";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Lightbulb,
  FileText,
  Copy,
  RefreshCw,
  X,
  Check,
  CheckSquare,
  Save,
} from "lucide-react";

const TONE_OPTIONS = [
  { value: "PROFESSIONAL", label: "Profesional", description: "Tono neutro y corporativo" },
  { value: "DEFENSIVE", label: "Defensivo", description: "Respuesta a criticas o acusaciones" },
  { value: "CLARIFICATION", label: "Aclaratorio", description: "Corregir informacion erronea" },
  { value: "CELEBRATORY", label: "Celebratorio", description: "Destacar logros o noticias positivas" },
] as const;

const URGENCY_TO_PRIORITY: Record<string, "URGENT" | "HIGH" | "MEDIUM" | "LOW"> = {
  CRITICAL: "URGENT",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  IN_REVIEW: { label: "En revision", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  APPROVED: { label: "Aprobado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PUBLISHED: { label: "Publicado", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  DISCARDED: { label: "Descartado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default function MentionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [showModal, setShowModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTone, setSelectedTone] = useState<"PROFESSIONAL" | "DEFENSIVE" | "CLARIFICATION" | "CELEBRATORY">("PROFESSIONAL");
  const [generatedResponse, setGeneratedResponse] = useState<{
    title: string;
    body: string;
    tone: string;
    audience: string;
    callToAction: string;
    keyMessages: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "MEDIUM" as "URGENT" | "HIGH" | "MEDIUM" | "LOW" });

  const { data: mention, isLoading, refetch } = trpc.mentions.getById.useQuery({ id });

  const generateMutation = trpc.mentions.generateResponse.useMutation({
    onSuccess: (data) => {
      setGeneratedResponse(data);
    },
  });

  const saveResponseMutation = trpc.responses.create.useMutation({
    onSuccess: () => {
      setSaved(true);
      responseDrafts.refetch();
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const createTaskMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      setShowTaskModal(false);
      setTaskForm({ title: "", description: "", priority: "MEDIUM" });
      refetch();
    },
  });

  // Historial de respuestas generadas para esta mencion
  const responseDrafts = trpc.responses.list.useQuery({ mentionId: id, limit: 10 });

  const handleGenerate = () => {
    generateMutation.mutate({ mentionId: id, tone: selectedTone });
  };

  const handleCopy = async () => {
    if (!generatedResponse) return;
    const text = `${generatedResponse.title}\n\n${generatedResponse.body}\n\nMensajes clave:\n${generatedResponse.keyMessages.map(m => `- ${m}`).join("\n")}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveResponse = () => {
    if (!generatedResponse) return;
    saveResponseMutation.mutate({
      title: generatedResponse.title,
      body: generatedResponse.body,
      tone: generatedResponse.tone,
      audience: generatedResponse.audience,
      callToAction: generatedResponse.callToAction,
      keyMessages: generatedResponse.keyMessages,
      mentionId: id,
    });
  };

  const handleRegenerate = () => {
    setGeneratedResponse(null);
    setSaved(false);
    generateMutation.mutate({ mentionId: id, tone: selectedTone });
  };

  const openTaskModal = () => {
    if (!mention) return;
    const priority = URGENCY_TO_PRIORITY[mention.urgency] || "MEDIUM";
    setTaskForm({
      title: (mention.aiSummary || mention.article.title).slice(0, 100),
      description: mention.aiAction || `Mencion en ${mention.article.source}: ${mention.article.title}`,
      priority,
    });
    setShowTaskModal(true);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mention) return;
    createTaskMutation.mutate({
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      clientId: mention.client.id,
      mentionId: id,
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

  if (!mention) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/mentions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> Volver a menciones
        </Link>
        <p className="text-gray-500 dark:text-gray-400">Mencion no encontrada.</p>
      </div>
    );
  }

  const sent = sentimentConfig[mention.sentiment] || sentimentConfig.NEUTRAL;
  const urg = urgencyConfig[mention.urgency] || urgencyConfig.MEDIUM;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/mentions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft className="h-4 w-4" /> Volver a menciones
      </Link>

      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{mention.article.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300">{mention.article.source}</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{mention.client.name}</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>
                {new Date(mention.article.publishedAt || mention.createdAt).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openTaskModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 transition-colors hover:bg-green-100 dark:hover:bg-green-900/40"
            >
              <CheckSquare className="h-4 w-4" />
              Crear tarea
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-400 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            >
              <FileText className="h-4 w-4" />
              Generar Comunicado
            </button>
            <a
              href={mention.article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300 transition-colors hover:bg-brand-100 dark:hover:bg-brand-900/50"
            >
              <ExternalLink className="h-4 w-4" />
              Ver articulo
            </a>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
              sent.bg,
              sent.text
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", sent.dot)} />
            {sent.label}
          </span>
          <span className={cn("rounded-full px-3 py-1 text-sm font-medium", urg.color)}>
            Urgencia: {urg.label}
          </span>
          <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Relevancia: {mention.relevance}/10
          </span>
          <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Keyword: {mention.keywordMatched}
          </span>
        </div>
      </div>

      {/* AI Analysis */}
      {(mention.aiSummary || mention.aiAction) && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analisis AI</h3>
          {mention.aiSummary && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Resumen</p>
              <p className="mt-1 text-gray-700 dark:text-gray-300">{mention.aiSummary}</p>
            </div>
          )}
          {mention.aiAction && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Accion sugerida</p>
              <p className="mt-1 flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {mention.aiAction}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {mention.tasks && mention.tasks.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tareas asociadas</h3>
          <div className="mt-3 space-y-2">
            {mention.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg border dark:border-gray-700 p-3">
                <span className="text-sm text-gray-700 dark:text-gray-300">{task.title}</span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  task.status === "COMPLETED" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  task.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                  "bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                )}>
                  {task.status === "COMPLETED" ? "Completada" :
                   task.status === "IN_PROGRESS" ? "En progreso" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Drafts History */}
      {responseDrafts.data?.drafts && responseDrafts.data.drafts.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Comunicados generados</h3>
          <div className="mt-3 space-y-2">
            {responseDrafts.data.drafts.map((draft) => {
              const statusInfo = STATUS_LABELS[draft.status] || STATUS_LABELS.DRAFT;
              return (
                <div key={draft.id} className="flex items-center justify-between rounded-lg border dark:border-gray-700 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{draft.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(draft.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {draft.createdBy && ` por ${draft.createdBy.name}`}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Article content */}
      {mention.article.content && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Contenido del articulo</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {mention.article.content}
          </p>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <button
              onClick={() => setShowTaskModal(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Crear tarea desde mencion</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Se vinculara automaticamente a esta mencion y al cliente {mention.client.name}.
            </p>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Titulo</label>
                <input
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descripcion</label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prioridad</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as "URGENT" | "HIGH" | "MEDIUM" | "LOW" })}
                  className="mt-1 w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="URGENT">Urgente</option>
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LOW">Baja</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {createTaskMutation.isPending ? "Creando..." : "Crear tarea"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Response Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <button
              onClick={() => {
                setShowModal(false);
                setGeneratedResponse(null);
                setSaved(false);
              }}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generar Comunicado de Prensa</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Genera un borrador de comunicado basado en esta mencion.
            </p>

            {!generatedResponse && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tono del comunicado</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => setSelectedTone(tone.value)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        selectedTone === tone.value
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-400"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      )}
                    >
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">{tone.label}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{tone.description}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {generateMutation.isPending ? "Generando..." : "Generar Comunicado"}
                </button>
              </div>
            )}

            {generatedResponse && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Titulo</label>
                  <p className="mt-1 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-3 text-sm text-gray-900 dark:text-white">
                    {generatedResponse.title}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cuerpo</label>
                  <p className="mt-1 whitespace-pre-line rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-3 text-sm text-gray-700 dark:text-gray-300">
                    {generatedResponse.body}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tono</label>
                    <p className="mt-1 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-2 text-sm text-gray-700 dark:text-gray-300">
                      {TONE_OPTIONS.find(t => t.value === generatedResponse.tone)?.label || generatedResponse.tone}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Audiencia</label>
                    <p className="mt-1 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-2 text-sm text-gray-700 dark:text-gray-300">
                      {generatedResponse.audience}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mensajes clave</label>
                  <ul className="mt-1 space-y-1 rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-3">
                    {generatedResponse.keyMessages.map((msg, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                        {msg}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Siguiente paso</label>
                  <p className="mt-1 rounded-lg border dark:border-gray-600 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-400">
                    {generatedResponse.callToAction}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    onClick={handleSaveResponse}
                    disabled={saveResponseMutation.isPending || saved}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400 transition-colors hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50"
                  >
                    {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {saved ? "Guardado" : saveResponseMutation.isPending ? "Guardando..." : "Guardar borrador"}
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={generateMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
                  >
                    <RefreshCw className={cn("h-4 w-4", generateMutation.isPending && "animate-spin")} />
                    {generateMutation.isPending ? "Generando..." : "Regenerar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
