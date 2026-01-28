import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

export async function handleStatus(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const [clientCount, mentionCount24h, tasksPending] = await Promise.all([
    prisma.client.count({ where: { orgId: ctx.session.orgId, active: true } }),
    prisma.mention.count({
      where: {
        client: { orgId: ctx.session.orgId },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.task.count({
      where: {
        client: { orgId: ctx.session.orgId },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
  ]);

  await ctx.reply(
    `📊 Estado del sistema\n\n` +
      `Clientes activos: ${clientCount}\n` +
      `Menciones (24h): ${mentionCount24h}\n` +
      `Tareas pendientes: ${tasksPending}\n` +
      `Sistema: ✅ Operativo`
  );
}
