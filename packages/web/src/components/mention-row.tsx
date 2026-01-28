import { cn } from "@/lib/cn";
import { sentimentConfig, urgencyConfig } from "@/lib/mention-config";
import { ExternalLink, Lightbulb } from "lucide-react";
import Link from "next/link";

interface MentionRowProps {
  id: string;
  title: string;
  source: string;
  clientName: string;
  sentiment: string;
  relevance: number;
  urgency: string;
  date: Date;
  url: string;
  summary?: string | null;
  action?: string | null;
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

export function MentionRow({
  id,
  title,
  source,
  clientName,
  sentiment,
  relevance,
  urgency,
  date,
  url,
  summary,
  action,
}: MentionRowProps) {
  const sent = sentimentConfig[sentiment] || sentimentConfig.NEUTRAL;
  const urg = urgencyConfig[urgency] || urgencyConfig.MEDIUM;

  return (
    <div className="group border-b border-gray-100 py-4 transition-colors last:border-0 hover:bg-gray-50/50">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/dashboard/mentions/${id}`}
            className="inline-flex items-center gap-1.5 font-medium text-gray-900 transition-colors hover:text-brand-600"
          >
            <span className="line-clamp-1">{title}</span>
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span className="font-medium text-gray-600">{source}</span>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span>{clientName}</span>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span className="text-gray-400">{timeAgo(date)}</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Ver articulo</span>
            </a>
          </div>
          {summary && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600">
              {summary}
            </p>
          )}
          {action && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-amber-700">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{action}</span>
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          {/* Sentiment badge */}
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
          {/* Relevance + Urgency */}
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-semibold", urg.color)}>
              {urg.label}
            </span>
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${(relevance / 10) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-500">{relevance}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MentionRowSkeleton() {
  return (
    <div className="animate-pulse border-b border-gray-100 py-4 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-100" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-20 rounded-full bg-gray-100" />
          <div className="h-4 w-16 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
