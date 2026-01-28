"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Lightbulb } from "lucide-react";

const sentimentConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  POSITIVE: { label: "Positivo", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  NEGATIVE: { label: "Negativo", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  NEUTRAL: { label: "Neutral", bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
  MIXED: { label: "Mixto", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
};

const urgencyConfig: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Critico", color: "text-red-600 bg-red-50" },
  HIGH: { label: "Alto", color: "text-orange-600 bg-orange-50" },
  MEDIUM: { label: "Medio", color: "text-yellow-600 bg-yellow-50" },
  LOW: { label: "Bajo", color: "text-green-600 bg-green-50" },
};

export default function MentionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: mention, isLoading } = trpc.mentions.getById.useQuery({ id });

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
    </div>
  );
}
