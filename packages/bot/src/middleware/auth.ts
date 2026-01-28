import type { NextFunction } from "grammy";
import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

const PUBLIC_COMMANDS = new Set(["/start", "/help"]);

export async function authMiddleware(ctx: BotContext, next: NextFunction) {
  if (!ctx.from) {
    return next();
  }

  const telegramUserId = ctx.from.id.toString();

  const user = await prisma.user.findUnique({
    where: { telegramUserId },
  });

  if (user) {
    ctx.session.userId = user.id;
    ctx.session.orgId = user.orgId;
    return next();
  }

  // Allow public commands for unregistered users
  const messageText = ctx.message?.text || "";
  const command = messageText.split(" ")[0];
  if (PUBLIC_COMMANDS.has(command)) {
    return next();
  }

  // Block unregistered users from other commands
  if (ctx.message?.text?.startsWith("/")) {
    await ctx.reply(
      "No estas registrado en el sistema. Contacta al administrador para vincular tu cuenta de Telegram."
    );
    return;
  }

  return next();
}
