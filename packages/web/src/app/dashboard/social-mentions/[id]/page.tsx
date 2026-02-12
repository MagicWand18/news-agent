"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { sentimentConfig } from "@/lib/mention-config";
import { useParams, useRouter } from "next/navigation";
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
  Trash2,
} from "lucide-react";
import { TwitterIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/platform-icons";

const platformConfig: Record<string, { icon: typeof TwitterIcon; label: string; bg: string; text: string }> = {
  TWITTER: { icon: TwitterIcon, label: "Twitter", bg: "bg-black dark:bg-gray-800", text: "text-white" },
  INSTAGRAM: { icon: InstagramIcon, label: "Instagram", bg: "bg-gradient-to-r from-purple-500 to-pink-500", text: "text-white" },
  TIKTOK: { icon: TikTokIcon, label: "TikTok", bg: "bg-black dark:bg-gray-800", text: "text-white" },
  YOUTUBE: { icon: YouTubeIcon, label: "YouTube", bg: "bg-red-600", text: "text-white" },
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
  const router = useRouter();
  const id = params.id as string;
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showExtractOptions, setShowExtractOptions] = useState(false);
  const [selectedMaxComments, setSelectedMaxComments] = useState(30);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
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
      let commentsFound = false;
      pollingRef.current = setInterval(async () => {
        attempts++;
        const result = await refetch();
        const comments = (result.data?.commentsData as unknown[]) || [];
        const analyzed = result.data?.commentsAnalyzed ?? false;
        const postAnalyzed = result.data?.analyzed ?? false;

        if (!commentsFound && comments.length > 0) {
          commentsFound = true;
          setExtractionMessage(`${comments.length} comentarios extraidos. Analizando sentimiento...`);
        }

        // Esperar a que tanto los comentarios como el análisis completo estén listos
        if (commentsFound && analyzed && postAnalyzed) {
          stopPolling();
          setExtractionMessage(`${comments.length} comentarios analizados exitosamente`);
        } else if (attempts >= 20) {
          stopPolling();
          if (commentsFound) {
            setExtractionMessage(`${comments.length} comentarios extraidos. El analisis puede tardar unos minutos.`);
          } else {
            setExtractionMessage("La extraccion esta tomando mas tiempo del esperado. Revisa en unos minutos.");
          }
        } else if (!commentsFound) {
          setExtractionMessage(`Esperando resultados... (intento ${attempts}/20)`);
        }
      }, 3000);
    },
    onError: (error) => {
      setExtractionMessage(error.message);
    },
  });

  const deleteMutation = trpc.social.deleteSocialMention.useMutation({
    onSuccess: () => {
      router.push("/dashboard/social-mentions");
    },
    onError: (error) => {
      setDeleteMessage(error.message);
      setShowDeleteConfirm(false);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ id });
  };

  const handleExtractComments = () => {
    setExtractionMessage(null);
    setShowExtractOptions(false);
    extractCommentsMutation.mutate({ mentionId: id, maxComments: selectedMaxComments });
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
              <div className="relative">
                {extractCommentsMutation.isPending || isPolling ? (
                  <button
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isPolling ? "Esperando..." : "Extrayendo..."}
                  </button>
                ) : showExtractOptions ? (
                  <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 p-3 shadow-lg min-w-[200px]">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Comentarios a extraer
                    </p>
                    <select
                      value={selectedMaxComments}
                      onChange={(e) => setSelectedMaxComments(Number(e.target.value))}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200"
                    >
                      <option value={10}>10 comentarios</option>
                      <option value={30}>30 comentarios</option>
                      <option value={60}>60 comentarios</option>
                      <option value={100}>100 comentarios</option>
                    </select>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setShowExtractOptions(false)}
                        className="flex-1 rounded-md px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleExtractComments}
                        className="flex-1 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
                      >
                        Extraer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowExtractOptions(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                  >
                    <Download className="h-4 w-4" />
                    Extraer comentarios
                  </button>
                )}
              </div>
            )}
            {/* Botón eliminar */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          </div>
        </div>

        {/* Modal de confirmación de eliminación */}
        {showDeleteConfirm && (
          <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Eliminar esta mencion permanentemente?
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Se eliminaran las metricas de engagement, analisis de sentimiento, resumen IA y comentarios extraidos.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Eliminando..." : "Confirmar eliminacion"}
              </button>
            </div>
          </div>
        )}

        {/* Mensaje de error de eliminación */}
        {deleteMessage && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {deleteMessage}
          </div>
        )}

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
          {/* Sentimiento de comentarios */}
          {mention.commentsAnalyzed && mention.commentsSentiment ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                (sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).bg,
                (sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).text,
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Comentarios: {(sentimentConfig[mention.commentsSentiment] || sentimentConfig.NEUTRAL).label}
            </span>
          ) : null}
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
            <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-line">{mention.aiSummary}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-400 dark:text-gray-500 italic">
            Analisis pendiente. Se procesara automaticamente.
          </p>
        )}
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
