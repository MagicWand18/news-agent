import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";

export async function handleKeywords(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const args = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!args) {
    await ctx.reply("Uso: /keywords <nombre del cliente>");
    return;
  }

  const client = await prisma.client.findFirst({
    where: {
      orgId: ctx.session.orgId,
      name: { contains: args, mode: "insensitive" },
    },
    include: { keywords: { where: { active: true }, orderBy: { type: "asc" } } },
  });

  if (!client) {
    await ctx.reply(`No se encontro un cliente con el nombre "${args}".`);
    return;
  }

  const grouped: Record<string, string[]> = {};
  for (const kw of client.keywords) {
    if (!grouped[kw.type]) grouped[kw.type] = [];
    grouped[kw.type].push(kw.word);
  }

  let message = `🔑 Keywords de *${client.name}*:\n\n`;
  const typeLabels: Record<string, string> = {
    NAME: "📛 Nombres",
    BRAND: "🏷️ Marcas",
    COMPETITOR: "⚔️ Competidores",
    TOPIC: "📌 Temas",
    ALIAS: "🔄 Alias",
  };

  for (const [type, words] of Object.entries(grouped)) {
    message += `${typeLabels[type] || type}:\n`;
    message += words.map((w) => `  • ${w}`).join("\n") + "\n\n";
  }

  if (client.keywords.length === 0) {
    message += "No hay keywords configurados.\n";
  }

  const keyboard = new InlineKeyboard()
    .text("➕ Agregar keyword", `kw_add:${client.id}`)
    .text("🗑️ Eliminar keyword", `kw_remove:${client.id}`);

  await ctx.reply(message, { reply_markup: keyboard });
}
