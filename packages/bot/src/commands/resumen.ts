import type { BotContext } from "../types.js";
import { prisma } from "@mediabot/shared";

export async function handleResumen(ctx: BotContext) {
  if (!ctx.session.orgId) {
    await ctx.reply("No estas registrado en el sistema.");
    return;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const clients = await prisma.client.findMany({
    where: { orgId: ctx.session.orgId, active: true },
    include: {
      mentions: {
        where: { createdAt: { gte: since } },
        orderBy: { relevance: "desc" },
        take: 3,
        include: { article: true },
      },
      _count: {
        select: {
          mentions: { where: { createdAt: { gte: since } } },
        },
      },
    },
  });

  if (clients.length === 0) {
    await ctx.reply("No hay clientes registrados.");
    return;
  }

  let message = `📊 Resumen del dia (ultimas 24h):\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const client of clients) {
    const total = client._count.mentions;
    message += `📌 *${client.name}*: ${total} menciones\n`;

    if (client.mentions.length > 0) {
      for (const mention of client.mentions) {
        const sentIcon =
          mention.sentiment === "POSITIVE"
            ? "🟢"
            : mention.sentiment === "NEGATIVE"
              ? "🔴"
              : "⚪";
        message += `  ${sentIcon} ${mention.article.title.slice(0, 60)}...\n`;
        message += `     Relevancia: ${mention.relevance}/10\n`;
      }
    } else {
      message += `  Sin menciones recientes\n`;
    }
    message += "\n";
  }

  await ctx.reply(message);
}
