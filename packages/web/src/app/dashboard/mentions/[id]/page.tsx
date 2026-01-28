"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { sentimentConfig, urgencyConfig } from "@/lib/mention-config";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Lightbulb, FileText, Copy, RefreshCw, X, Check } from "lucide-react";

const TONE_OPTIONS = [
  { value: "PROFESSIONAL", label: "Profesional", description: "Tono neutro y corporativo" },
  { value: "DEFENSIVE", label: "Defensivo", description: "Respuesta a criticas o acusaciones" },
  { value: "CLARIFICATION", label: "Aclaratorio", description: "Corregir informacion erronea" },
  { value: "CELEBRATORY", label: "Celebratorio", description: "Destacar logros o noticias positivas" },
] as const;

export default function MentionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [showModal, setShowModal] = useState(false);
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

  const { data: mention, isLoading } = trpc.mentions.getById.useQuery({ id });

  const generateMutation = trpc.mentions.generateResponse.useMutation({
    onSuccess: (data) => {
      setGeneratedResponse(data);
    },
  });

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

  const handleRegenerate = () => {
    setGeneratedResponse(null);
    generateMutation.mutate({ mentionId: id, tone: selectedTone });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!mention) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/mentions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Volver a menciones
        </Link>
        <p className="text-gray-500">Mencion no encontrada.</p>
      </div>
    );
  }

  const sent = sentimentConfig[mention.sentiment] || sentimentConfig.NEUTRAL;
  const urg = urgencyConfig[mention.urgency] || urgencyConfig.MEDIUM;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/mentions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Volver a menciones
      </Link>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900">{mention.article.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              <span className="font-medium text-gray-700">{mention.article.source}</span>
              <span className="text-gray-300">|</span>
              <span>{mention.client.name}</span>
              <span className="text-gray-300">|</span>
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
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              <FileText className="h-4 w-4" />
              Generar Comunicado
            </button>
            <a
              href={mention.article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
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
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
            Relevancia: {mention.relevance}/10
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
            Keyword: {mention.keywordMatched}
          </span>
        </div>
      </div>

      {/* AI Analysis */}
      {(mention.aiSummary || mention.aiAction) && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Analisis AI</h3>
          {mention.aiSummary && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-500">Resumen</p>
              <p className="mt-1 text-gray-700">{mention.aiSummary}</p>
            </div>
          )}
          {mention.aiAction && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500">Accion sugerida</p>
              <p className="mt-1 flex items-start gap-2 text-amber-700">
                <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {mention.aiAction}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {mention.tasks && mention.tasks.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Tareas asociadas</h3>
          <div className="mt-3 space-y-2">
            {mention.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-gray-700">{task.title}</span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  task.status === "COMPLETED" ? "bg-green-50 text-green-700" :
                  task.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" :
                  "bg-gray-50 text-gray-600"
                )}>
                  {task.status === "COMPLETED" ? "Completada" :
                   task.status === "IN_PROGRESS" ? "En progreso" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Article content */}
      {mention.article.content && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Contenido del articulo</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">
            {mention.article.content}
          </p>
        </div>
      )}

      {/* Generate Response Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <button
              onClick={() => {
                setShowModal(false);
                setGeneratedResponse(null);
              }}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900">Generar Comunicado de Prensa</h3>
            <p className="mt-1 text-sm text-gray-500">
              Genera un borrador de comunicado basado en esta mencion.
            </p>

            {!generatedResponse && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Tono del comunicado</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => setSelectedTone(tone.value)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        selectedTone === tone.value
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <span className="block text-sm font-medium text-gray-900">{tone.label}</span>
                      <span className="block text-xs text-gray-500">{tone.description}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isLoading}
                  className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {generateMutation.isLoading ? "Generando..." : "Generar Comunicado"}
                </button>
              </div>
            )}

            {generatedResponse && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Titulo</label>
                  <p className="mt-1 rounded-lg border bg-gray-50 p-3 text-sm text-gray-900">
                    {generatedResponse.title}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Cuerpo</label>
                  <p className="mt-1 whitespace-pre-line rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                    {generatedResponse.body}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tono</label>
                    <p className="mt-1 rounded-lg border bg-gray-50 p-2 text-sm text-gray-700">
                      {TONE_OPTIONS.find(t => t.value === generatedResponse.tone)?.label || generatedResponse.tone}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Audiencia</label>
                    <p className="mt-1 rounded-lg border bg-gray-50 p-2 text-sm text-gray-700">
                      {generatedResponse.audience}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Mensajes clave</label>
                  <ul className="mt-1 space-y-1 rounded-lg border bg-gray-50 p-3">
                    {generatedResponse.keyMessages.map((msg, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                        {msg}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Siguiente paso</label>
                  <p className="mt-1 rounded-lg border bg-amber-50 p-3 text-sm text-amber-700">
                    {generatedResponse.callToAction}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={generateMutation.isLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
                  >
                    <RefreshCw className={cn("h-4 w-4", generateMutation.isLoading && "animate-spin")} />
                    {generateMutation.isLoading ? "Generando..." : "Regenerar"}
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
