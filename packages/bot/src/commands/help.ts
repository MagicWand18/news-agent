import type { BotContext } from "../types.js";

export async function handleHelp(ctx: BotContext) {
  await ctx.reply(
    `📋 *Comandos disponibles:*\n\n` +
      `*Clientes*\n` +
      `/cliente \\- Agregar nuevo cliente \\(con IA\\)\n` +
      `/clientes \\- Ver lista de clientes\n` +
      `/keywords \\<cliente\\> \\- Ver/gestionar keywords\n\n` +
      `*Telegram*\n` +
      `/vincular \\<cliente\\> \\[tipo\\] \\- Vincular grupo/chat\n` +
      `/desvincular \\<cliente\\> \\- Desvincular este chat\n` +
      `/destinatarios \\<cliente\\> \\- Ver destinatarios\n\n` +
      `*Tareas*\n` +
      `/tarea \\- Crear nueva tarea\n` +
      `/mistareas \\- Ver mis tareas asignadas\n` +
      `/pendientes \\- Ver tareas pendientes\n\n` +
      `*General*\n` +
      `/resumen \\- Resumen del dia por cliente\n` +
      `/status \\- Estado del sistema\n` +
      `/help \\- Este mensaje`,
    { parse_mode: "MarkdownV2" }
  );
}
