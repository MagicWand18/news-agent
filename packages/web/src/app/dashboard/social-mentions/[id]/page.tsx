"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { sentimentConfig } from "@/lib/mention-config";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Users,
  Calendar,
  Hash,
  AtSign,
  Search,
  Download,
  Loader2,
  ThumbsUp,
  AlertTriangle,
} from "lucide-react";

// Iconos de plataformas
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
    </svg>
  );
}

const platformConfig: Record<string, { icon: typeof TwitterIcon; label: string; bg: string; text: string }> = {
  TWITTER: { icon: TwitterIcon, label: "Twitter", bg: "bg-black dark:bg-gray-800", text: "text-white" },
  INSTAGRAM: { icon: InstagramIcon, label: "Instagram", bg: "bg-gradient-to-r from-purple-500 to-pink-500", text: "text-white" },
  TIKTOK: { icon: TikTokIcon, label: "TikTok", bg: "bg-black dark:bg-gray-800", text: "text-white" },
};

const sourceTypeConfig: Record<string, { icon: typeof Hash; label: string }> = {
  HANDLE: { icon: AtSign, label: "Cuenta monitoreada" },
  HASHTAG: { icon: Hash, label: "Hashtag" },
  KEYWORD: { icon: Search, label: "Keyword" },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

// Tipo para comentarios extraídos
interface ExtractedComment {
  commentId: string;
  text: string;
  authorHandle: string;
  authorName: string | null;
  likes: number;
  replies: number;
  postedAt: string | null;
}

export default function SocialMentionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Limpiar polling al desmontar
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const { data: mention, isLoading, refetch } = trpc.social.getSocialMentionById.useQuery({ id });
  const extractCommentsMutation = trpc.social.extractComments.useMutation({
    onSuccess: (data) => {
      setExtractionMessage(data.message);
      setIsPolling(true);
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        const result = await refetch();
        const comments = (result.data?.commentsData as unknown[]) || [];
        if (comments.length > 0) {
          stopPolling();
          setExtractionMessage(`${comments.length} comentarios extraidos exitosamente`);
        } else if (attempts >= 10) {
          stopPolling();
          setExtractionMessage("La extraccion esta tomando mas tiempo del esperado. Revisa en unos minutos.");
        } else {
          setExtractionMessage(`Esperando resultados... (intento ${attempts}/10)`);
        }
      }, 3000);
    },
    onError: (error) => {
      setExtractionMessage(error.message);
    },
  });

  const handleExtractComments = () => {
    setExtractionMessage(null);
    extractCommentsMutation.mutate({ mentionId: id });
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
        <Link
          href="/dashboard/social-mentions"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a redes sociales
        </Link>
        <p className="text-gray-500 dark:text-gray-400">Mencion no encontrada.</p>
      </div>
    );
  }

  const plat = platformConfig[mention.platform] || platformConfig.TWITTER;
  const PlatformIcon = plat.icon;
  const sent = sentimentConfig[mention.sentiment || "NEUTRAL"] || sentimentConfig.NEUTRAL;
  const source = sourceTypeConfig[mention.sourceType] || sourceTypeConfig.HANDLE;
  const SourceIcon = source.icon;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/social-mentions"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a redes sociales
      </Link>

      {/* Header con info del post */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <div className="flex items-start gap-4">
          {/* Badge de plataforma grande */}
          <div className={cn("flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl", plat.bg)}>
            <PlatformIcon className={cn("h-7 w-7", plat.text)} />
          </div>

          <div className="min-w-0 flex-1">
            {/* Autor */}
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">@{mention.authorHandle}</h2>
              {mention.authorName && (
                <span className="text-gray-500 dark:text-gray-400">{mention.authorName}</span>
              )}
            </div>

            {/* Metadata */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              {mention.authorFollowers !== null && mention.authorFollowers > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {formatNumber(mention.authorFollowers)} seguidores
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(mention.postedAt || mention.createdAt).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-gray-700 dark:text-gray-300">{mention.client.name}</span>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col gap-2">
            <a
              href={mention.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 px-4 py-2 text-sm font-medium text-brand-700 dark:text-brand-300 transition-colors hover:bg-brand-100 dark:hover:bg-brand-900/50"
            >
              <ExternalLink className="h-4 w-4" />
              Ver post original
            </a>
            {/* Botón extraer comentarios (solo Instagram y TikTok) */}
            {mention.platform !== "TWITTER" && (
              <button
                onClick={handleExtractComments}
                disabled={extractCommentsMutation.isPending || isPolling}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  extractCommentsMutation.isPending || isPolling
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                )}
              >
                {extractCommentsMutation.isPending || isPolling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isPolling ? "Esperando..." : "Extrayendo..."}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Extraer comentarios
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mensaje de extracción */}
        {extractionMessage && (
          <div className={cn(
            "mt-4 rounded-lg px-4 py-3 text-sm",
            extractCommentsMutation.isError
              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
              : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
          )}>
            {extractionMessage}
          </div>
        )}

        {/* Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium", plat.bg, plat.text)}>
            <PlatformIcon className="h-4 w-4" />
            {plat.label}
          </span>
          {/* Sentimiento del post (basado en análisis IA del texto) */}
          {mention.sentiment && (
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
          )}
          {/* Emoción pública (basada en comentarios) */}
          {mention.commentsAnalyzed && mention.commentsSentiment ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                (sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).bg,
                (sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).text,
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Emocion: {(sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm font-medium text-gray-500 dark:text-gray-400">
              <MessageCircle className="h-3.5 w-3.5" />
              Emocion: N/A
            </span>
          )}
          {mention.relevance !== null && (
            <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              Relevancia: {mention.relevance}/10
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            <SourceIcon className="h-4 w-4" />
            {source.label}: {mention.sourceValue}
          </span>
        </div>
      </div>

      {/* Métricas de engagement */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Heart className="h-5 w-5 text-red-500" />} label="Likes" value={mention.likes} />
        <MetricCard icon={<MessageCircle className="h-5 w-5 text-blue-500" />} label="Comentarios" value={mention.comments} />
        <MetricCard icon={<Share2 className="h-5 w-5 text-green-500" />} label="Compartidos" value={mention.shares} />
        {mention.views !== null && (
          <MetricCard icon={<Eye className="h-5 w-5 text-purple-500" />} label="Vistas" value={mention.views} />
        )}
      </div>

      {/* Contenido del post */}
      {mention.content && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Contenido</h3>
          <p className="mt-3 whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
            {mention.content}
          </p>
        </div>
      )}

      {/* Análisis IA */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analisis IA</h3>

        {mention.aiSummary ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Resumen</p>
            <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-line">{mention.aiSummary}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-400 dark:text-gray-500 italic">
            Analisis pendiente. Se procesará automaticamente.
          </p>
        )}

        {/* Detalle de sentimientos */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sentimiento del post</p>
            {mention.sentiment ? (
              <div className="mt-2 flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", sent.bg, sent.text)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", sent.dot)} />
                  {sent.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Basado en el contenido del texto
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-400">Pendiente de analisis</p>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Emocion publica (comentarios)</p>
            {mention.commentsAnalyzed && mention.commentsSentiment ? (
              <div className="mt-2 flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  (sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).bg,
                  (sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).text,
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", (sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).dot)} />
                  {(sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Promedio de {mention.commentsCount || 0} comentarios
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-400">
                N/A — {mention.commentsData ? "Analisis en proceso" : "Extrae comentarios para analizar emocion"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sección de comentarios extraídos */}
      {mention.commentsData && (mention.commentsData as unknown as ExtractedComment[]).length > 0 && (
        <CommentsSection
          comments={mention.commentsData as unknown as ExtractedComment[]}
          commentsCount={mention.commentsCount || 0}
          commentsSentiment={mention.commentsSentiment}
          commentsExtractedAt={mention.commentsExtractedAt}
          commentsAnalyzed={mention.commentsAnalyzed}
        />
      )}

      {/* Info adicional */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Informacion adicional</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Post ID</dt>
            <dd className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">{mention.postId}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Detectado</dt>
            <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {new Date(mention.createdAt).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipo de fuente</dt>
            <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{source.label}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Valor de fuente</dt>
            <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{mention.sourceValue}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(value)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Sección de comentarios extraídos con análisis de sentimiento.
 */
function CommentsSection({
  comments,
  commentsCount,
  commentsSentiment,
  commentsExtractedAt,
  commentsAnalyzed,
}: {
  comments: ExtractedComment[];
  commentsCount: number;
  commentsSentiment: string | null;
  commentsExtractedAt: Date | string | null;
  commentsAnalyzed: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayComments = showAll ? comments : comments.slice(0, 5);

  // Configuración de sentimiento de comentarios
  const commentsSentimentConfig = commentsSentiment
    ? sentimentConfig[commentsSentiment] || sentimentConfig.NEUTRAL
    : null;

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Comentarios extraidos
          </h3>
          <span className="rounded-full bg-purple-100 dark:bg-purple-900/30 px-2.5 py-0.5 text-sm font-medium text-purple-700 dark:text-purple-300">
            {commentsCount} comentarios
          </span>
        </div>
        {commentsExtractedAt && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Extraidos: {new Date(commentsExtractedAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Sentimiento de comentarios */}
      {commentsSentimentConfig && commentsAnalyzed && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Sentimiento publico:
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
              commentsSentimentConfig.bg,
              commentsSentimentConfig.text
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", commentsSentimentConfig.dot)} />
            {commentsSentimentConfig.label}
          </span>
          {commentsSentiment === "NEGATIVE" && (
            <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Requiere atencion
            </span>
          )}
        </div>
      )}

      {!commentsAnalyzed && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analizando sentimiento de comentarios...
        </div>
      )}

      {/* Lista de comentarios */}
      <div className="mt-4 space-y-3">
        {displayComments.map((comment, index) => (
          <div
            key={comment.commentId || index}
            className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    @{comment.authorHandle}
                  </span>
                  {comment.authorName && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {comment.authorName}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.text}
                </p>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {formatNumber(comment.likes)}
                  </span>
                  {comment.replies > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {comment.replies}
                    </span>
                  )}
                  {comment.postedAt && (
                    <span>
                      {new Date(comment.postedAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ver más/menos */}
      {comments.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
        >
          {showAll ? "Ver menos" : `Ver todos (${comments.length})`}
        </button>
      )}
    </div>
  );
}
