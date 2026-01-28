import type { Bot } from "grammy";
import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";

export function handleCallbacks(bot: Bot<BotContext>) {
  // Client detail
  bot.callbackQuery(/^client_detail:(.+)$/, async (ctx) => {
    const clientId = ctx.match![1];
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        keywords: { where: { active: true } },
        _count: {
          select: {
            mentions: true,
            tasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
          },
        },
      },
    });

    if (!client) {
      await ctx.answerCallbackQuery({ text: "Cliente no encontrado" });
      return;
    }

    const kwList = client.keywords.map((k) => k.word).join(", ") || "ninguno";

    await ctx.editMessageText(
      `📊 *${client.name}*\n\n` +
        `Industria: ${client.industry || "N/A"}\n` +
        `Descripcion: ${client.description || "N/A"}\n` +
        `Keywords: ${kwList}\n` +
        `Menciones totales: ${client._count.mentions}\n` +
        `Tareas activas: ${client._count.tasks}\n` +
        `Grupo interno: ${client.telegramGroupId ? "✅" : "❌"}\n` +
        `Grupo cliente: ${client.clientGroupId ? "✅" : "❌"}`
    );
    await ctx.answerCallbackQuery();
  });

  // Create task from mention alert
  bot.callbackQuery(/^create_task:(.+)$/, async (ctx) => {
    if (!ctx.session.userId) {
      await ctx.answerCallbackQuery({ text: "No estas registrado" });
      return;
    }

    const mentionId = ctx.match![1];
    const mention = await prisma.mention.findUnique({
      where: { id: mentionId },
      include: { article: true, client: true },
    });

    if (!mention) {
      await ctx.answerCallbackQuery({ text: "Mencion no encontrada" });
      return;
    }

    const task = await prisma.task.create({
      data: {
        title: `Atender: ${mention.article.title.slice(0, 80)}`,
        description: mention.aiAction || `Revisar mencion de ${mention.client.name}`,
        priority: mention.urgency === "CRITICAL" ? "URGENT" : mention.urgency === "HIGH" ? "HIGH" : "MEDIUM",
        clientId: mention.clientId,
        mentionId: mention.id,
      },
    });

    await ctx.answerCallbackQuery({ text: "✅ Tarea creada" });
    await ctx.reply(
      `✅ Tarea creada: "${task.title}"\n\nUsa /mistareas para verla.`
    );
  });

  // Notify client about mention
  bot.callbackQuery(/^notify_client:(.+)$/, async (ctx) => {
    const mentionId = ctx.match![1];
    const mention = await prisma.mention.findUnique({
      where: { id: mentionId },
      include: { article: true, client: true },
    });

    if (!mention || !mention.client.clientGroupId) {
      await ctx.answerCallbackQuery({
        text: mention ? "No hay grupo de cliente vinculado" : "Mencion no encontrada",
      });
      return;
    }

    // Send curated message to client group
    const sentimentLabel =
      mention.sentiment === "POSITIVE"
        ? "Positivo ✅"
        : mention.sentiment === "NEGATIVE"
          ? "Negativo ⚠️"
          : "Neutral";

    await ctx.api.sendMessage(
      mention.client.clientGroupId,
      `📰 *Mencion en medios*\n\n` +
        `${mention.article.title}\n` +
        `📡 ${mention.article.source}\n` +
        `📊 Sentimiento: ${sentimentLabel}\n\n` +
        (mention.aiSummary ? `💬 ${mention.aiSummary}\n\n` : "") +
        `🔗 ${mention.article.url}`
    );

    await prisma.mention.update({
      where: { id: mentionId },
      data: { clientNotified: true },
    });

    await ctx.answerCallbackQuery({ text: "✅ Enviado al cliente" });
  });

  // Ignore mention
  bot.callbackQuery(/^ignore_mention:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Mencion ignorada" });
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
  });

  // Add keyword
  bot.callbackQuery(/^kw_add:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Envia el keyword a agregar en formato:\n`palabra:tipo`\n\n" +
        "Tipos: NAME, BRAND, COMPETITOR, TOPIC, ALIAS\n" +
        "Ejemplo: `MiMarca:BRAND`"
    );
  });

  // Task status change
  bot.callbackQuery(/^task_status:(.+):(.+)$/, async (ctx) => {
    const taskId = ctx.match![1];
    const newStatus = ctx.match![2] as "IN_PROGRESS" | "COMPLETED";

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        completedAt: newStatus === "COMPLETED" ? new Date() : undefined,
      },
    });

    const label = newStatus === "COMPLETED" ? "completada" : "en progreso";
    await ctx.answerCallbackQuery({ text: `Tarea marcada como ${label}` });
  });
}
