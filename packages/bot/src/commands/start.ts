import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

export async function handleStart(ctx: BotContext) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  const existing = await prisma.user.findUnique({
    where: { telegramUserId },
  });

  if (existing) {
    await ctx.reply(
      `Bienvenido de vuelta, ${existing.name}.\n\n` +
        `Usa /help para ver los comandos disponibles.`
    );
    return;
  }

  await ctx.reply(
    `👋 Hola! Soy MediaBot, tu asistente de monitoreo de medios.\n\n` +
      `Parece que aun no estas registrado. Pide a un administrador que te agregue al sistema.\n\n` +
      `Tu ID de Telegram es: ${telegramUserId}`
  );
}
