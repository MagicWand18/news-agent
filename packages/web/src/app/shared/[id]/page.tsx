"use client";

import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  FileText,
  Target,
  Users,
  Clock,
  AlertTriangle,
  Newspaper,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Eye,
  Zap,
  BarChart3,
} from "lucide-react";

export default function SharedReportPage() {
  const params = useParams();
  const publicId = params.id as string;

  const { data, isLoading } = trpc.reports.getSharedReport.useQuery({ publicId });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (data?.error === "not_found") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
            Reporte no encontrado
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            El reporte que buscas no existe o ha sido eliminado.
          </p>
        </div>
      </div>
    );
  }

  if (data?.error === "expired") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Clock className="mx-auto h-12 w-12 text-amber-400" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
            Reporte expirado
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Este enlace ha expirado. Solicita un nuevo link al equipo de comunicacion.
          </p>
        </div>
      </div>
    );
  }

  const report = data?.report;
  if (!report) return null;

  const reportData = report.data as Record<string, unknown>;
  const reportType = (reportData.type as string) || report.type;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Newspaper className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">MediaBot</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Reporte compartido
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{report.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {report.client.name} — Generado el{" "}
            {new Date(report.createdAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {reportType === "CAMPAIGN" && <CampaignReport data={reportData} />}
        {reportType === "BRIEF" && <BriefReport data={reportData} />}
        {reportType === "CLIENT_SUMMARY" && <ClientSummaryReport data={reportData} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mt-12">
        <div className="mx-auto max-w-4xl px-6 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
          Generado por MediaBot — Plataforma de Monitoreo de Medios
        </div>
      </footer>
    </div>
  );
}

// --- Campaign Report ---
function CampaignReport({ data }: { data: Record<string, unknown> }) {
  const campaign = data.campaign as {
    name: string;
    description?: string;
    status: string;
    startDate?: string;
    endDate?: string;
    _count: { mentions: number; socialMentions: number };
    notes: Array<{ content: string; author: { name: string }; createdAt: string }>;
  };

  if (!campaign) return <p className="text-gray-500">Sin datos de campaña.</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{campaign.name}</h2>
        </div>
        {campaign.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{campaign.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>Estado: {campaign.status}</span>
          {campaign.startDate && (
            <span>
              Inicio: {new Date(campaign.startDate).toLocaleDateString("es-ES")}
            </span>
          )}
          {campaign.endDate && (
            <span>
              Fin: {new Date(campaign.endDate).toLocaleDateString("es-ES")}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<Newspaper className="h-4 w-4" />} label="Menciones medios" value={campaign._count.mentions} />
        <StatCard icon={<Share2 className="h-4 w-4" />} label="Menciones sociales" value={campaign._count.socialMentions} />
      </div>

      {campaign.notes && campaign.notes.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Notas</h3>
          <div className="space-y-3">
            {campaign.notes.map((note, i) => (
              <div key={i} className="rounded-lg border dark:border-gray-700 p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">{note.content}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {note.author.name} — {new Date(note.createdAt).toLocaleDateString("es-ES")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Brief Report ---
function BriefReport({ data }: { data: Record<string, unknown> }) {
  const brief = data.brief as {
    date: string;
    content: {
      highlights: string[];
      comparison: { mentionsDelta: number; sentimentShift: string; sovChange: string };
      watchList: string[];
      emergingTopics: string[];
      pendingActions: string[];
    };
    stats: {
      mentions: number;
      sov: number;
      socialPosts: number;
      engagement: number;
    };
    client: { name: string };
  };

  if (!brief) return <p className="text-gray-500">Sin datos de brief.</p>;

  const { content, stats } = brief;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Menciones" value={stats.mentions ?? 0} />
        <StatCard icon={<BarChart3 className="h-4 w-4" />} label="SOV" value={`${(stats.sov ?? 0).toFixed(1)}%`} />
        <StatCard icon={<Share2 className="h-4 w-4" />} label="Posts sociales" value={stats.socialPosts ?? 0} />
        <StatCard icon={<Share2 className="h-4 w-4" />} label="Engagement" value={formatNumber(stats.engagement ?? 0)} />
      </div>

      {content.highlights?.length > 0 && (
        <Section title="Puntos clave" icon={<Lightbulb className="h-4 w-4 text-amber-500" />}>
          <ul className="space-y-2">
            {content.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
                {h}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {content.watchList?.length > 0 && (
        <Section title="Que vigilar" icon={<Eye className="h-4 w-4 text-blue-500" />}>
          <ul className="space-y-2">
            {content.watchList.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Eye className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {content.emergingTopics?.length > 0 && (
        <Section title="Temas emergentes" icon={<Zap className="h-4 w-4 text-amber-500" />}>
          <div className="flex flex-wrap gap-2">
            {content.emergingTopics.map((t, i) => (
              <span key={i} className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {content.pendingActions?.length > 0 && (
        <Section title="Acciones sugeridas" icon={<Zap className="h-4 w-4 text-purple-500" />}>
          <ul className="space-y-2">
            {content.pendingActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-500" />
                {a}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// --- Client Summary Report ---
function ClientSummaryReport({ data }: { data: Record<string, unknown> }) {
  const client = data.client as { name: string; industry?: string };
  const stats = data.stats as {
    mentionCount: number;
    socialCount: number;
    sentiment: Record<string, number>;
  };

  if (!client) return <p className="text-gray-500">Sin datos de cliente.</p>;

  const sentimentTotal = Object.values(stats?.sentiment || {}).reduce((a, b) => a + b, 0);
  const positiveRatio = sentimentTotal > 0
    ? Math.round(((stats?.sentiment?.POSITIVE || 0) / sentimentTotal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{client.name}</h2>
        </div>
        {client.industry && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Industria: {client.industry}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard icon={<Newspaper className="h-4 w-4" />} label="Menciones (30d)" value={stats?.mentionCount ?? 0} />
        <StatCard icon={<Share2 className="h-4 w-4" />} label="Social (30d)" value={stats?.socialCount ?? 0} />
        <StatCard icon={<ThumbsUp className="h-4 w-4" />} label="% Positivo" value={`${positiveRatio}%`} />
      </div>

      {stats?.sentiment && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Sentimiento</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Object.entries(stats.sentiment).map(([key, value]) => (
              <div key={key}>
                <span className="text-xs text-gray-500 dark:text-gray-400">{getSentimentLabel(key)}</span>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Shared Helpers ---
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm">
      <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getSentimentLabel(s: string): string {
  const labels: Record<string, string> = { POSITIVE: "Positivo", NEGATIVE: "Negativo", NEUTRAL: "Neutral", MIXED: "Mixto" };
  return labels[s] || s;
}
