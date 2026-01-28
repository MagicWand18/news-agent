import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

export async function handleVincular(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  if (!ctx.chat || ctx.chat.type === "private") {
    await ctx.reply(
      "Este comando debe usarse dentro de un grupo para vincularlo a un cliente."
    );
    return;
  }

  const args = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!args) {
    await ctx.reply("Uso: /vincular <nombre del cliente>");
    return;
  }

  const client = await prisma.client.findFirst({
    where: {
      orgId: ctx.session.orgId,
      name: { contains: args, mode: "insensitive" },
    },
  });

  if (!client) {
    await ctx.reply(`No se encontro un cliente con el nombre "${args}".`);
    return;
  }

  const groupId = ctx.chat.id.toString();

  // Check if it should be internal or client group
  const isClientGroup = client.telegramGroupId !== null;

  if (isClientGroup) {
    await prisma.client.update({
      where: { id: client.id },
      data: { clientGroupId: groupId },
    });
    await ctx.reply(
      `✅ Grupo vinculado como *grupo del cliente* para ${client.name}.\n` +
        `Las alertas curadas se enviaran aqui.`
    );
  } else {
    await prisma.client.update({
      where: { id: client.id },
      data: { telegramGroupId: groupId },
    });
    await ctx.reply(
      `✅ Grupo vinculado como *grupo interno* para ${client.name}.\n` +
        `Las alertas del equipo se enviaran aqui.\n\n` +
        `Para vincular un grupo del cliente, usa /vincular ${client.name} de nuevo en otro grupo.`
    );
  }
}
