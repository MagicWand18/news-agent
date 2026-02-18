import { prisma, getSettingNumber, config } from "@mediabot/shared";
import { publishRealtimeEvent } from "@mediabot/shared/src/realtime-publisher.js";
import { REALTIME_CHANNELS } from "@mediabot/shared/src/realtime-types.js";
import { getQueue, QUEUE_NAMES } from "../queues.js";
import type { CrisisTriggerType, CrisisSeverity } from "@prisma/client";

interface CrisisCheckResult {
  isCrisis: boolean;
  triggerType?: CrisisTriggerType;
  severity?: CrisisSeverity;
  mentionCount?: number;
  reason?: string;
}

/**
 * Check if a client is experiencing a crisis based on recent negative mentions
 */
export async function checkForCrisis(clientId: string): Promise<CrisisCheckResult> {
  // Get settings for crisis detection
  const threshold = await getSettingNumber(
    "crisis.negative_spike_threshold",
    config.crisis.negativeMentionThreshold
  );
  const windowMinutes = await getSettingNumber(
    "crisis.window_minutes",
    config.crisis.windowMinutes
  );

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  // Count recent negative mentions for this client
  const recentNegativeMentions = await prisma.mention.count({
    where: {
      clientId,
      sentiment: "NEGATIVE",
      publishedAt: { gte: windowStart },
    },
  });

  // Check if there's already an active crisis alert for this client
  const existingAlert = await prisma.crisisAlert.findFirst({
    where: {
      clientId,
      status: { in: ["ACTIVE", "MONITORING"] },
    },
  });

  if (existingAlert) {
    // Update mention count on existing alert
    await prisma.crisisAlert.update({
      where: { id: existingAlert.id },
      data: { mentionCount: recentNegativeMentions },
    });

    return {
      isCrisis: false,
      reason: `Active crisis alert already exists (ID: ${existingAlert.id})`,
    };
  }

  // Check for crisis threshold
  if (recentNegativeMentions >= threshold) {
    // Determine severity based on mention count
    let severity: CrisisSeverity = "MEDIUM";
    if (recentNegativeMentions >= threshold * 3) {
      severity = "CRITICAL";
    } else if (recentNegativeMentions >= threshold * 2) {
      severity = "HIGH";
    }

    return {
      isCrisis: true,
      triggerType: "NEGATIVE_SPIKE",
      severity,
      mentionCount: recentNegativeMentions,
      reason: `${recentNegativeMentions} negative mentions in last ${windowMinutes} minutes`,
    };
  }

  return {
    isCrisis: false,
    mentionCount: recentNegativeMentions,
    reason: `Only ${recentNegativeMentions} negative mentions (threshold: ${threshold})`,
  };
}

/**
 * Create a crisis alert and enqueue notification
 */
export async function createCrisisAlert(
  clientId: string,
  triggerType: CrisisTriggerType,
  severity: CrisisSeverity,
  mentionCount: number
): Promise<string> {
  const crisisAlert = await prisma.crisisAlert.create({
    data: {
      clientId,
      triggerType,
      severity,
      mentionCount,
      status: "ACTIVE",
    },
  });

  console.log(
    `🚨 Crisis alert created: client=${clientId} severity=${severity} mentions=${mentionCount}`
  );

  // Publicar evento realtime de crisis
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { orgId: true } });
  publishRealtimeEvent(REALTIME_CHANNELS.CRISIS_NEW, {
    id: crisisAlert.id,
    clientId,
    orgId: client?.orgId ?? null,
    severity,
    timestamp: new Date().toISOString(),
  });

  // Enqueue crisis notification
  const notifyQueue = getQueue(QUEUE_NAMES.NOTIFY_CRISIS);
  await notifyQueue.add(
    "crisis-alert",
    { crisisAlertId: crisisAlert.id },
    { priority: severity === "CRITICAL" ? 1 : severity === "HIGH" ? 2 : 3 }
  );

  return crisisAlert.id;
}

/**
 * Process a mention for potential crisis detection
 * Called after analyzing a mention with NEGATIVE sentiment
 */
export async function processMentionForCrisis(mentionId: string): Promise<void> {
  const mention = await prisma.mention.findUnique({
    where: { id: mentionId },
    select: {
      id: true,
      sentiment: true,
      clientId: true,
      urgency: true,
    },
  });

  if (!mention || mention.sentiment !== "NEGATIVE") {
    return;
  }

  // Check for crisis conditions
  const crisisCheck = await checkForCrisis(mention.clientId);

  if (crisisCheck.isCrisis && crisisCheck.triggerType && crisisCheck.severity) {
    await createCrisisAlert(
      mention.clientId,
      crisisCheck.triggerType,
      crisisCheck.severity,
      crisisCheck.mentionCount || 0
    );
  }
}

/**
 * Get active crisis alerts for a client
 */
export async function getActiveAlerts(clientId?: string) {
  return prisma.crisisAlert.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      status: { in: ["ACTIVE", "MONITORING"] },
    },
    include: {
      client: {
        select: { id: true, name: true, telegramGroupId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Resolve a crisis alert
 */
export async function resolveCrisisAlert(
  alertId: string,
  resolvedBy: string,
  notes?: string
): Promise<void> {
  await prisma.crisisAlert.update({
    where: { id: alertId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy,
      notes,
    },
  });

  console.log(`✅ Crisis alert resolved: ${alertId} by ${resolvedBy}`);
}
