"use client";

import { cn } from "@/lib/cn";
import { sentimentConfig, urgencyConfig } from "@/lib/mention-config";
import { ExternalLink, TrendingUp, BarChart3 } from "lucide-react";
import Link from "next/link";

interface MentionData {
  id: string;
  sentiment: string;
  relevance: number;
  urgency: string;
  createdAt: Date;
  aiSummary?: string | null;
  article: {
    title: string;
    source: string;
    url: string;
  };
  client: {
    name: string;
  };
}

interface MentionTimelineProps {
  mentions: MentionData[];
  className?: string;
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

function getSourceInitial(source: string): string {
  return source.charAt(0).toUpperCase();
}

function getSentimentBorderColor(sentiment: string): string {
  switch (sentiment) {
    case "POSITIVE":
      return "border-l-emerald-500";
    case "NEGATIVE":
      return "border-l-red-500";
    case "MIXED":
      return "border-l-amber-500";
    default:
      return "border-l-gray-400";
  }
}

export function MentionTimeline({ mentions, className }: MentionTimelineProps) {
  if (!mentions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <TrendingUp className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No hay menciones recientes</p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Vertical line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200" />

      {/* Timeline items */}
      <div className="space-y-4">
        {mentions.map((mention, index) => (
          <TimelineItem key={mention.id} mention={mention} index={index} />
        ))}
      </div>
    </div>
  );
}

interface TimelineItemProps {
  mention: MentionData;
  index: number;
}

function TimelineItem({ mention, index }: TimelineItemProps) {
  const sent = sentimentConfig[mention.sentiment] || sentimentConfig.NEUTRAL;
  const urg = urgencyConfig[mention.urgency] || urgencyConfig.MEDIUM;

  return (
    <div
      className="timeline-item relative flex gap-4 pl-2"
      style={{
        animationDelay: `${index * 75}ms`,
      }}
    >
      {/* Connector dot */}
      <div className="relative z-10 flex-shrink-0">
        <div
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-transform hover:scale-110",
            sent.bg,
            sent.text
          )}
        >
          {getSourceInitial(mention.article.source)}
        </div>
      </div>

      {/* Card */}
      <div
        className={cn(
          "flex-1 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md",
          "border-l-4",
          getSentimentBorderColor(mention.sentiment)
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">{mention.article.source}</span>
              <span className="text-gray-300">|</span>
              <span>{timeAgo(mention.createdAt)}</span>
            </div>
            <Link
              href={`/dashboard/mentions/${mention.id}`}
              className="mt-1 block font-medium text-gray-900 transition-colors hover:text-brand-600 line-clamp-2"
            >
              {mention.article.title}
            </Link>
          </div>

          {/* Sentiment badge */}
          <span
            className={cn(
              "flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              sent.bg,
              sent.text
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", sent.dot)} />
            {sent.label}
          </span>
        </div>

        {/* Summary */}
        {mention.aiSummary && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
            {mention.aiSummary}
          </p>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
          <div className="flex items-center gap-4 text-xs">
            {/* Client */}
            <span className="font-medium text-brand-600">{mention.client.name}</span>

            {/* Urgency */}
            <span className={cn("rounded px-1.5 py-0.5 font-medium", urg.color)}>
              {urg.label}
            </span>

            {/* Relevance */}
            <div className="flex items-center gap-1.5 text-gray-500">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Rel: {mention.relevance}/10</span>
            </div>
          </div>

          {/* External link */}
          <a
            href={mention.article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand-600 transition-colors hover:text-brand-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ver articulo</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function MentionTimelineSkeleton() {
  return (
    <div className="relative">
      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="relative flex gap-4 pl-2 animate-pulse">
            <div className="h-9 w-9 rounded-full bg-gray-200" />
            <div className="flex-1 rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded bg-gray-200" />
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                </div>
                <div className="h-5 w-16 rounded-full bg-gray-200" />
              </div>
              <div className="mt-3 h-3 w-full rounded bg-gray-100" />
              <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                <div className="h-3 w-32 rounded bg-gray-100" />
                <div className="h-3 w-16 rounded bg-gray-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
