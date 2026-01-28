import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

export async function handleMisTareas(ctx: BotContext) {
  if (!ctx.session.userId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: ctx.session.userId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: { client: true },
    orderBy: [{ priority: "asc" }, { deadline: "asc" }],
  });

  if (tasks.length === 0) {
    await ctx.reply("🎉 No tienes tareas pendientes.");
    return;
  }

  const priorityIcon: Record<string, string> = {
    URGENT: "🔴",
    HIGH: "🟠",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  const statusIcon: Record<string, string> = {
    PENDING: "⏳",
    IN_PROGRESS: "🔄",
  };

  let message = `📋 Mis tareas (${tasks.length}):\n\n`;

  for (const task of tasks) {
    const pIcon = priorityIcon[task.priority] || "⚪";
    const sIcon = statusIcon[task.status] || "";
    const deadline = task.deadline
      ? ` | 📅 ${task.deadline.toLocaleDateString("es-ES")}`
      : "";
    const client = task.client ? ` [${task.client.name}]` : "";

    message += `${pIcon} ${sIcon} ${task.title}${client}${deadline}\n`;
  }

  await ctx.reply(message);
}
