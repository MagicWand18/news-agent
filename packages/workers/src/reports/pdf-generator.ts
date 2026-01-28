import PDFDocument from "pdfkit";

export interface WeeklyReportData {
  clientName: string;
  period: { start: Date; end: Date };
  totalMentions: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  topMentions: Array<{
    title: string;
    source: string;
    sentiment: string;
    relevance: number;
    aiSummary: string | null;
  }>;
  aiExecutiveSummary: string;
  crisisAlerts: number;
  // Sprint 6: Intelligence data
  sovData?: {
    sov: number;
    weightedSov: number;
    trend: "up" | "down" | "stable";
    competitors: Array<{ name: string; sov: number }>;
  };
  topTopics?: Array<{ name: string; count: number }>;
  weeklyInsights?: string[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getSentimentLabel(sentiment: string): string {
  const labels: Record<string, string> = {
    POSITIVE: "Positivo",
    NEGATIVE: "Negativo",
    NEUTRAL: "Neutral",
    MIXED: "Mixto",
  };
  return labels[sentiment] || sentiment;
}

export async function generateWeeklyReport(data: WeeklyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      info: {
        Title: `Reporte Semanal - ${data.clientName}`,
        Author: "MediaBot",
      },
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Colors
    const primaryColor = "#1e40af";
    const secondaryColor = "#6b7280";
    const positiveColor = "#059669";
    const negativeColor = "#dc2626";

    // Header
    doc
      .fillColor(primaryColor)
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("MediaBot", { align: "center" });

    doc
      .fillColor(secondaryColor)
      .fontSize(12)
      .font("Helvetica")
      .text("Reporte Semanal de Monitoreo", { align: "center" });

    doc.moveDown(0.5);

    doc
      .fillColor("#111827")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(data.clientName, { align: "center" });

    doc
      .fillColor(secondaryColor)
      .fontSize(11)
      .font("Helvetica")
      .text(`${formatDate(data.period.start)} - ${formatDate(data.period.end)}`, {
        align: "center",
      });

    doc.moveDown(1.5);

    // Divider
    doc
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown(1);

    // Executive Summary
    doc
      .fillColor(primaryColor)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Resumen Ejecutivo");

    doc.moveDown(0.5);

    doc
      .fillColor("#374151")
      .fontSize(11)
      .font("Helvetica")
      .text(data.aiExecutiveSummary, {
        align: "justify",
        lineGap: 4,
      });

    doc.moveDown(1.5);

    // Key Metrics Section
    doc
      .fillColor(primaryColor)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Metricas del Periodo");

    doc.moveDown(0.5);

    // Metrics in a grid-like format
    const metricsY = doc.y;
    const colWidth = 160;

    // Total Mentions
    doc
      .fillColor("#111827")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(data.totalMentions.toString(), 50, metricsY);
    doc
      .fillColor(secondaryColor)
      .fontSize(10)
      .font("Helvetica")
      .text("Total Menciones", 50, metricsY + 28);

    // Positive
    doc
      .fillColor(positiveColor)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(data.sentimentBreakdown.positive.toString(), 50 + colWidth, metricsY);
    doc
      .fillColor(secondaryColor)
      .fontSize(10)
      .font("Helvetica")
      .text("Positivas", 50 + colWidth, metricsY + 28);

    // Negative
    doc
      .fillColor(negativeColor)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(data.sentimentBreakdown.negative.toString(), 50 + colWidth * 2, metricsY);
    doc
      .fillColor(secondaryColor)
      .fontSize(10)
      .font("Helvetica")
      .text("Negativas", 50 + colWidth * 2, metricsY + 28);

    // Crisis Alerts
    const crisisColor = data.crisisAlerts > 0 ? negativeColor : "#059669";
    doc
      .fillColor(crisisColor)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(data.crisisAlerts.toString(), 50 + colWidth * 3, metricsY);
    doc
      .fillColor(secondaryColor)
      .fontSize(10)
      .font("Helvetica")
      .text("Alertas Crisis", 50 + colWidth * 3, metricsY + 28);

    doc.y = metricsY + 60;
    doc.moveDown(1);

    // Sentiment breakdown details
    doc
      .fillColor(secondaryColor)
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Neutras: ${data.sentimentBreakdown.neutral} | Mixtas: ${data.sentimentBreakdown.mixed}`,
        { align: "left" }
      );

    doc.moveDown(1.5);

    // Share of Voice Section (Sprint 6)
    if (data.sovData) {
      doc
        .fillColor(primaryColor)
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Share of Voice");

      doc.moveDown(0.5);

      const trendSymbol = data.sovData.trend === "up" ? "↑" : data.sovData.trend === "down" ? "↓" : "→";
      const trendColor = data.sovData.trend === "up" ? positiveColor : data.sovData.trend === "down" ? negativeColor : secondaryColor;

      doc
        .fillColor("#111827")
        .fontSize(11)
        .font("Helvetica")
        .text(`SOV actual: `, { continued: true })
        .font("Helvetica-Bold")
        .text(`${data.sovData.sov.toFixed(1)}%`, { continued: true })
        .font("Helvetica")
        .fillColor(trendColor)
        .text(` ${trendSymbol}`, { continued: true })
        .fillColor(secondaryColor)
        .text(` | SOV ponderado: ${data.sovData.weightedSov.toFixed(1)}%`);

      if (data.sovData.competitors.length > 0) {
        doc.moveDown(0.3);
        doc
          .fillColor(secondaryColor)
          .fontSize(10)
          .font("Helvetica")
          .text("Competidores: " + data.sovData.competitors.map((c) => `${c.name} (${c.sov.toFixed(1)}%)`).join(", "));
      }

      doc.moveDown(1.5);
    }

    // Top Topics Section (Sprint 6)
    if (data.topTopics && data.topTopics.length > 0) {
      doc
        .fillColor(primaryColor)
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Temas Principales");

      doc.moveDown(0.5);

      const topicsText = data.topTopics
        .slice(0, 5)
        .map((t, i) => `${i + 1}. ${t.name} (${t.count})`)
        .join("  |  ");

      doc
        .fillColor("#374151")
        .fontSize(10)
        .font("Helvetica")
        .text(topicsText);

      doc.moveDown(1.5);
    }

    // Weekly Insights Section (Sprint 6)
    if (data.weeklyInsights && data.weeklyInsights.length > 0) {
      doc
        .fillColor(primaryColor)
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Insights y Recomendaciones IA");

      doc.moveDown(0.5);

      for (const insight of data.weeklyInsights.slice(0, 4)) {
        doc
          .fillColor("#374151")
          .fontSize(10)
          .font("Helvetica")
          .text(`• ${insight}`, {
            width: 495,
            lineGap: 2,
          });
        doc.moveDown(0.3);
      }

      doc.moveDown(1);
    }

    // Top Mentions Section
    doc
      .fillColor(primaryColor)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Menciones Destacadas");

    doc.moveDown(0.5);

    const topMentions = data.topMentions.slice(0, 5);
    for (let i = 0; i < topMentions.length; i++) {
      const mention = topMentions[i];

      // Check if we need a new page
      if (doc.y > 700) {
        doc.addPage();
      }

      // Bullet and title
      doc
        .fillColor("#111827")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(`${i + 1}. ${mention.title}`, {
          width: 495,
          continued: false,
        });

      // Source and sentiment
      const sentimentColor =
        mention.sentiment === "POSITIVE"
          ? positiveColor
          : mention.sentiment === "NEGATIVE"
            ? negativeColor
            : secondaryColor;

      doc
        .fillColor(secondaryColor)
        .fontSize(9)
        .font("Helvetica")
        .text(`${mention.source} | `, { continued: true })
        .fillColor(sentimentColor)
        .text(getSentimentLabel(mention.sentiment), { continued: true })
        .fillColor(secondaryColor)
        .text(` | Relevancia: ${mention.relevance}/10`);

      // AI Summary
      if (mention.aiSummary) {
        doc
          .fillColor("#4b5563")
          .fontSize(10)
          .font("Helvetica-Oblique")
          .text(mention.aiSummary, {
            indent: 15,
            width: 480,
            lineGap: 2,
          });
      }

      doc.moveDown(0.8);
    }

    // Footer
    doc.moveDown(2);
    doc
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown(0.5);

    doc
      .fillColor(secondaryColor)
      .fontSize(9)
      .font("Helvetica")
      .text(
        `Generado automaticamente por MediaBot | ${new Date().toLocaleString("es-ES")}`,
        { align: "center" }
      );

    doc.end();
  });
}
