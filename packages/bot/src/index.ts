import "dotenv/config";
import { createBot } from "./bot.js";

async function main() {
  const bot = createBot();

  console.log("🤖 MediaBot starting...");

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ MediaBot @${botInfo.username} is running`);
    },
  });
}

main().catch(console.error);
