import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";

export async function handleClientes(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const clients = await prisma.client.findMany({
    where: { orgId: ctx.session.orgId, active: true },
    include: {
      _count: { select: { keywords: true, mentions: true } },
    },
    orderBy: { name: "asc" },
  });

  if (clients.length === 0) {
    await ctx.reply(
      "No hay clientes registrados.\nUsa /cliente para agregar uno nuevo."
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  let message = `📋 Clientes activos (${clients.length}):\n\n`;

  for (const client of clients) {
    message += `• *${client.name}*\n`;
    message += `  Keywords: ${client._count.keywords} | Menciones: ${client._count.mentions}\n`;
    message += `  Grupo interno: ${client.telegramGroupId ? "✅" : "❌"}\n\n`;
    keyboard.text(`📊 ${client.name}`, `client_detail:${client.id}`).row();
  }

  await ctx.reply(message, {
    reply_markup: keyboard,
  });
}
