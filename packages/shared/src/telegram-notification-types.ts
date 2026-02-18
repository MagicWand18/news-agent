/**
 * Tipos de notificación Telegram y sus metadatos.
 * Se manejan como constantes (no enum Prisma) para evitar migraciones al agregar tipos.
 */
export const TELEGRAM_NOTIFICATION_TYPES = {
  MENTION_ALERT: {
    key: "MENTION_ALERT",
    label: "Alertas de menciones",
    description: "Menciones con urgencia CRITICA o ALTA detectadas en medios",
  },
  CRISIS_ALERT: {
    key: "CRISIS_ALERT",
    label: "Alertas de crisis",
    description: "Pico de menciones negativas detectado automaticamente",
  },
  EMERGING_TOPIC: {
    key: "EMERGING_TOPIC",
    label: "Temas emergentes",
    description: "Nuevos temas ganando traccion en medios cada 4 horas",
  },
  DAILY_DIGEST: {
    key: "DAILY_DIGEST",
    label: "Digest diario",
    description: "Resumen completo diario de menciones, social y AI brief",
  },
  ALERT_RULE: {
    key: "ALERT_RULE",
    label: "Reglas de alerta",
    description: "Cuando se activa una regla configurada (SOV, competencia, sentimiento)",
  },
  CRISIS_STATUS: {
    key: "CRISIS_STATUS",
    label: "Cambio de estado de crisis",
    description: "Cuando una crisis se resuelve, escala o cambia de estado",
  },
  RESPONSE_DRAFT: {
    key: "RESPONSE_DRAFT",
    label: "Borrador de comunicado",
    description: "Cuando se genera un nuevo borrador de respuesta con IA",
  },
  BRIEF_READY: {
    key: "BRIEF_READY",
    label: "Brief diario listo",
    description: "Aviso ejecutivo cuando el brief del dia esta disponible",
  },
  CAMPAIGN_REPORT: {
    key: "CAMPAIGN_REPORT",
    label: "Reporte de campana",
    description: "Resumen semanal de metricas de campanas activas",
  },
  WEEKLY_REPORT: {
    key: "WEEKLY_REPORT",
    label: "Reporte semanal",
    description: "Reporte semanal completo con metricas agregadas",
  },
  TOPIC_ALERT: {
    key: "TOPIC_ALERT",
    label: "Alertas por tema",
    description: "Notificaciones cuando un tema nuevo emerge, escala o cambia de sentimiento",
  },
} as const;

export type TelegramNotifType = keyof typeof TELEGRAM_NOTIFICATION_TYPES;

/**
 * Verifica si un tipo de notificación está habilitado en las preferencias.
 * Si preferences es null/undefined, todo está ON (comportamiento por defecto).
 */
export function isNotifTypeEnabled(
  preferences: Record<string, boolean> | null | undefined,
  notifType: TelegramNotifType
): boolean {
  if (!preferences) return true;
  return preferences[notifType] !== false;
}
