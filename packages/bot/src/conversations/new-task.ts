import type { Conversation } from "@grammyjs/conversations";
import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";

export async function newTaskConversation(
  conversation: Conversation<BotContext>,
  ctx: BotContext
) {
  if (!ctx.session.orgId || !ctx.session.userId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  await ctx.reply("📝 *Nueva tarea*\n\n¿Cual es el titulo de la tarea?");
  const titleMsg = await conversation.waitFor("message:text");
  const title = titleMsg.message.text;

  await ctx.reply("📄 Descripcion (o escribe 'skip' para omitir):");
  const descMsg = await conversation.waitFor("message:text");
  const description = descMsg.message.text === "skip" ? null : descMsg.message.text;

  // Select client
  const clients = await conversation.external(() =>
    prisma.client.findMany({
      where: { orgId: ctx.session.orgId!, active: true },
      orderBy: { name: "asc" },
    })
  );

  let clientId: string | null = null;
  if (clients.length > 0) {
    const clientKb = new InlineKeyboard();
    for (const c of clients) {
      clientKb.text(c.name, `sel_client:${c.id}`).row();
    }
    clientKb.text("Sin cliente", "sel_client:none");

    await ctx.reply("¿A que cliente asociar esta tarea?", {
      reply_markup: clientKb,
    });
    const clientCb = await conversation.waitForCallbackQuery(/^sel_client:(.+)$/);
    clientId = clientCb.match![1] === "none" ? null : clientCb.match![1];
    await clientCb.answerCallbackQuery();
  }

  // Select priority
  const prioKb = new InlineKeyboard()
    .text("🔴 Urgente", "prio:URGENT")
    .text("🟠 Alta", "prio:HIGH")
    .row()
    .text("🟡 Media", "prio:MEDIUM")
    .text("🟢 Baja", "prio:LOW");

  await ctx.reply("¿Prioridad?", { reply_markup: prioKb });
  const prioCb = await conversation.waitForCallbackQuery(/^prio:(.+)$/);
  const priority = prioCb.match![1] as "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  await prioCb.answerCallbackQuery();

  // Select assignee
  const users = await conversation.external(() =>
    prisma.user.findMany({
      where: { orgId: ctx.session.orgId! },
      orderBy: { name: "asc" },
    })
  );

  let assigneeId: string | null = null;
  if (users.length > 0) {
    const userKb = new InlineKeyboard();
    for (const u of users) {
      userKb.text(u.name, `sel_user:${u.id}`).row();
    }
    userKb.text("Sin asignar", "sel_user:none");

    await ctx.reply("¿Asignar a?", { reply_markup: userKb });
    const userCb = await conversation.waitForCallbackQuery(/^sel_user:(.+)$/);
    assigneeId = userCb.match![1] === "none" ? null : userCb.match![1];
    await userCb.answerCallbackQuery();
  }

  // Create task
  const task = await conversation.external(() =>
    prisma.task.create({
      data: {
        title,
        description,
        priority,
        clientId,
        assigneeId,
      },
    })
  );

  const priorityLabels: Record<string, string> = {
    URGENT: "🔴 Urgente",
    HIGH: "🟠 Alta",
    MEDIUM: "🟡 Media",
    LOW: "🟢 Baja",
  };

  await ctx.reply(
    `✅ Tarea creada:\n\n` +
      `*${task.title}*\n` +
      `Prioridad: ${priorityLabels[task.priority]}\n` +
      (description ? `Descripcion: ${description}\n` : "") +
      `\nUsa /mistareas o /pendientes para verla.`
  );
}
