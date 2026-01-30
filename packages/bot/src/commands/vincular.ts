import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";
import type { RecipientType } from "@prisma/client";

/**
 * Comando /vincular - Vincula un grupo o chat a un cliente.
 *
 * Uso:
 *   /vincular <nombre_cliente> [tipo]
 *
 * Tipos disponibles:
 *   interno   - Grupo interno de la agencia (default en grupos)
 *   cliente   - Grupo compartido con el cliente
 *   individual - Chat individual con el cliente (solo en privado)
 */
export async function handleVincular(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const args = ctx.message?.text?.split(" ").slice(1) || [];
  const isPrivate = ctx.chat?.type === "private";

  // Parsear argumentos: nombre del cliente y tipo opcional
  let clientName = "";
  let requestedType: "interno" | "cliente" | "individual" | null = null;

  // Buscar si el último argumento es un tipo
  const lastArg = args[args.length - 1]?.toLowerCase();
  if (lastArg === "interno" || lastArg === "cliente" || lastArg === "individual") {
    requestedType = lastArg;
    clientName = args.slice(0, -1).join(" ");
  } else {
    clientName = args.join(" ");
  }

  if (!clientName) {
    const helpMessage = isPrivate
      ? `Uso: /vincular <nombre_cliente> [tipo]\n\n` +
        `Tipos:\n` +
        `• individual - Recibirás alertas como contacto del cliente\n\n` +
        `Ejemplo: /vincular Coca Cola individual`
      : `Uso: /vincular <nombre_cliente> [tipo]\n\n` +
        `Tipos:\n` +
        `• interno - Grupo interno de la agencia (default)\n` +
        `• cliente - Grupo compartido con el cliente\n\n` +
        `Ejemplo: /vincular Coca Cola cliente`;
    await ctx.reply(helpMessage);
    return;
  }

  // Buscar cliente
  const client = await prisma.client.findFirst({
    where: {
      orgId: ctx.session.orgId,
      name: { contains: clientName, mode: "insensitive" },
    },
  });

  if (!client) {
    await ctx.reply(`No se encontro un cliente con el nombre "${clientName}".`);
    return;
  }

  const chatId = ctx.chat!.id.toString();

  // Determinar tipo de recipient
  let recipientType: RecipientType;
  let typeLabel: string;

  if (isPrivate) {
    // En chat privado solo puede ser individual
    recipientType = "CLIENT_INDIVIDUAL";
    typeLabel = "contacto individual del cliente";
  } else if (requestedType === "cliente") {
    recipientType = "CLIENT_GROUP";
    typeLabel = "grupo del cliente";
  } else {
    // Default para grupos: interno
    recipientType = "AGENCY_INTERNAL";
    typeLabel = "grupo interno";
  }

  // Verificar si ya existe este recipient
  const existing = await prisma.telegramRecipient.findUnique({
    where: {
      clientId_chatId: {
        clientId: client.id,
        chatId,
      },
    },
  });

  if (existing) {
    if (existing.active) {
      await ctx.reply(
        `Este ${isPrivate ? "chat" : "grupo"} ya esta vinculado a ${client.name} como ${getTypeLabel(existing.type)}.\n\n` +
        `Usa /desvincular ${client.name} para eliminarlo.`
      );
      return;
    }

    // Reactivar recipient existente
    await prisma.telegramRecipient.update({
      where: { id: existing.id },
      data: {
        active: true,
        type: recipientType,
        addedBy: ctx.session.userId,
      },
    });

    await ctx.reply(
      `✅ ${isPrivate ? "Chat" : "Grupo"} reactivado como *${typeLabel}* para ${client.name}.\n` +
      `Las alertas se enviaran aqui.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Crear nuevo recipient
  const label = isPrivate
    ? ctx.from?.first_name || "Usuario"
    : (ctx.chat as { title?: string }).title || "Grupo";

  await prisma.telegramRecipient.create({
    data: {
      clientId: client.id,
      chatId,
      type: recipientType,
      label,
      active: true,
      addedBy: ctx.session.userId,
    },
  });

  // Actualizar campos legacy para compatibilidad
  if (recipientType === "AGENCY_INTERNAL" && !client.telegramGroupId) {
    await prisma.client.update({
      where: { id: client.id },
      data: { telegramGroupId: chatId },
    });
  } else if (recipientType === "CLIENT_GROUP" && !client.clientGroupId) {
    await prisma.client.update({
      where: { id: client.id },
      data: { clientGroupId: chatId },
    });
  }

  // Contar destinatarios actuales
  const recipientCount = await prisma.telegramRecipient.count({
    where: { clientId: client.id, active: true },
  });

  await ctx.reply(
    `✅ ${isPrivate ? "Chat" : "Grupo"} vinculado como *${typeLabel}* para ${client.name}.\n` +
    `Las alertas se enviaran aqui.\n\n` +
    `📊 ${client.name} ahora tiene ${recipientCount} destinatario${recipientCount > 1 ? "s" : ""} de Telegram.`,
    { parse_mode: "Markdown" }
  );
}

/**
 * Obtiene la etiqueta en español para un tipo de recipient.
 */
function getTypeLabel(type: RecipientType): string {
  switch (type) {
    case "AGENCY_INTERNAL":
      return "grupo interno";
    case "CLIENT_GROUP":
      return "grupo del cliente";
    case "CLIENT_INDIVIDUAL":
      return "contacto individual";
    default:
      return type;
  }
}
