import { Bot, session, GrammyError, HttpError } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { hydrate } from "@grammyjs/hydrate";
import type { BotContext, SessionData } from "./types.js";
import { authMiddleware } from "./middleware/auth.js";
import { registerCommands } from "./commands/index.js";
import { newClientConversation } from "./conversations/new-client.js";
import { newTaskConversation } from "./conversations/new-task.js";
import { config } from "@mediabot/shared";

export function createBot() {
  const bot = new Bot<BotContext>(config.telegram.botToken);

  // Plugins
  bot.use(hydrate());
  bot.use(
    session({
      initial: (): SessionData => ({
        userId: undefined,
        orgId: undefined,
      }),
    })
  );
  bot.use(conversations());
  bot.use(createConversation(newClientConversation));
  bot.use(createConversation(newTaskConversation));

  // Middleware
  bot.use(authMiddleware);

  // Commands
  registerCommands(bot);

  // Error handling
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Could not contact Telegram:", e);
    } else {
      console.error("Unknown error:", e);
    }
  });

  return bot;
}
