import type { Conversation } from "@grammyjs/conversations";
import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";
import { InlineKeyboard } from "grammy";

export async function newClientConversation(
  conversation: Conversation<BotContext>,
  ctx: BotContext
) {
  if (!ctx.session.orgId || !ctx.session.userId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  // Verify admin role
  const user = await conversation.external(() =>
    prisma.user.findUnique({ where: { id: ctx.session.userId! } })
  );

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPERVISOR")) {
    await ctx.reply("Solo administradores y supervisores pueden agregar clientes.");
    return;
  }

  await ctx.reply("📝 *Nuevo cliente*\n\n¿Cual es el nombre del cliente/empresa?");
  const nameMsg = await conversation.waitFor("message:text");
  const name = nameMsg.message.text;

  await ctx.reply("📝 Describe brevemente al cliente (industria, actividad, etc.):");
  const descMsg = await conversation.waitFor("message:text");
  const description = descMsg.message.text;

  await ctx.reply("🏭 ¿Cual es su industria? (ej: tecnologia, salud, finanzas):");
  const industryMsg = await conversation.waitFor("message:text");
  const industry = industryMsg.message.text;

  await ctx.reply(
    `⏳ Creando cliente "${name}" y ejecutando analisis IA...\n` +
      `Esto puede tomar unos momentos.`
  );

  // Create client
  const client = await conversation.external(() =>
    prisma.client.create({
      data: {
        name,
        description,
        industry,
        orgId: ctx.session.orgId!,
      },
    })
  );

  // Add basic keywords (client name)
  await conversation.external(() =>
    prisma.keyword.create({
      data: {
        word: name,
        type: "NAME",
        clientId: client.id,
      },
    })
  );

  const keyboard = new InlineKeyboard()
    .text("✅ Activar monitoreo", `client_detail:${client.id}`)
    .row()
    .text("📝 Agregar keywords", `kw_add:${client.id}`);

  await ctx.reply(
    `✅ Cliente creado: *${name}*\n\n` +
      `Industria: ${industry}\n` +
      `Descripcion: ${description}\n\n` +
      `Se agrego "${name}" como keyword automaticamente.\n` +
      `Usa /keywords ${name} para agregar mas keywords.\n\n` +
      `💡 El sistema de onboarding IA analizara al cliente en segundo plano ` +
      `y te notificara con sugerencias de keywords, competidores y temas sensibles.`,
    { reply_markup: keyboard }
  );
}
