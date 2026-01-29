export const sentimentConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  POSITIVE: { label: "Positivo", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  NEGATIVE: { label: "Negativo", bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  NEUTRAL: { label: "Neutral", bg: "bg-gray-50 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-300", dot: "bg-gray-400" },
  MIXED: { label: "Mixto", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
};

export const urgencyConfig: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Crítico", color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30" },
  HIGH: { label: "Alto", color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30" },
  MEDIUM: { label: "Medio", color: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30" },
  LOW: { label: "Bajo", color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30" },
};
