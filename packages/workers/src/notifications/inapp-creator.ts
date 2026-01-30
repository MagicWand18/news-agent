import { prisma } from "@mediabot/shared";
import { Prisma, type NotificationType } from "@prisma/client";

/**
 * Parámetros para crear una notificación in-app
 */
export interface CreateInAppNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

/**
 * Crea una notificación in-app para un usuario específico.
 */
export async function createInAppNotification(
  params: CreateInAppNotificationParams
): Promise<void> {
  const { userId, type, title, message, data } = params;

  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ?? Prisma.JsonNull,
      },
    });

    console.log(`📱 In-app notification created: ${type} for user ${userId}`);
  } catch (error) {
    console.error(`Failed to create in-app notification:`, error);
    throw error;
  }
}

/**
 * Crea notificaciones in-app para todos los usuarios de una organización.
 */
export async function createInAppNotificationForOrg(
  orgId: string,
  params: Omit<CreateInAppNotificationParams, "userId">
): Promise<number> {
  const { type, title, message, data } = params;

  try {
    // Obtener todos los usuarios de la organización
    const users = await prisma.user.findMany({
      where: { orgId },
      select: { id: true },
    });

    if (users.length === 0) {
      console.warn(`No users found for org ${orgId}`);
      return 0;
    }

    // Crear notificaciones para todos los usuarios
    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type,
        title,
        message,
        data: data ?? Prisma.JsonNull,
      })),
    });

    console.log(
      `📱 In-app notifications created: ${type} for ${users.length} users in org ${orgId}`
    );

    return users.length;
  } catch (error) {
    console.error(`Failed to create org-wide in-app notifications:`, error);
    throw error;
  }
}

/**
 * Crea notificación de mención crítica/alta para usuarios de la organización del cliente.
 */
export async function createMentionNotification(params: {
  clientId: string;
  clientName: string;
  mentionId: string;
  articleTitle: string;
  urgency: "CRITICAL" | "HIGH";
  sentiment: string;
}): Promise<void> {
  const { clientId, clientName, mentionId, articleTitle, urgency, sentiment } =
    params;

  // Obtener el orgId del cliente
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { orgId: true },
  });

  if (!client) {
    console.warn(`Client ${clientId} not found for mention notification`);
    return;
  }

  const type = urgency === "CRITICAL" ? "MENTION_CRITICAL" : "MENTION_HIGH";
  const icon = urgency === "CRITICAL" ? "🔴" : "🟠";

  await createInAppNotificationForOrg(client.orgId, {
    type: type as NotificationType,
    title: `${icon} ${clientName}: Mención ${urgency === "CRITICAL" ? "crítica" : "importante"}`,
    message: articleTitle.slice(0, 200),
    data: {
      mentionId,
      clientId,
      sentiment,
      urgency,
    },
  });
}

/**
 * Crea notificación de alerta de crisis para usuarios de la organización.
 */
export async function createCrisisNotification(params: {
  clientId: string;
  clientName: string;
  crisisAlertId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  mentionCount: number;
  triggerType: string;
}): Promise<void> {
  const {
    clientId,
    clientName,
    crisisAlertId,
    severity,
    mentionCount,
    triggerType,
  } = params;

  // Obtener el orgId del cliente
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { orgId: true },
  });

  if (!client) {
    console.warn(`Client ${clientId} not found for crisis notification`);
    return;
  }

  const icon =
    severity === "CRITICAL" ? "🚨" : severity === "HIGH" ? "⚠️" : "⚡";
  const severityLabel =
    severity === "CRITICAL" ? "CRÍTICA" : severity === "HIGH" ? "ALTA" : "MEDIA";

  await createInAppNotificationForOrg(client.orgId, {
    type: "CRISIS_ALERT" as NotificationType,
    title: `${icon} Alerta de Crisis: ${clientName}`,
    message: `Severidad ${severityLabel} - ${mentionCount} menciones negativas detectadas`,
    data: {
      crisisAlertId,
      clientId,
      severity,
      triggerType,
      mentionCount,
    },
  });
}

/**
 * Crea notificación de tema emergente para usuarios de la organización.
 */
export async function createEmergingTopicNotification(params: {
  clientId: string;
  clientName: string;
  topic: string;
  count: number;
  clientMentionCount: number;
}): Promise<void> {
  const { clientId, clientName, topic, count, clientMentionCount } = params;

  // Obtener el orgId del cliente
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { orgId: true },
  });

  if (!client) {
    console.warn(`Client ${clientId} not found for emerging topic notification`);
    return;
  }

  await createInAppNotificationForOrg(client.orgId, {
    type: "EMERGING_TOPIC" as NotificationType,
    title: `📈 Tema Emergente: ${topic}`,
    message: `${clientName}: ${clientMentionCount} menciones de ${count} totales en las últimas 24h`,
    data: {
      clientId,
      topic,
      totalCount: count,
      clientMentionCount,
    },
  });
}

/**
 * Crea notificación de reporte semanal disponible.
 */
export async function createWeeklyReportNotification(params: {
  clientId: string;
  clientName: string;
  weekStart: Date;
  mentionCount: number;
}): Promise<void> {
  const { clientId, clientName, weekStart, mentionCount } = params;

  // Obtener el orgId del cliente
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { orgId: true },
  });

  if (!client) {
    console.warn(`Client ${clientId} not found for weekly report notification`);
    return;
  }

  const weekStartStr = weekStart.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });

  await createInAppNotificationForOrg(client.orgId, {
    type: "WEEKLY_REPORT" as NotificationType,
    title: `📊 Reporte Semanal: ${clientName}`,
    message: `Semana del ${weekStartStr} - ${mentionCount} menciones analizadas`,
    data: {
      clientId,
      weekStart: weekStart.toISOString(),
      mentionCount,
    },
  });
}
