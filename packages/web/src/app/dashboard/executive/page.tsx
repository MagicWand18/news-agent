"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/cn";
import { useState } from "react";
import {
  Crown,
  Newspaper,
  Share2,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
} from "lucide-react";
import { StatCardSkeleton } from "@/components/stat-card";
import { CardGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { OrgCard } from "@/components/executive/org-card";
import { HealthScoreTable } from "@/components/executive/health-score-table";
import { ActivityHeatmap } from "@/components/executive/activity-heatmap";

const PERIOD_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "14 dias", value: 14 },
  { label: "30 dias", value: 30 },
];

export default function ExecutiveDashboardPage() {
  const [days, setDays] = useState(7);

  const kpis = trpc.executive.globalKPIs.useQuery({ days });
  const orgCards = trpc.executive.orgCards.useQuery({ days });
  const healthScores = trpc.executive.clientHealthScores.useQuery({ limit: 20 });
  const heatmap = trpc.executive.activityHeatmap.useQuery({ days: 30 });
  const inactivity = trpc.executive.inactivityAlerts.useQuery({ thresholdDays: 3 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Crown className="h-7 w-7 text-amber-500" />
            Dashboard Ejecutivo
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vision global de todas las organizaciones
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                days === opt.value
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {kpis.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : kpis.data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPICard
            icon={<Newspaper className="h-5 w-5 text-blue-500" />}
            label="Total Menciones"
            value={kpis.data.totalMentions.toLocaleString()}
            delta={kpis.data.mentionsDelta}
          />
          <KPICard
            icon={<Share2 className="h-5 w-5 text-purple-500" />}
            label="Menciones Sociales"
            value={kpis.data.totalSocialMentions.toLocaleString()}
            delta={kpis.data.socialDelta}
          />
          <KPICard
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            label="Crisis Activas"
            value={kpis.data.activeCrises}
            delta={kpis.data.crisesDelta}
            positiveIsGood={false}
          />
          <KPICard
            icon={<Users className="h-5 w-5 text-emerald-500" />}
            label="Clientes Activos"
            value={kpis.data.activeClients}
          />
        </div>
      ) : null}

      {/* Org Cards Grid */}
      {orgCards.isLoading && <CardGridSkeleton count={3} />}
      {orgCards.data && orgCards.data.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Por organizacion
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orgCards.data.map((org) => (
              <OrgCard key={org.orgId} data={org} />
            ))}
          </div>
        </div>
      )}

      {/* Health Score Ranking */}
      {healthScores.isLoading && <TableSkeleton rows={5} cols={4} />}
      {healthScores.data && healthScores.data.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Health Score de clientes
          </h3>
          <HealthScoreTable data={healthScores.data} />
        </div>
      )}

      {/* Activity Heatmap */}
      {heatmap.data && heatmap.data.length > 0 && (
        <ActivityHeatmap data={heatmap.data} />
      )}

      {/* Inactivity Alerts */}
      {inactivity.data && inactivity.data.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-900/20">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Alertas de inactividad
          </h3>
          <div className="space-y-2">
            {inactivity.data.map((alert) => {
              const neverHadActivity = alert.daysSinceActivity >= 999;
              return (
                <div
                  key={alert.clientId}
                  className="flex items-center justify-between rounded-lg border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {alert.clientName}
                    </span>
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {alert.orgName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {neverHadActivity
                        ? "Sin actividad registrada"
                        : `${alert.daysSinceActivity} dias sin actividad`}
                    </span>
                    {!neverHadActivity && (alert.lastMentionAt || alert.lastSocialMentionAt) && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Ultima: {new Date(
                          (alert.lastMentionAt && alert.lastSocialMentionAt
                            ? new Date(alert.lastMentionAt) > new Date(alert.lastSocialMentionAt)
                              ? alert.lastMentionAt
                              : alert.lastSocialMentionAt
                            : alert.lastMentionAt || alert.lastSocialMentionAt)!
                        ).toLocaleDateString("es-ES")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  delta,
  positiveIsGood = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  delta?: number;
  positiveIsGood?: boolean;
}) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;
  const isGood = positiveIsGood ? isPositive : isNegative;
  const isBad = positiveIsGood ? isNegative : isPositive;

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-900/20">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-0.5 text-xs font-medium",
            isGood
              ? "text-green-600 dark:text-green-400"
              : isBad
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : isNegative ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}% vs periodo anterior
        </div>
      )}
    </div>
  );
}
