import type { Bot } from "grammy";
import type { BotContext } from "../types.js";
import { handleStart } from "./start.js";
import { handleHelp } from "./help.js";
import { handleStatus } from "./status.js";
import { handleClientes } from "./clientes.js";
import { handleKeywords } from "./keywords.js";
import { handleVincular } from "./vincular.js";
import { handleMisTareas } from "./mis-tareas.js";
import { handlePendientes } from "./pendientes.js";
import { handleResumen } from "./resumen.js";
import { handleCallbacks } from "./callbacks.js";

export function registerCommands(bot: Bot<BotContext>) {
  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("status", handleStatus);
  bot.command("cliente", async (ctx) => {
    await ctx.conversation.enter("newClientConversation");
  });
  bot.command("clientes", handleClientes);
  bot.command("keywords", handleKeywords);
  bot.command("vincular", handleVincular);
  bot.command("tarea", async (ctx) => {
    await ctx.conversation.enter("newTaskConversation");
  });
  bot.command("mistareas", handleMisTareas);
  bot.command("pendientes", handlePendientes);
  bot.command("resumen", handleResumen);

  // Inline button callbacks
  handleCallbacks(bot);
}
