import { cn } from "@/lib/cn";
import { sentimentConfig } from "@/lib/mention-config";
import { ExternalLink, Heart, MessageCircle, Share2, Eye, Hash, AtSign, Search } from "lucide-react";
import Link from "next/link";
import { TwitterIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/platform-icons";

const platformConfig: Record<string, { icon: typeof TwitterIcon; label: string; bg: string; text: string }> = {
  TWITTER: { icon: TwitterIcon, label: "Twitter", bg: "bg-black dark:bg-gray-800", text: "text-white" },
  INSTAGRAM: { icon: InstagramIcon, label: "Instagram", bg: "bg-gradient-to-r from-purple-500 to-pink-500", text: "text-white" },
  TIKTOK: { icon: TikTokIcon, label: "TikTok", bg: "bg-black dark:bg-gray-800", text: "text-white" },
  YOUTUBE: { icon: YouTubeIcon, label: "YouTube", bg: "bg-red-600", text: "text-white" },
};

const sourceTypeConfig: Record<string, { icon: typeof Hash; label: string; color: string }> = {
  HANDLE: { icon: AtSign, label: "Cuenta", color: "text-blue-600 dark:text-blue-400" },
  HASHTAG: { icon: Hash, label: "Hashtag", color: "text-purple-600 dark:text-purple-400" },
  KEYWORD: { icon: Search, label: "Keyword", color: "text-amber-600 dark:text-amber-400" },
};

interface SocialMentionRowProps {
  id: string;
  platform: string;
  postUrl: string;
  content: string | null;
  authorHandle: string;
  authorName: string | null;
  authorFollowers: number | null;
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
  sentiment: string | null;
  relevance: number | null;
  sourceType: string;
  sourceValue: string;
  clientName: string;
  postedAt: Date | null;
  createdAt: Date;
  commentsAnalyzed?: boolean;
  commentsSentiment?: string | null;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function timeAgo(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function SocialMentionRow({
  id,
  platform,
  postUrl,
  content,
  authorHandle,
  authorName,
  authorFollowers,
  likes,
  comments,
  shares,
  views,
  sentiment,
  relevance,
  sourceType,
  sourceValue,
  clientName,
  postedAt,
  createdAt,
  commentsAnalyzed,
  commentsSentiment,
  selected,
  onToggleSelect,
}: SocialMentionRowProps) {
  const plat = platformConfig[platform] || platformConfig.TWITTER;
  const PlatformIcon = plat.icon;
  const sent = sentimentConfig[sentiment || "NEUTRAL"] || sentimentConfig.NEUTRAL;
  const source = sourceTypeConfig[sourceType] || sourceTypeConfig.HANDLE;
  const SourceIcon = source.icon;
  const displayDate = postedAt ? new Date(postedAt) : new Date(createdAt);

  return (
    <div className="group border-b border-gray-100 dark:border-gray-700 py-4 transition-colors last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
      <div className="flex items-start gap-4">
        {/* Checkbox de selección */}
        {onToggleSelect && (
          <label className="flex flex-shrink-0 items-center pt-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selected || false}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
            />
          </label>
        )}

        {/* Badge de plataforma */}
        <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg", plat.bg)}>
          <PlatformIcon className={cn("h-5 w-5", plat.text)} />
        </div>

        {/* Contenido principal */}
        <div className="min-w-0 flex-1">
          {/* Header: autor y metadata */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/dashboard/social-mentions/${id}`}
              className="font-medium text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400"
            >
              @{authorHandle}
            </Link>
            {authorName && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{authorName}</span>
            )}
            {authorFollowers !== null && authorFollowers > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatNumber(authorFollowers)} seguidores
              </span>
            )}
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{clientName}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(displayDate)}</span>
          </div>

          {/* Contenido del post */}
          {content && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {content}
            </p>
          )}

          {/* Métricas de engagement */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {formatNumber(likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {formatNumber(comments)}
            </span>
            {shares > 0 && (
              <span className="inline-flex items-center gap-1">
                <Share2 className="h-3.5 w-3.5" />
                {formatNumber(shares)}
              </span>
            )}
            {views !== null && views > 0 && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {formatNumber(views)}
              </span>
            )}
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className={cn("inline-flex items-center gap-1", source.color)}>
              <SourceIcon className="h-3.5 w-3.5" />
              {sourceValue}
            </span>
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              <ExternalLink className="h-3 w-3" />
              Ver post
            </a>
          </div>
        </div>

        {/* Badges de sentimiento, emoción y relevancia */}
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          {sentiment && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                sent.bg,
                sent.text
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", sent.dot)} />
              {sent.label}
            </span>
          )}
          {/* Emoción pública basada en comentarios */}
          {commentsAnalyzed && commentsSentiment ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                (sentimentConfig[commentsSentiment] || sentimentConfig.NEUTRAL).bg,
                (sentimentConfig[commentsSentiment] || sentimentConfig.NEUTRAL).text,
              )}
            >
              <MessageCircle className="h-3 w-3" />
              {(sentimentConfig[commentsSentiment] || sentimentConfig.NEUTRAL).label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-400 dark:text-gray-500">
              <MessageCircle className="h-3 w-3" />
              N/A
            </span>
          )}
          {relevance !== null && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${(relevance / 10) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{relevance}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SocialMentionRowSkeleton() {
  return (
    <div className="animate-pulse border-b border-gray-100 dark:border-gray-700 py-4 last:border-0">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-600" />
          <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-600" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-20 rounded-full bg-gray-100 dark:bg-gray-600" />
          <div className="h-4 w-16 rounded bg-gray-100 dark:bg-gray-600" />
        </div>
      </div>
    </div>
  );
}
