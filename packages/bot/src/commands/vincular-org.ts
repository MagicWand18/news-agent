import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

/**
 * Comando /vincular_org - Vincula un grupo o chat a una organización.
 * Los destinatarios de org reciben TODAS las notificaciones de todos los clientes.
 *
 * Uso:
 *   /vincular_org <nombre_organizacion>
 *
 * Ejemplo:
 *   /vincular_org Crisalida
 */
export async function handleVincularOrg(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const args = ctx.message?.text?.split(" ").slice(1) || [];
  const orgName = args.join(" ").trim();

  if (!orgName) {
    await ctx.reply(
      `Uso: /vincular_org <nombre_organizacion>\n\n` +
      `Vincula este chat/grupo para recibir TODAS las notificaciones de todos los clientes de la organización.\n\n` +
      `Ejemplo: /vincular_org Crisalida`
    );
    return;
  }

  // Buscar organización por nombre (case-insensitive)
  const org = await prisma.organization.findFirst({
    where: {
      name: { contains: orgName, mode: "insensitive" },
    },
    include: {
      _count: { select: { clients: true } },
    },
  });

  if (!org) {
    await ctx.reply(`No se encontro una organización con el nombre "${orgName}".`);
    return;
  }

  const chatId = ctx.chat!.id.toString();
  const isPrivate = ctx.chat?.type === "private";
  const label = isPrivate
    ? ctx.from?.first_name || "Usuario"
    : (ctx.chat as { title?: string }).title || "Grupo";

  // Upsert: crear o reactivar
  await prisma.orgTelegramRecipient.upsert({
    where: {
      orgId_chatId: { orgId: org.id, chatId },
    },
    update: {
      active: true,
      label,
      addedBy: ctx.session.userId,
    },
    create: {
      orgId: org.id,
      chatId,
      label,
      active: true,
      addedBy: ctx.session.userId,
    },
  });

  await ctx.reply(
    `✅ ${isPrivate ? "Chat" : "Grupo"} vinculado a la organización *${org.name}*.\n\n` +
    `Recibirás TODAS las notificaciones de los ${org._count.clients} cliente${org._count.clients !== 1 ? "s" : ""} de esta organización.\n\n` +
    `💡 Puedes ajustar qué tipos de notificación recibir desde el dashboard (Configuración > Notificaciones Telegram).`,
    { parse_mode: "Markdown" }
  );
}
