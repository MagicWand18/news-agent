const sentimentLabels: Record<string, string> = {
  POSITIVE: "Positivo",
  NEGATIVE: "Negativo",
  NEUTRAL: "Neutral",
  MIXED: "Mixto",
};

const urgencyLabels: Record<string, string> = {
  CRITICAL: "Critico",
  HIGH: "Alto",
  MEDIUM: "Medio",
  LOW: "Bajo",
};

interface MentionForExport {
  id: string;
  createdAt: Date;
  sentiment: string;
  urgency: string;
  relevance: number;
  keywordMatched: string;
  aiSummary: string | null;
  aiAction: string | null;
  article: {
    title: string;
    source: string;
    url: string;
    publishedAt: Date | null;
  };
  client: {
    name: string;
  };
}

function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  // Escape double quotes by doubling them, and wrap in quotes if contains special chars
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString();
}

export function exportMentionsToCsv(mentions: MentionForExport[]): void {
  const headers = [
    "ID",
    "Cliente",
    "Titulo",
    "Fuente",
    "URL",
    "Fecha Publicacion",
    "Fecha Deteccion",
    "Sentimiento",
    "Urgencia",
    "Relevancia",
    "Keyword",
    "Resumen AI",
    "Accion Sugerida",
  ];

  const rows = mentions.map((m) => [
    m.id,
    escapeCSVField(m.client.name),
    escapeCSVField(m.article.title),
    escapeCSVField(m.article.source),
    m.article.url,
    formatDate(m.article.publishedAt),
    formatDate(m.createdAt),
    sentimentLabels[m.sentiment] || m.sentiment,
    urgencyLabels[m.urgency] || m.urgency,
    m.relevance,
    escapeCSVField(m.keywordMatched),
    escapeCSVField(m.aiSummary),
    escapeCSVField(m.aiAction),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });

  // Generate filename with date
  const date = new Date().toISOString().split("T")[0];
  const filename = `menciones-${date}.csv`;

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
