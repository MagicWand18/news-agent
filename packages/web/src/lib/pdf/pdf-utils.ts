import PDFDocument from "pdfkit";

// Colores del sistema
export const COLORS = {
  primary: "#1e40af",
  secondary: "#6b7280",
  positive: "#059669",
  negative: "#dc2626",
  neutral: "#6b7280",
  mixed: "#d97706",
  background: "#f3f4f6",
  text: "#111827",
  lightText: "#9ca3af",
};

/**
 * Formatea una fecha al formato legible en español
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Retorna la etiqueta de sentimiento en español
 */
export function getSentimentLabel(sentiment: string): string {
  const labels: Record<string, string> = {
    POSITIVE: "Positivo",
    NEGATIVE: "Negativo",
    NEUTRAL: "Neutral",
    MIXED: "Mixto",
  };
  return labels[sentiment] || sentiment;
}

/**
 * Retorna el color asociado a un sentimiento
 */
export function getSentimentColor(sentiment: string): string {
  const colors: Record<string, string> = {
    POSITIVE: COLORS.positive,
    NEGATIVE: COLORS.negative,
    NEUTRAL: COLORS.neutral,
    MIXED: COLORS.mixed,
  };
  return colors[sentiment] || COLORS.secondary;
}

/**
 * Renderiza el header de MediaBot con titulo y subtitulo opcional
 */
export function renderHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle?: string
): void {
  doc
    .fillColor(COLORS.primary)
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("MediaBot", { align: "center" });

  doc
    .fillColor(COLORS.secondary)
    .fontSize(10)
    .font("Helvetica")
    .text("Plataforma de Monitoreo de Medios", { align: "center" });

  doc.moveDown(0.5);

  doc
    .fillColor(COLORS.text)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text(title, { align: "center" });

  if (subtitle) {
    doc
      .fillColor(COLORS.secondary)
      .fontSize(11)
      .font("Helvetica")
      .text(subtitle, { align: "center" });
  }

  doc.moveDown(1);

  // Linea divisora
  doc
    .strokeColor(COLORS.primary)
    .lineWidth(2)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();

  doc.moveDown(0.5);
}

/**
 * Renderiza el footer con fecha de generacion
 */
export function renderFooter(doc: PDFKit.PDFDocument): void {
  const y = doc.page.height - 50;
  doc
    .fillColor(COLORS.lightText)
    .fontSize(8)
    .font("Helvetica")
    .text(`Generado por MediaBot — ${formatDate(new Date())}`, 50, y, {
      align: "center",
      width: 495,
    });
}

/**
 * Renderiza un titulo de seccion con linea divisora
 */
export function renderSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string
): void {
  doc.moveDown(0.5);
  doc
    .fillColor(COLORS.primary)
    .fontSize(14)
    .font("Helvetica-Bold")
    .text(title);
  doc.moveDown(0.3);
  doc
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(0.3);
}

/**
 * Renderiza un grid de KPIs en 2 columnas con fondo gris y delta opcional
 */
export function renderKPIGrid(
  doc: PDFKit.PDFDocument,
  kpis: Array<{ label: string; value: string | number; delta?: string }>
): void {
  const startX = 50;
  const colWidth = 247;
  const rowHeight = 50;

  kpis.forEach((kpi, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (colWidth + 6);
    const y = doc.y + row * rowHeight;

    // Fondo gris claro
    doc.rect(x, y, colWidth, rowHeight - 5).fill(COLORS.background);

    doc
      .fillColor(COLORS.secondary)
      .fontSize(9)
      .font("Helvetica")
      .text(kpi.label, x + 10, y + 8, { width: colWidth - 20 });

    doc
      .fillColor(COLORS.text)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(String(kpi.value), x + 10, y + 22, { width: colWidth - 20 });

    if (kpi.delta) {
      const deltaColor = kpi.delta.startsWith("+")
        ? COLORS.positive
        : kpi.delta.startsWith("-")
          ? COLORS.negative
          : COLORS.secondary;
      doc
        .fillColor(deltaColor)
        .fontSize(9)
        .font("Helvetica")
        .text(kpi.delta, x + colWidth - 80, y + 25, {
          width: 70,
          align: "right",
        });
    }
  });

  const rows = Math.ceil(kpis.length / 2);
  doc.y += rows * rowHeight + 5;
}

/**
 * Renderiza una tabla simple con headers y filas, paginando automaticamente
 */
export function renderTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  colWidths: number[]
): void {
  const startX = 50;
  const rowHeight = 20;
  let y = doc.y;

  // Headers
  doc.fillColor(COLORS.primary).fontSize(9).font("Helvetica-Bold");
  let x = startX;
  headers.forEach((h, i) => {
    doc.text(h, x, y, { width: colWidths[i] });
    x += colWidths[i];
  });
  y += rowHeight;
  doc
    .strokeColor("#e5e7eb")
    .lineWidth(0.5)
    .moveTo(startX, y - 5)
    .lineTo(545, y - 5)
    .stroke();

  // Rows
  doc.fillColor(COLORS.text).fontSize(9).font("Helvetica");
  rows.forEach((row) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      renderFooter(doc);
      y = 50;
    }
    x = startX;
    row.forEach((cell, i) => {
      doc.text(cell, x, y, { width: colWidths[i] });
      x += colWidths[i];
    });
    y += rowHeight;
  });

  doc.y = y;
}

/**
 * Crea un documento PDF con configuracion estandar de MediaBot
 */
export function createPDFDocument(title: string): PDFKit.PDFDocument {
  return new (PDFDocument as any)({
    margin: 50,
    size: "A4",
    info: { Title: title, Author: "MediaBot" },
  });
}

/**
 * Convierte un PDFDocument a Buffer recolectando los chunks del stream
 */
export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
