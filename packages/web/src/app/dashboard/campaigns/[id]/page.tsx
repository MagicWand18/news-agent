"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Target,
  AlertTriangle,
  Newspaper,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  TrendingUp,
  TrendingDown,
  Heart,
  MessageSquare,
  Repeat2,
  Eye,
  Send,
  RefreshCw,
  Loader2,
  Calendar,
  ExternalLink,
  Trash2,
  Tag,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  ACTIVE: { label: "Activa", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PAUSED: { label: "Pausada", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  COMPLETED: { label: "Completada", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  CANCELLED: { label: "Cancelada", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [noteContent, setNoteContent] = useState("");

  const utils = trpc.useUtils();

  const { data: campaign, isLoading, refetch } = trpc.campaigns.getById.useQuery({ id });
  const stats = trpc.campaigns.getStats.useQuery({ id });
  const mentionsQuery = trpc.campaigns.getMentions.useQuery({ campaignId: id, limit: 10 });
  const socialMentionsQuery = trpc.campaigns.getSocialMentions.useQuery({ campaignId: id, limit: 10 });

  const updateMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => refetch(),
  });

  const addNoteMutation = trpc.campaigns.addNote.useMutation({
    onSuccess: () => {
      setNoteContent("");
      refetch();
    },
  });

  const autoLinkMutation = trpc.campaigns.autoLinkMentions.useMutation({
    onSuccess: () => {
      refetch();
      stats.refetch();
      mentionsQuery.refetch();
      socialMentionsQuery.refetch();
    },
  });

  const removeMentionMutation = trpc.campaigns.removeMention.useMutation({
    onSuccess: () => {
      stats.refetch();
      mentionsQuery.refetch();
    },
  });

  const removeSocialMentionMutation = trpc.campaigns.removeSocialMention.useMutation({
    onSuccess: () => {
      stats.refetch();
      socialMentionsQuery.refetch();
    },
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    addNoteMutation.mutate({ campaignId: id, content: noteContent });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/campaigns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4" /> Volver a campañas
        </Link>
        <p className="text-gray-500 dark:text-gray-400">Campaña no encontrada.</p>
      </div>
    );
  }

  const statConfig = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
  const availableTransitions = STATUS_TRANSITIONS[campaign.status] || [];
  const s = stats.data;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/campaigns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft className="h-4 w-4" /> Volver a campañas
      </Link>

      {/* Header */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {campaign.name}
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {campaign.client.name}
              {campaign.description && ` - ${campaign.description}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", statConfig.color)}>
                {statConfig.label}
              </span>
              {campaign.startDate && (
                <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(campaign.startDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  {campaign.endDate && (
                    <> - {new Date(campaign.endDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</>
                  )}
                </span>
              )}
              {campaign.crisisAlert && (
                <Link
                  href={`/dashboard/crisis/${campaign.crisisAlert.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/20 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Crisis vinculada ({campaign.crisisAlert.severity})
                </Link>
              )}
            </div>
            {campaign.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {campaign.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Status transitions + auto-link */}
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map((nextStatus) => {
              const conf = STATUS_CONFIG[nextStatus];
              return (
                <button
                  key={nextStatus}
                  onClick={() => updateMutation.mutate({ id, status: nextStatus as "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" })}
                  disabled={updateMutation.isPending}
                  className={cn("rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50", conf.color, "hover:opacity-80")}
                >
                  {conf.label}
                </button>
              );
            })}
            <button
              onClick={() => autoLinkMutation.mutate({ campaignId: id })}
              disabled={autoLinkMutation.isPending || !campaign.startDate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 disabled:opacity-50"
              title={!campaign.startDate ? "Necesita fecha de inicio" : "Auto-vincular menciones del periodo"}
            >
              {autoLinkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Auto-vincular
            </button>
          </div>
        </div>
        {autoLinkMutation.isSuccess && autoLinkMutation.data && (
          <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-2 text-sm text-green-700 dark:text-green-400">
            Vinculadas: {autoLinkMutation.data.linkedMentions} menciones + {autoLinkMutation.data.linkedSocialMentions} sociales
          </div>
        )}
      </div>

      {/* Stats */}
      {s && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Menciones medios"
              value={s.totalMentions}
              icon={<Newspaper className="h-5 w-5" />}
              delta={s.preCampaignStats ? s.totalMentions - s.preCampaignStats.mentions : undefined}
              deltaLabel="vs pre-campaña"
            />
            <StatCard
              label="Menciones sociales"
              value={s.totalSocialMentions}
              icon={<Share2 className="h-5 w-5" />}
              delta={s.preCampaignStats ? s.totalSocialMentions - s.preCampaignStats.socialMentions : undefined}
              deltaLabel="vs pre-campaña"
            />
            <StatCard
              label="Sentimiento positivo"
              value={`${s.currentPositiveRatio}%`}
              icon={<ThumbsUp className="h-5 w-5" />}
              delta={s.preCampaignStats ? s.currentPositiveRatio - s.preCampaignStats.positiveRatio : undefined}
              deltaLabel="pp vs pre"
              positiveIsGood
            />
            <StatCard
              label="Sentimiento negativo"
              value={`${s.currentNegativeRatio}%`}
              icon={<ThumbsDown className="h-5 w-5" />}
              delta={s.preCampaignStats ? s.currentNegativeRatio - s.preCampaignStats.negativeRatio : undefined}
              deltaLabel="pp vs pre"
              positiveIsGood={false}
            />
          </div>

          {/* Engagement */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Heart className="h-4 w-4" />
                <span className="text-xs font-medium">Likes</span>
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {s.engagement.likes.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs font-medium">Comentarios</span>
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {s.engagement.comments.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Repeat2 className="h-4 w-4" />
                <span className="text-xs font-medium">Shares</span>
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {s.engagement.shares.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Eye className="h-4 w-4" />
                <span className="text-xs font-medium">Views</span>
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {(s.engagement.views || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Pre-campaign comparison */}
          {s.preCampaignStats && (
            <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Comparativa pre-campaña vs campaña
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Periodo equivalente antes del inicio de la campaña
              </p>
              <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
                <ComparisonItem
                  label="Menciones"
                  before={s.preCampaignStats.mentions}
                  after={s.totalMentions}
                />
                <ComparisonItem
                  label="Social"
                  before={s.preCampaignStats.socialMentions}
                  after={s.totalSocialMentions}
                />
                <ComparisonItem
                  label="% Positivo"
                  before={s.preCampaignStats.positiveRatio}
                  after={s.currentPositiveRatio}
                  suffix="%"
                  positiveIsGood
                />
                <ComparisonItem
                  label="% Negativo"
                  before={s.preCampaignStats.negativeRatio}
                  after={s.currentNegativeRatio}
                  suffix="%"
                  positiveIsGood={false}
                />
              </div>
            </div>
          )}

          {/* Top Sources */}
          {s.topSources.length > 0 && (
            <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top fuentes
              </h3>
              <div className="mt-3 space-y-2">
                {s.topSources.map((src) => (
                  <div key={src.source} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{src.source}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{src.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Menciones vinculadas */}
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Menciones de medios ({campaign._count.mentions})
          </h3>
          <div className="mt-4 space-y-3">
            {mentionsQuery.data?.items.map((cm) => (
              <div key={cm.id} className="flex items-start justify-between gap-2 rounded-lg border dark:border-gray-700 p-3">
                <Link
                  href={`/dashboard/mentions/${cm.mention.id}`}
                  className="flex-1 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {cm.mention.article.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{cm.mention.article.source}</span>
                    <SentimentBadge sentiment={cm.mention.sentiment} />
                  </div>
                </Link>
                <button
                  onClick={() => removeMentionMutation.mutate({ campaignId: id, mentionId: cm.mention.id })}
                  className="rounded p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                  title="Desvincular"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {mentionsQuery.data?.items.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                Sin menciones vinculadas. Usa &quot;Auto-vincular&quot; para agregar menciones del periodo.
              </p>
            )}
          </div>
        </div>

        {/* Menciones sociales vinculadas */}
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Menciones sociales ({campaign._count.socialMentions})
          </h3>
          <div className="mt-4 space-y-3">
            {socialMentionsQuery.data?.items.map((csm) => (
              <div key={csm.id} className="flex items-start justify-between gap-2 rounded-lg border dark:border-gray-700 p-3">
                <Link
                  href={`/dashboard/social-mentions/${csm.socialMention.id}`}
                  className="flex-1 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                    {csm.socialMention.content || csm.socialMention.authorHandle}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="uppercase">{csm.socialMention.platform}</span>
                    <span>@{csm.socialMention.authorHandle}</span>
                    <SentimentBadge sentiment={csm.socialMention.sentiment} />
                  </div>
                </Link>
                <button
                  onClick={() => removeSocialMentionMutation.mutate({ campaignId: id, socialMentionId: csm.socialMention.id })}
                  className="rounded p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                  title="Desvincular"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {socialMentionsQuery.data?.items.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                Sin menciones sociales vinculadas.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notas de la campaña</h3>

        <form onSubmit={handleAddNote} className="mt-4 space-y-3">
          <textarea
            rows={2}
            placeholder="Agregar nota sobre la estrategia, resultados..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!noteContent.trim() || addNoteMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {addNoteMutation.isPending ? "Guardando..." : "Agregar nota"}
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-3">
          {campaign.notes.map((note) => (
            <div key={note.id} className="rounded-lg border dark:border-gray-700 p-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">{note.content}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{note.author.name}</span>
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
          ))}
          {campaign.notes.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin notas aun.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function StatCard({
  label,
  value,
  icon,
  delta,
  deltaLabel,
  positiveIsGood = true,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  positiveIsGood?: boolean;
}) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;
  const isGood = positiveIsGood ? isPositive : isNegative;
  const isBad = positiveIsGood ? isNegative : isPositive;

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-900/20">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {delta !== undefined && (
        <div className={cn(
          "mt-1 inline-flex items-center gap-0.5 text-xs font-medium",
          isGood ? "text-green-600 dark:text-green-400" : isBad ? "text-red-600 dark:text-red-400" : "text-gray-500"
        )}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {delta > 0 ? "+" : ""}{delta} {deltaLabel}
        </div>
      )}
    </div>
  );
}

function ComparisonItem({
  label,
  before,
  after,
  suffix = "",
  positiveIsGood = true,
}: {
  label: string;
  before: number;
  after: number;
  suffix?: string;
  positiveIsGood?: boolean;
}) {
  const delta = after - before;
  const isGood = positiveIsGood ? delta > 0 : delta < 0;
  const isBad = positiveIsGood ? delta < 0 : delta > 0;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-sm text-gray-400 line-through">{before}{suffix}</span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">{after}{suffix}</span>
      </div>
      <span className={cn(
        "text-xs font-medium",
        isGood ? "text-green-600 dark:text-green-400" : isBad ? "text-red-600 dark:text-red-400" : "text-gray-500"
      )}>
        {delta > 0 ? "+" : ""}{delta}{suffix}
      </span>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config: Record<string, { label: string; color: string }> = {
    POSITIVE: { label: "Positivo", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    NEGATIVE: { label: "Negativo", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    NEUTRAL: { label: "Neutral", color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" },
    MIXED: { label: "Mixto", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  };
  const c = config[sentiment] || config.NEUTRAL;
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", c.color)}>
      {c.label}
    </span>
  );
}
