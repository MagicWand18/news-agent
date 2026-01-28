import { router } from "../trpc";
import { dashboardRouter } from "./dashboard";
import { clientsRouter } from "./clients";
import { mentionsRouter } from "./mentions";
import { tasksRouter } from "./tasks";
import { teamRouter } from "./team";
import { settingsRouter } from "./settings";

export const appRouter = router({
  dashboard: dashboardRouter,
  clients: clientsRouter,
  mentions: mentionsRouter,
  tasks: tasksRouter,
  team: teamRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
