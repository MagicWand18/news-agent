import { cn } from "@/lib/cn";
import { sentimentConfig } from "@/lib/mention-config";
import { ExternalLink, Heart, MessageCircle, Share2, Eye, Hash, AtSign, Search } from "lucide-react";
import Link from "next/link";

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

        {/* Badges de sentimiento y relevancia */}
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
