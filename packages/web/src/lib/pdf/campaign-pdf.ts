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

export interface CampaignPDFData {
  campaignName: string;
  clientName: string;
  status: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  description?: string | null;
  totalMentions: number;
  totalSocialMentions: number;
  currentPositiveRatio: number;
  currentNegativeRatio: number;
  engagement: { likes: number; comments: number; shares: number; views: number };
  preCampaignStats?: {
    mentions: number;
    socialMentions: number;
    positiveRatio: number;
    negativeRatio: number;
  } | null;
  topSources: Array<{ source: string; count: number }>;
  notes: Array<{ content: string; authorName: string; createdAt: Date | string }>;
}

/**
 * Genera un PDF con el reporte completo de una campana
 */
export async function generateCampaignPDF(
  data: CampaignPDFData
): Promise<Buffer> {
  const doc = createPDFDocument(`Campana - ${data.campaignName}`);
  const bufferPromise = pdfToBuffer(doc);

  // --- Pagina 1: Portada y KPIs ---
  const statusLabels: Record<string, string> = {
    DRAFT: "Borrador",
    ACTIVE: "Activa",
    PAUSED: "Pausada",
    COMPLETED: "Completada",
    CANCELLED: "Cancelada",
  };

  const dateRange = [
    data.startDate ? formatDate(data.startDate) : "Sin fecha",
    data.endDate ? formatDate(data.endDate) : "En curso",
  ].join(" — ");

  renderHeader(doc, data.campaignName, `${data.clientName} | ${dateRange}`);

  // Estado de la campana
  doc
    .fillColor(COLORS.secondary)
    .fontSize(11)
    .font("Helvetica")
    .text(`Estado: `, { continued: true })
    .font("Helvetica-Bold")
    .fillColor(COLORS.primary)
    .text(statusLabels[data.status] || data.status);

  if (data.description) {
    doc.moveDown(0.5);
    doc
      .fillColor(COLORS.text)
      .fontSize(10)
      .font("Helvetica")
      .text(data.description, { lineGap: 3 });
  }

  doc.moveDown(0.5);

  // Seccion 1: KPIs principales
  renderSectionTitle(doc, "Metricas Principales");

  renderKPIGrid(doc, [
    { label: "Menciones (prensa)", value: data.totalMentions },
    { label: "Menciones (redes)", value: data.totalSocialMentions },
    {
      label: "Sentimiento positivo",
      value: `${data.currentPositiveRatio.toFixed(1)}%`,
    },
    {
      label: "Sentimiento negativo",
      value: `${data.currentNegativeRatio.toFixed(1)}%`,
    },
  ]);

  // Seccion 2: Comparativa pre-campana
  if (data.preCampaignStats) {
    renderSectionTitle(doc, "Comparativa Pre-Campana");

    const mentionsDelta =
      data.preCampaignStats.mentions > 0
        ? (
            ((data.totalMentions - data.preCampaignStats.mentions) /
              data.preCampaignStats.mentions) *
            100
          ).toFixed(1)
        : "N/A";

    const socialDelta =
      data.preCampaignStats.socialMentions > 0
        ? (
            ((data.totalSocialMentions -
              data.preCampaignStats.socialMentions) /
              data.preCampaignStats.socialMentions) *
            100
          ).toFixed(1)
        : "N/A";

    const positiveDelta =
      data.preCampaignStats.positiveRatio > 0
        ? (
            data.currentPositiveRatio - data.preCampaignStats.positiveRatio
          ).toFixed(1)
        : "N/A";

    const negativeDelta =
      data.preCampaignStats.negativeRatio > 0
        ? (
            data.currentNegativeRatio - data.preCampaignStats.negativeRatio
          ).toFixed(1)
        : "N/A";

    renderTable(
      doc,
      ["Metrica", "Pre-Campana", "Campana", "Cambio (%)"],
      [
        [
          "Menciones (prensa)",
          String(data.preCampaignStats.mentions),
          String(data.totalMentions),
          mentionsDelta === "N/A" ? mentionsDelta : `${mentionsDelta}%`,
        ],
        [
          "Menciones (redes)",
          String(data.preCampaignStats.socialMentions),
          String(data.totalSocialMentions),
          socialDelta === "N/A" ? socialDelta : `${socialDelta}%`,
        ],
        [
          "% Positivo",
          `${data.preCampaignStats.positiveRatio.toFixed(1)}%`,
          `${data.currentPositiveRatio.toFixed(1)}%`,
          positiveDelta === "N/A" ? positiveDelta : `${positiveDelta}pp`,
        ],
        [
          "% Negativo",
          `${data.preCampaignStats.negativeRatio.toFixed(1)}%`,
          `${data.currentNegativeRatio.toFixed(1)}%`,
          negativeDelta === "N/A" ? negativeDelta : `${negativeDelta}pp`,
        ],
      ],
      [130, 110, 110, 145]
    );

    doc.moveDown(0.3);
  }

  // Seccion 3: Fuentes principales
  if (data.topSources.length > 0) {
    renderSectionTitle(doc, "Fuentes Principales");

    renderTable(
      doc,
      ["Fuente", "Menciones"],
      data.topSources.slice(0, 10).map((s) => [s.source, String(s.count)]),
      [370, 125]
    );

    doc.moveDown(0.3);
  }

  // Seccion 4: Engagement en redes sociales
  renderSectionTitle(doc, "Engagement en Redes Sociales");

  renderKPIGrid(doc, [
    {
      label: "Likes",
      value: data.engagement.likes.toLocaleString("es-ES"),
    },
    {
      label: "Comentarios",
      value: data.engagement.comments.toLocaleString("es-ES"),
    },
    {
      label: "Compartidos",
      value: data.engagement.shares.toLocaleString("es-ES"),
    },
    {
      label: "Visualizaciones",
      value: data.engagement.views.toLocaleString("es-ES"),
    },
  ]);

  // Seccion 5: Notas y observaciones
  if (data.notes.length > 0) {
    // Verificar espacio, agregar pagina si es necesario
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
      renderFooter(doc);
    }

    renderSectionTitle(doc, "Notas y Observaciones");

    for (const note of data.notes.slice(0, 15)) {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        renderFooter(doc);
      }

      doc
        .fillColor(COLORS.secondary)
        .fontSize(8)
        .font("Helvetica")
        .text(
          `${formatDate(note.createdAt)} — ${note.authorName}`
        );

      doc
        .fillColor(COLORS.text)
        .fontSize(10)
        .font("Helvetica")
        .text(note.content, { lineGap: 2, width: 495 });

      doc.moveDown(0.5);
    }
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
