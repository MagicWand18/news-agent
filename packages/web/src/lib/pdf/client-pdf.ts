import {
  COLORS,
  createPDFDocument,
  formatDate,
  pdfToBuffer,
  renderFooter,
  renderHeader,
  renderKPIGrid,
  renderSectionTitle,
  renderTable,
} from "./pdf-utils";

export interface ClientPDFData {
  clientName: string;
  industry?: string | null;
  days: number;
  totalMentions: number;
  totalSocialMentions: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  avgSentiment: number;
  topSources: Array<{ source: string; count: number }>;
  mentionsByWeek: Array<{ week: string; count: number }>;
  crises: Array<{
    id: string;
    severity: string;
    status: string;
    createdAt: Date | string;
  }>;
  campaigns: Array<{ name: string; status: string }>;
}

/**
 * Genera un PDF con el reporte general de un cliente
 */
export async function generateClientPDF(
  data: ClientPDFData
): Promise<Buffer> {
  const doc = createPDFDocument(`Reporte - ${data.clientName}`);
  const bufferPromise = pdfToBuffer(doc);

  // Portada: nombre del cliente y periodo
  const subtitle = [
    data.industry ? `Industria: ${data.industry}` : null,
    `Ultimos ${data.days} dias`,
  ]
    .filter(Boolean)
    .join(" | ");

  renderHeader(doc, data.clientName, subtitle);

  // Seccion 1: KPIs principales
  renderSectionTitle(doc, "Resumen de Metricas");

  const totalSentiment =
    data.sentimentBreakdown.positive +
    data.sentimentBreakdown.negative +
    data.sentimentBreakdown.neutral +
    data.sentimentBreakdown.mixed;

  const positivePercent =
    totalSentiment > 0
      ? ((data.sentimentBreakdown.positive / totalSentiment) * 100).toFixed(1)
      : "0.0";

  const negativePercent =
    totalSentiment > 0
      ? ((data.sentimentBreakdown.negative / totalSentiment) * 100).toFixed(1)
      : "0.0";

  renderKPIGrid(doc, [
    { label: "Menciones (prensa)", value: data.totalMentions },
    { label: "Menciones (redes sociales)", value: data.totalSocialMentions },
    { label: "% Sentimiento positivo", value: `${positivePercent}%` },
    { label: "% Sentimiento negativo", value: `${negativePercent}%` },
    {
      label: "Sentimiento promedio",
      value: data.avgSentiment.toFixed(2),
    },
    {
      label: "Total combinado",
      value: data.totalMentions + data.totalSocialMentions,
    },
  ]);

  // Desglose completo de sentimiento
  doc
    .fillColor(COLORS.secondary)
    .fontSize(9)
    .font("Helvetica")
    .text(
      `Desglose: Positivo ${data.sentimentBreakdown.positive} | Negativo ${data.sentimentBreakdown.negative} | Neutral ${data.sentimentBreakdown.neutral} | Mixto ${data.sentimentBreakdown.mixed}`
    );

  doc.moveDown(0.5);

  // Seccion 2: Tendencia semanal de menciones
  if (data.mentionsByWeek.length > 0) {
    renderSectionTitle(doc, "Tendencia Semanal de Menciones");

    renderTable(
      doc,
      ["Semana", "Menciones"],
      data.mentionsByWeek.map((w) => [w.week, String(w.count)]),
      [370, 125]
    );

    doc.moveDown(0.3);
  }

  // Seccion 3: Fuentes principales
  if (data.topSources.length > 0) {
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
      renderFooter(doc);
    }

    renderSectionTitle(doc, "Fuentes Principales");

    renderTable(
      doc,
      ["Fuente", "Menciones"],
      data.topSources.slice(0, 10).map((s) => [s.source, String(s.count)]),
      [370, 125]
    );

    doc.moveDown(0.3);
  }

  // Seccion 4: Crisis (si hay)
  if (data.crises.length > 0) {
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
      renderFooter(doc);
    }

    renderSectionTitle(doc, "Alertas de Crisis");

    const severityLabels: Record<string, string> = {
      LOW: "Baja",
      MEDIUM: "Media",
      HIGH: "Alta",
      CRITICAL: "Critica",
    };

    const statusLabels: Record<string, string> = {
      ACTIVE: "Activa",
      MONITORING: "Monitoreo",
      RESOLVED: "Resuelta",
      DISMISSED: "Descartada",
    };

    renderTable(
      doc,
      ["ID", "Severidad", "Estado", "Fecha"],
      data.crises.slice(0, 15).map((c) => [
        c.id.slice(0, 8),
        severityLabels[c.severity] || c.severity,
        statusLabels[c.status] || c.status,
        formatDate(c.createdAt),
      ]),
      [80, 120, 120, 175]
    );

    // Resumen de crisis
    const activeCrises = data.crises.filter(
      (c) => c.status === "ACTIVE" || c.status === "MONITORING"
    ).length;
    const resolvedCrises = data.crises.filter(
      (c) => c.status === "RESOLVED"
    ).length;

    doc.moveDown(0.3);
    doc
      .fillColor(COLORS.secondary)
      .fontSize(9)
      .font("Helvetica")
      .text(
        `Total: ${data.crises.length} | Activas/Monitoreo: ${activeCrises} | Resueltas: ${resolvedCrises}`
      );

    doc.moveDown(0.3);
  }

  // Seccion 5: Campanas activas
  if (data.campaigns.length > 0) {
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
      renderFooter(doc);
    }

    renderSectionTitle(doc, "Campanas");

    const campaignStatusLabels: Record<string, string> = {
      DRAFT: "Borrador",
      ACTIVE: "Activa",
      PAUSED: "Pausada",
      COMPLETED: "Completada",
      CANCELLED: "Cancelada",
    };

    renderTable(
      doc,
      ["Nombre", "Estado"],
      data.campaigns.slice(0, 10).map((c) => [
        c.name,
        campaignStatusLabels[c.status] || c.status,
      ]),
      [370, 125]
    );

    doc.moveDown(0.3);
  }

  // Footer en todas las paginas
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    renderFooter(doc);
  }

  doc.end();
  return bufferPromise;
}
