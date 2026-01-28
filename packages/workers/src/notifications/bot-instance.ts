import { Bot } from "grammy";
import { config } from "@mediabot/shared";

// Shared Bot instance for all notification workers
export const bot = new Bot(config.telegram.botToken);
