import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de módulos antes de importar
vi.mock("@mediabot/shared", () => ({
  prisma: {
    mention: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    crisisAlert: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  getSettingNumber: vi.fn(),
  config: {
    crisis: {
      negativeMentionThreshold: 5,
      windowMinutes: 60,
    },
  },
}));

vi.mock("../../queues.js", () => ({
  getQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue({}),
  }),
  QUEUE_NAMES: {
    NOTIFY_CRISIS: "notify-crisis",
  },
}));

import { prisma, getSettingNumber, config } from "@mediabot/shared";
import { getQueue } from "../../queues.js";
import {
  checkForCrisis,
  createCrisisAlert,
  processMentionForCrisis,
  resolveCrisisAlert,
  getActiveAlerts,
} from "../crisis-detector";

describe("crisis-detector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks
    vi.mocked(getSettingNumber).mockImplementation(async (key, defaultValue) => defaultValue);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkForCrisis", () => {
    it("should detect crisis when threshold is exceeded", async () => {
      const clientId = "client-123";

      // Simular 7 menciones negativas (umbral es 5)
      vi.mocked(prisma.mention.count).mockResolvedValue(7);
      // No hay alerta activa
      vi.mocked(prisma.crisisAlert.findFirst).mockResolvedValue(null);

      const result = await checkForCrisis(clientId);

      expect(result.isCrisis).toBe(true);
      expect(result.triggerType).toBe("NEGATIVE_SPIKE");
      expect(result.mentionCount).toBe(7);
      expect(result.severity).toBe("MEDIUM"); // 7 < 10 (threshold * 2)
    });

    it("should classify severity as HIGH when mentions >= 2x threshold", async () => {
      const clientId = "client-123";

      // Simular 12 menciones negativas (umbral es 5, 2x = 10)
      vi.mocked(prisma.mention.count).mockResolvedValue(12);
      vi.mocked(prisma.crisisAlert.findFirst).mockResolvedValue(null);

      const result = await checkForCrisis(clientId);

      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe("HIGH"); // 12 >= 10 pero < 15
    });

    it("should classify severity as CRITICAL when mentions >= 3x threshold", async () => {
      const clientId = "client-123";

      // Simular 20 menciones negativas (umbral es 5, 3x = 15)
      vi.mocked(prisma.mention.count).mockResolvedValue(20);
      vi.mocked(prisma.crisisAlert.findFirst).mockResolvedValue(null);

      const result = await checkForCrisis(clientId);

      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe("CRITICAL");
    });

    it("should not detect crisis when below threshold", async () => {
      const clientId = "client-123";

      // Simular 3 menciones negativas (umbral es 5)
      vi.mocked(prisma.mention.count).mockResolvedValue(3);
      vi.mocked(prisma.crisisAlert.findFirst).mockResolvedValue(null);

      const result = await checkForCrisis(clientId);

      expect(result.isCrisis).toBe(false);
      expect(result.mentionCount).toBe(3);
      expect(result.reason).toContain("Only 3");
    });

    it("should not create duplicate alert when one is already active", async () => {
      const clientId = "client-123";
      const existingAlert = {
        id: "alert-existing",
        clientId,
        status: "ACTIVE",
        triggerType: "NEGATIVE_SPIKE",
        severity: "MEDIUM",
        mentionCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
        notes: null,
        notified: false,
        notifiedAt: null,
      };

      vi.mocked(prisma.mention.count).mockResolvedValue(10);
      vi.mocked(prisma.crisisAlert.findFirst).mockResolvedValue(existingAlert as never);
      vi.mocked(prisma.crisisAlert.update).mockResolvedValue({
        ...existingAlert,
        mentionCount: 10,
      } as never);

      const result = await checkForCrisis(clientId);

      expect(result.isCrisis).toBe(false);
      expect(result.reason).toContain("Active crisis alert already exists");

      // Debería actualizar el conteo de menciones
      expect(prisma.crisisAlert.update).toHaveBeenCalledWith({
        where: { id: existingAlert.id },
        data: { mentionCount: 10 },
      });
    });

    it("should not duplicate for MONITORING status", async () => {
      const clientId = "client-123";
      const monitoringAlert = {
        id: "alert-monitoring",
        clientId,
        status: "MONITORING",
        triggerType: "NEGATIVE_SPIKE",
        severity: "HIGH",
        mentionCount: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
        notes: null,
        notified: false,
        notifiedAt: null,
      };

      vi.mocked(prisma.mention.count).mockResolvedValue(15);
      vi.mocked(prisma.crisisAlert.findFirst).mockResolvedValue(monitoringAlert as never);
      vi.mocked(prisma.crisisAlert.update).mockResolvedValue({
        ...monitoringAlert,
        mentionCount: 15,
      } as never);

      const result = await checkForCrisis(clientId);

      expect(result.isCrisis).toBe(false);
    });

    it("should use custom settings from database", async () => {
      const clientId = "client-123";

      // Configuración personalizada: umbral 10, ventana 120 minutos
      vi.mocked(getSettingNumber)
        .mockResolvedValueOnce(10) // threshold
        .mockResolvedValueOnce(120); // window

      vi.mocked(prisma.mention.count).mockResolvedValue(8);
      vi.mocked(prisma.crisisAlert.findFirst).mockResolvedValue(null);

      const result = await checkForCrisis(clientId);

      // 8 < 10 (nuevo umbral), no debería ser crisis
      expect(result.isCrisis).toBe(false);
    });
  });

  describe("createCrisisAlert", () => {
    it("should create alert and enqueue notification", async () => {
      const clientId = "client-123";
      const createdAlert = {
        id: "alert-new",
        clientId,
        triggerType: "NEGATIVE_SPIKE" as const,
        severity: "HIGH" as const,
        mentionCount: 12,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
        notes: null,
        notified: false,
        notifiedAt: null,
      };

      vi.mocked(prisma.crisisAlert.create).mockResolvedValue(createdAlert as never);

      const mockQueue = { add: vi.fn().mockResolvedValue({}) };
      vi.mocked(getQueue).mockReturnValue(mockQueue as never);

      const alertId = await createCrisisAlert(
        clientId,
        "NEGATIVE_SPIKE",
        "HIGH",
        12
      );

      expect(alertId).toBe("alert-new");

      // Verificar que se creó con los datos correctos
      expect(prisma.crisisAlert.create).toHaveBeenCalledWith({
        data: {
          clientId,
          triggerType: "NEGATIVE_SPIKE",
          severity: "HIGH",
          mentionCount: 12,
          status: "ACTIVE",
        },
      });

      // Verificar que se encoló la notificación
      expect(mockQueue.add).toHaveBeenCalledWith(
        "crisis-alert",
        { crisisAlertId: "alert-new" },
        { priority: 2 } // HIGH = priority 2
      );
    });

    it("should set priority 1 for CRITICAL severity", async () => {
      const createdAlert = {
        id: "alert-critical",
        clientId: "client-123",
        triggerType: "NEGATIVE_SPIKE" as const,
        severity: "CRITICAL" as const,
        mentionCount: 20,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
        notes: null,
        notified: false,
        notifiedAt: null,
      };

      vi.mocked(prisma.crisisAlert.create).mockResolvedValue(createdAlert as never);

      const mockQueue = { add: vi.fn().mockResolvedValue({}) };
      vi.mocked(getQueue).mockReturnValue(mockQueue as never);

      await createCrisisAlert("client-123", "NEGATIVE_SPIKE", "CRITICAL", 20);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "crisis-alert",
        expect.anything(),
        { priority: 1 }
      );
    });

    it("should set priority 3 for MEDIUM severity", async () => {
      const createdAlert = {
        id: "alert-medium",
        clientId: "client-123",
        triggerType: "NEGATIVE_SPIKE" as const,
        severity: "MEDIUM" as const,
        mentionCount: 6,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
        notes: null,
        notified: false,
        notifiedAt: null,
      };

      vi.mocked(prisma.crisisAlert.create).mockResolvedValue(createdAlert as never);

      const mockQueue = { add: vi.fn().mockResolvedValue({}) };
      vi.mocked(getQueue).mockReturnValue(mockQueue as never);

      await createCrisisAlert("client-123", "NEGATIVE_SPIKE", "MEDIUM", 6);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "crisis-alert",
        expect.anything(),
        { priority: 3 }
      );
    });
  });

  describe("processMentionForCrisis", () => {
    it("should check for crisis when mention is NEGATIVE", async () => {
      const mentionId = "mention-123";
      const mention = {
        id: mentionId,
        sentiment: "NEGATIVE",
        clientId: "client-123",
        urgency: "HIGH",
      };

      vi.mocked(prisma.mention.findUnique).mockResolvedValue(mention as never);
      vi.mocked(prisma.mention.count).mockResolvedValue(3); // Por debajo del umbral
      vi.mocked(prisma.crisisAlert.findFirst).mockResolvedValue(null);

      await processMentionForCrisis(mentionId);

      expect(prisma.mention.count).toHaveBeenCalled();
    });

    it("should not process non-NEGATIVE mentions", async () => {
      const mentionId = "mention-123";
      const mention = {
        id: mentionId,
        sentiment: "POSITIVE",
        clientId: "client-123",
        urgency: "LOW",
      };

      vi.mocked(prisma.mention.findUnique).mockResolvedValue(mention as never);

      await processMentionForCrisis(mentionId);

      // No debería llamar a count porque no es NEGATIVE
      expect(prisma.mention.count).not.toHaveBeenCalled();
    });

    it("should do nothing when mention not found", async () => {
      vi.mocked(prisma.mention.findUnique).mockResolvedValue(null);

      await processMentionForCrisis("non-existent");

      expect(prisma.mention.count).not.toHaveBeenCalled();
    });
  });

  describe("resolveCrisisAlert", () => {
    it("should update alert with resolution data", async () => {
      const alertId = "alert-123";
      const resolvedBy = "user-456";
      const notes = "Crisis resolved after public statement";

      vi.mocked(prisma.crisisAlert.update).mockResolvedValue({
        id: alertId,
        status: "RESOLVED",
        resolvedAt: expect.any(Date),
        resolvedBy,
        notes,
      } as never);

      await resolveCrisisAlert(alertId, resolvedBy, notes);

      expect(prisma.crisisAlert.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: {
          status: "RESOLVED",
          resolvedAt: expect.any(Date),
          resolvedBy,
          notes,
        },
      });
    });

    it("should resolve without notes", async () => {
      const alertId = "alert-123";
      const resolvedBy = "user-456";

      vi.mocked(prisma.crisisAlert.update).mockResolvedValue({} as never);

      await resolveCrisisAlert(alertId, resolvedBy);

      expect(prisma.crisisAlert.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: {
          status: "RESOLVED",
          resolvedAt: expect.any(Date),
          resolvedBy,
          notes: undefined,
        },
      });
    });
  });
});
