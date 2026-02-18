/**
 * Tipos y constantes para eventos en tiempo real via Redis Pub/Sub → SSE.
 * Seguro para importar en client-side (no importa ioredis ni BullMQ).
 */

// Canales de Redis Pub/Sub
export const REALTIME_CHANNELS = {
  MENTION_NEW: "mediabot:mention:new",
  MENTION_ANALYZED: "mediabot:mention:analyzed",
  SOCIAL_NEW: "mediabot:social:new",
  CRISIS_NEW: "mediabot:crisis:new",
} as const;

export type RealtimeChannel = (typeof REALTIME_CHANNELS)[keyof typeof REALTIME_CHANNELS];

// Tipos de evento SSE (coinciden con los canales pero sin prefijo)
export const REALTIME_EVENT_TYPES = {
  MENTION_NEW: "mention:new",
  MENTION_ANALYZED: "mention:analyzed",
  SOCIAL_NEW: "social:new",
  CRISIS_NEW: "crisis:new",
} as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[keyof typeof REALTIME_EVENT_TYPES];

// Mapeo canal → tipo de evento
export const CHANNEL_TO_EVENT: Record<RealtimeChannel, RealtimeEventType> = {
  [REALTIME_CHANNELS.MENTION_NEW]: REALTIME_EVENT_TYPES.MENTION_NEW,
  [REALTIME_CHANNELS.MENTION_ANALYZED]: REALTIME_EVENT_TYPES.MENTION_ANALYZED,
  [REALTIME_CHANNELS.SOCIAL_NEW]: REALTIME_EVENT_TYPES.SOCIAL_NEW,
  [REALTIME_CHANNELS.CRISIS_NEW]: REALTIME_EVENT_TYPES.CRISIS_NEW,
};

export interface RealtimeEventData {
  id: string;
  clientId: string;
  orgId: string | null;
  title?: string;
  source?: string;
  sentiment?: string;
  urgency?: string;
  platform?: string;
  severity?: string;
  timestamp: string;
}

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: RealtimeEventData;
}
