import { router } from "../trpc";
import { dashboardRouter } from "./dashboard";
import { clientsRouter } from "./clients";
import { mentionsRouter } from "./mentions";
import { tasksRouter } from "./tasks";
import { teamRouter } from "./team";
import { settingsRouter } from "./settings";
import { intelligenceRouter } from "./intelligence";
import { sourcesRouter } from "./sources";
import { notificationsRouter } from "./notifications";
import { socialRouter } from "./social";
import { organizationsRouter } from "./organizations";
import { onboardingRouter } from "./onboarding";

export const appRouter = router({
  dashboard: dashboardRouter,
  clients: clientsRouter,
  mentions: mentionsRouter,
  tasks: tasksRouter,
  team: teamRouter,
  settings: settingsRouter,
  intelligence: intelligenceRouter,
  sources: sourcesRouter,
  notifications: notificationsRouter,
  social: socialRouter,
  organizations: organizationsRouter,
  onboarding: onboardingRouter,
});

export type AppRouter = typeof appRouter;
