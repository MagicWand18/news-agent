import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

export async function handlePendientes(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  // If in a group linked to a client, show that client's tasks
  const groupId = ctx.chat?.id?.toString();
  let clientFilter: { clientId?: string } = {};

  if (groupId) {
    const client = await prisma.client.findFirst({
      where: {
        orgId: ctx.session.orgId,
        OR: [{ telegramGroupId: groupId }, { clientGroupId: groupId }],
      },
    });
    if (client) {
      clientFilter = { clientId: client.id };
    }
  }

  const tasks = await prisma.task.findMany({
    where: {
      client: { orgId: ctx.session.orgId },
      status: { in: ["PENDING", "IN_PROGRESS"] },
      ...clientFilter,
    },
    include: { client: true, assignee: true },
    orderBy: [{ priority: "asc" }, { deadline: "asc" }],
    take: 20,
  });

  if (tasks.length === 0) {
    await ctx.reply("✅ No hay tareas pendientes.");
    return;
  }

  const priorityIcon: Record<string, string> = {
    URGENT: "🔴",
    HIGH: "🟠",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  let message = `📋 Tareas pendientes (${tasks.length}):\n\n`;

  for (const task of tasks) {
    const pIcon = priorityIcon[task.priority] || "⚪";
    const assignee = task.assignee ? ` → ${task.assignee.name}` : " → sin asignar";
    const client = task.client ? ` [${task.client.name}]` : "";
    const deadline = task.deadline
      ? ` | 📅 ${task.deadline.toLocaleDateString("es-ES")}`
      : "";

    message += `${pIcon} ${task.title}${client}${assignee}${deadline}\n`;
  }

  await ctx.reply(message);
}
