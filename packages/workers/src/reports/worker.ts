import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "../queues.js";
import { prisma } from "@mediabot/shared";
import { generateWeeklyReport, type WeeklyReportData } from "./pdf-generator.js";
import { generateDigestSummary } from "../analysis/ai.js";
import { bot } from "../notifications/bot-instance.js";
import { InputFile } from "grammy";

function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function startReportWorker() {
  const worker = new Worker(
    QUEUE_NAMES.WEEKLY_REPORT,
    async () => {
      console.log("[ReportWorker] Starting weekly report generation...");

      // Get all active clients with telegram groups configured
      const clients = await prisma.client.findMany({
        where: {
          active: true,
          telegramGroupId: { not: null },
        },
      });

      console.log(`[ReportWorker] Found ${clients.length} clients with Telegram groups`);

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (const client of clients) {
        try {
          console.log(`[ReportWorker] Generating report for: ${client.name}`);

          // Fetch week's mentions
          const mentions = await prisma.mention.findMany({
            where: {
              clientId: client.id,
              createdAt: { gte: since },
            },
            include: { article: true },
            orderBy: { relevance: "desc" },
          });

          if (mentions.length === 0) {
            console.log(`[ReportWorker] No mentions for ${client.name}, skipping`);
            continue;
          }

          // Calculate sentiment breakdown
          const sentimentBreakdown = {
            positive: 0,
            negative: 0,
            neutral: 0,
            mixed: 0,
          };

          for (const m of mentions) {
            const key = m.sentiment.toLowerCase() as keyof typeof sentimentBreakdown;
            if (key in sentimentBreakdown) {
              sentimentBreakdown[key]++;
            }
          }

          // Get crisis alerts count
          const crisisAlerts = await prisma.crisisAlert.count({
            where: {
              clientId: client.id,
              createdAt: { gte: since },
            },
          });

          // Prepare top mentions for AI summary
          const topMentions = mentions.slice(0, 10).map((m) => ({
            title: m.article.title,
            source: m.article.source,
            sentiment: m.sentiment,
            relevance: m.relevance,
            aiSummary: m.aiSummary,
          }));

          // Generate AI executive summary
          let aiSummary: string;
          try {
            aiSummary = await generateDigestSummary({
              clientName: client.name,
              totalMentions: mentions.length,
              sentimentBreakdown,
              topMentions: topMentions.slice(0, 5),
            });
          } catch (err) {
            console.error(`[ReportWorker] AI summary failed for ${client.name}:`, err);
            aiSummary = `Durante esta semana se detectaron ${mentions.length} menciones de ${client.name}. ` +
              `${sentimentBreakdown.positive} fueron positivas, ${sentimentBreakdown.negative} negativas, ` +
              `${sentimentBreakdown.neutral} neutras y ${sentimentBreakdown.mixed} mixtas.`;
          }

          // Generate PDF
          const reportData: WeeklyReportData = {
            clientName: client.name,
            period: { start: since, end: new Date() },
            totalMentions: mentions.length,
            sentimentBreakdown,
            topMentions,
            aiExecutiveSummary: aiSummary,
            crisisAlerts,
          };

          const pdfBuffer = await generateWeeklyReport(reportData);
          console.log(`[ReportWorker] PDF generated for ${client.name}, size: ${pdfBuffer.length} bytes`);

          // Send via Telegram
          const filename = `reporte-semanal-${client.name.toLowerCase().replace(/\s+/g, "-")}-${formatDateForFilename(new Date())}.pdf`;

          await bot.api.sendDocument(
            client.telegramGroupId!,
            new InputFile(pdfBuffer, filename),
            {
              caption: `📊 *Reporte Semanal de Monitoreo*\n\n` +
                `Cliente: ${client.name}\n` +
                `Periodo: ${formatDateForFilename(since)} al ${formatDateForFilename(new Date())}\n` +
                `Total menciones: ${mentions.length}`,
              parse_mode: "Markdown",
            }
          );

          console.log(`[ReportWorker] Report sent to Telegram for ${client.name}`);

          // Log the report
          await prisma.reportLog.create({
            data: {
              clientId: client.id,
              type: "weekly",
              mentionCount: mentions.length,
            },
          });
        } catch (err) {
          console.error(`[ReportWorker] Error processing ${client.name}:`, err);
        }
      }

      console.log("[ReportWorker] Weekly report generation completed");
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[ReportWorker] Job ${job?.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ReportWorker] Job ${job?.id} failed:`, err);
  });

  console.log("📄 Report worker started");

  return worker;
}
