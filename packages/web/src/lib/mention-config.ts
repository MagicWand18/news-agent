export const sentimentConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  POSITIVE: { label: "Positivo", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  NEGATIVE: { label: "Negativo", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  NEUTRAL: { label: "Neutral", bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
  MIXED: { label: "Mixto", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
};

export const urgencyConfig: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Critico", color: "text-red-600 bg-red-50" },
  HIGH: { label: "Alto", color: "text-orange-600 bg-orange-50" },
  MEDIUM: { label: "Medio", color: "text-yellow-600 bg-yellow-50" },
  LOW: { label: "Bajo", color: "text-green-600 bg-green-50" },
};
