import type { Context, SessionFlavor } from "grammy";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { ConversationFlavor } from "@grammyjs/conversations";

export interface SessionData {
  userId?: string;
  orgId?: string;
}

export type BotContext = HydrateFlavor<
  Context & SessionFlavor<SessionData> & ConversationFlavor
>;
