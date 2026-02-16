import {
  COLORS,
  createPDFDocument,
  formatDate,
  pdfToBuffer,
  renderFooter,
  renderHeader,
  renderKPIGrid,
  renderSectionTitle,
} from "./pdf-utils";

export interface BriefPDFData {
  clientName: string;
  date: Date | string;
  content: {
    highlights: string[];
    comparison: {
      mentionsDelta: number;
      sentimentShift: string;
      sovChange: string;
    };
    watchList: string[];
    emergingTopics: string[];
    pendingActions: string[];
  };
  stats: {
    mentions: number;
    sentiment: {
      positive: number;
      negative: number;
      neutral: number;
      mixed: number;
    };
    sov: number;
    socialPosts: number;
    engagement: number;
  };
}

/**
 * Genera un PDF con el brief diario de medios para un cliente
 */
export async function generateBriefPDF(data: BriefPDFData): Promise<Buffer> {
  const doc = createPDFDocument(
    `Media Brief - ${data.clientName} - ${formatDate(data.date)}`
  );
  const bufferPromise = pdfToBuffer(doc);

  // Portada: nombre del cliente y fecha
  renderHeader(
    doc,
    `Media Brief — ${data.clientName}`,
    formatDate(data.date)
  );

  // Seccion 1: KPIs del dia
  renderSectionTitle(doc, "Metricas del Dia");

  const totalSentiment =
    data.stats.sentiment.positive +
    data.stats.sentiment.negative +
    data.stats.sentiment.neutral +
    data.stats.sentiment.mixed;

  const positivePercent =
    totalSentiment > 0
      ? ((data.stats.sentiment.positive / totalSentiment) * 100).toFixed(1)
      : "0.0";

  renderKPIGrid(doc, [
    { label: "Menciones totales", value: data.stats.mentions },
    { label: "Share of Voice", value: `${data.stats.sov.toFixed(1)}%` },
    { label: "Publicaciones sociales", value: data.stats.socialPosts },
    {
      label: "Engagement total",
      value: data.stats.engagement.toLocaleString("es-ES"),
    },
    { label: "% Sentimiento positivo", value: `${positivePercent}%` },
    {
      label: "Sentimiento negativo",
      value: data.stats.sentiment.negative,
    },
  ]);

  // Seccion 2: Highlights
  if (data.content.highlights.length > 0) {
    renderSectionTitle(doc, "Destacados");

    for (const highlight of data.content.highlights) {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        renderFooter(doc);
      }

      doc
        .fillColor(COLORS.text)
        .fontSize(10)
        .font("Helvetica")
        .text(`•  ${highlight}`, 60, doc.y, { width: 475, lineGap: 3 });

      doc.moveDown(0.3);
    }
  }

  // Seccion 3: Comparativa vs ayer
  renderSectionTitle(doc, "Comparativa vs. Ayer");

  const deltaPrefix = data.content.comparison.mentionsDelta >= 0 ? "+" : "";
  const mentionsDeltaStr = `${deltaPrefix}${data.content.comparison.mentionsDelta}`;
  const mentionsDeltaColor =
    data.content.comparison.mentionsDelta >= 0
      ? COLORS.positive
      : COLORS.negative;

  doc
    .fillColor(COLORS.text)
    .fontSize(10)
    .font("Helvetica")
    .text("Cambio en menciones: ", { continued: true })
    .fillColor(mentionsDeltaColor)
    .font("Helvetica-Bold")
    .text(mentionsDeltaStr);

  doc.moveDown(0.2);

  doc
    .fillColor(COLORS.text)
    .fontSize(10)
    .font("Helvetica")
    .text("Cambio de sentimiento: ", { continued: true })
    .font("Helvetica-Bold")
    .text(data.content.comparison.sentimentShift || "Sin cambio");

  doc.moveDown(0.2);

  doc
    .fillColor(COLORS.text)
    .fontSize(10)
    .font("Helvetica")
    .text("Cambio en SOV: ", { continued: true })
    .font("Helvetica-Bold")
    .text(data.content.comparison.sovChange || "Sin cambio");

  doc.moveDown(0.5);

  // Seccion 4: Watch List
  if (data.content.watchList.length > 0) {
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
      renderFooter(doc);
    }

    renderSectionTitle(doc, "Watch List");

    for (const item of data.content.watchList) {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        renderFooter(doc);
      }

      doc
        .fillColor(COLORS.negative)
        .fontSize(10)
        .font("Helvetica")
        .text("!  ", 55, doc.y, { continued: true })
        .fillColor(COLORS.text)
        .text(item, { width: 475, lineGap: 2 });

      doc.moveDown(0.3);
    }
  }

  // Seccion 5: Temas emergentes
  if (data.content.emergingTopics.length > 0) {
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
      renderFooter(doc);
    }

    renderSectionTitle(doc, "Temas Emergentes");

    for (const topic of data.content.emergingTopics) {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        renderFooter(doc);
      }

      doc
        .fillColor(COLORS.mixed)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("→  ", 55, doc.y, { continued: true })
        .fillColor(COLORS.text)
        .font("Helvetica")
        .text(topic, { width: 475, lineGap: 2 });

      doc.moveDown(0.3);
    }
  }

  // Seccion 6: Acciones pendientes
  if (data.content.pendingActions.length > 0) {
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
      renderFooter(doc);
    }

    renderSectionTitle(doc, "Acciones Pendientes");

    for (let i = 0; i < data.content.pendingActions.length; i++) {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        renderFooter(doc);
      }

      doc
        .fillColor(COLORS.primary)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`${i + 1}. `, 55, doc.y, { continued: true })
        .fillColor(COLORS.text)
        .font("Helvetica")
        .text(data.content.pendingActions[i], { width: 475, lineGap: 2 });

      doc.moveDown(0.3);
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
