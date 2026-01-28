import { Queue } from "bullmq";
import { config } from "./config.js";

// Parse Redis URL to get host/port for BullMQ connection
function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
  };
}

const connection = parseRedisUrl(config.redis.url);

// Queue names (must match workers package)
export const QUEUE_NAMES = {
  COLLECT_GDELT: "collect-gdelt",
  COLLECT_NEWSDATA: "collect-newsdata",
  COLLECT_RSS: "collect-rss",
  COLLECT_GOOGLE: "collect-google",
  INGEST_ARTICLE: "ingest-article",
  ANALYZE_MENTION: "analyze-mention",
  NOTIFY_ALERT: "notify-alert",
  DIGEST: "notify-digest",
  ONBOARDING: "onboarding",
} as const;

// Lazy-initialized queues to avoid creating connections on import
const queues = new Map<string, Queue>();

/**
 * Get a queue instance for enqueuing jobs from web package.
 * Creates the queue lazily on first access.
 */
export function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection });
    queues.set(name, queue);
  }
  return queue;
}

/**
 * Get the onboarding queue specifically.
 * Convenience function for the most common use case.
 */
export function getOnboardingQueue(): Queue {
  return getQueue(QUEUE_NAMES.ONBOARDING);
}

/**
 * Close all queue connections gracefully.
 * Should be called on app shutdown.
 */
export async function closeQueues(): Promise<void> {
  await Promise.all(Array.from(queues.values()).map((q) => q.close()));
  queues.clear();
}
