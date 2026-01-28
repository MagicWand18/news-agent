import { prisma } from "./prisma";
import type { SettingType } from "@prisma/client";

// In-memory cache with TTL
interface CachedSetting {
  value: string;
  type: SettingType;
  expiresAt: number;
}

const cache = new Map<string, CachedSetting>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// Default settings that will be seeded if not present
export const DEFAULT_SETTINGS: Record<string, { value: string; type: SettingType; category: string; label: string; description: string }> = {
  "prefilter.confidence_threshold": {
    value: "0.6",
    type: "NUMBER",
    category: "analysis",
    label: "Umbral de confianza pre-filtro",
    description: "Confianza minima del AI para considerar una mencion relevante (0-1)",
  },
  "urgency.critical_min_relevance": {
    value: "8",
    type: "NUMBER",
    category: "analysis",
    label: "Relevancia minima CRITICAL",
    description: "Relevancia minima (1-10) para urgencia CRITICAL",
  },
  "urgency.high_min_relevance": {
    value: "7",
    type: "NUMBER",
    category: "analysis",
    label: "Relevancia minima HIGH",
    description: "Relevancia minima (1-10) para urgencia HIGH",
  },
  "urgency.medium_min_relevance": {
    value: "4",
    type: "NUMBER",
    category: "analysis",
    label: "Relevancia minima MEDIUM",
    description: "Relevancia minima (1-10) para urgencia MEDIUM",
  },
  "digest.top_mentions_count": {
    value: "5",
    type: "NUMBER",
    category: "notifications",
    label: "Menciones en digest",
    description: "Numero de menciones destacadas en el digest diario",
  },
  "digest.client_top_mentions": {
    value: "3",
    type: "NUMBER",
    category: "notifications",
    label: "Menciones enviadas a cliente",
    description: "Numero de menciones enviadas al grupo del cliente",
  },
  "mentions.default_page_size": {
    value: "30",
    type: "NUMBER",
    category: "ui",
    label: "Menciones por pagina",
    description: "Numero de menciones mostradas por pagina en el dashboard",
  },
  "dashboard.recent_mentions_limit": {
    value: "10",
    type: "NUMBER",
    category: "ui",
    label: "Menciones recientes dashboard",
    description: "Numero de menciones recientes en el dashboard principal",
  },
  "crisis.negative_spike_threshold": {
    value: "3",
    type: "NUMBER",
    category: "crisis",
    label: "Umbral de menciones negativas",
    description: "Numero de menciones negativas en ventana de tiempo para activar alerta de crisis",
  },
  "crisis.window_minutes": {
    value: "60",
    type: "NUMBER",
    category: "crisis",
    label: "Ventana de tiempo (minutos)",
    description: "Ventana de tiempo en minutos para detectar crisis",
  },
};

/**
 * Get a setting value with caching
 */
export async function getSettingValue<T = string>(
  key: string,
  defaultValue: T
): Promise<T> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return parseValue(cached.value, cached.type) as T;
  }

  // Fetch from database
  const setting = await prisma.setting.findUnique({
    where: { key },
  });

  if (!setting) {
    // Return default, no caching for missing keys
    return defaultValue;
  }

  // Update cache
  cache.set(key, {
    value: setting.value,
    type: setting.type,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return parseValue(setting.value, setting.type) as T;
}

/**
 * Get a numeric setting value
 */
export async function getSettingNumber(key: string, defaultValue: number): Promise<number> {
  const value = await getSettingValue(key, String(defaultValue));
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get a boolean setting value
 */
export async function getSettingBoolean(key: string, defaultValue: boolean): Promise<boolean> {
  const value = await getSettingValue(key, String(defaultValue));
  return String(value).toLowerCase() === "true";
}

/**
 * Set a setting value (also updates cache)
 */
export async function setSettingValue(
  key: string,
  value: string,
  type?: SettingType
): Promise<void> {
  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value, updatedAt: new Date() },
    create: {
      key,
      value,
      type: type || "STRING",
      category: DEFAULT_SETTINGS[key]?.category || "general",
      label: DEFAULT_SETTINGS[key]?.label,
      description: DEFAULT_SETTINGS[key]?.description,
    },
  });

  // Update cache
  cache.set(key, {
    value: setting.value,
    type: setting.type,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Get all settings, optionally filtered by category
 */
export async function getAllSettings(category?: string) {
  const where = category ? { category } : {};
  return prisma.setting.findMany({
    where,
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
}

/**
 * Invalidate cache for a specific key or all keys
 */
export function invalidateSettingsCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Seed default settings if they don't exist
 */
export async function seedDefaultSettings(): Promise<void> {
  for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (!existing) {
      await prisma.setting.create({
        data: {
          key,
          value: config.value,
          type: config.type,
          category: config.category,
          label: config.label,
          description: config.description,
        },
      });
      console.log(`Setting seeded: ${key} = ${config.value}`);
    }
  }
}

/**
 * Parse value based on type
 */
function parseValue(value: string, type: SettingType): string | number | boolean | object {
  switch (type) {
    case "NUMBER":
      return parseFloat(value);
    case "BOOLEAN":
      return value.toLowerCase() === "true";
    case "JSON":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}
