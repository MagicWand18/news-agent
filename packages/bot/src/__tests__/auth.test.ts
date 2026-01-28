import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();

vi.mock("@mediabot/shared", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
  config: {
    database: { url: "test" },
    redis: { url: "redis://localhost:6379" },
    telegram: { botToken: "test" },
    anthropic: { apiKey: "test", model: "test" },
  },
}));

const { authMiddleware } = await import("../middleware/auth.js");

function createMockContext(overrides: Record<string, any> = {}) {
  return {
    from: { id: 12345 },
    session: { userId: undefined, orgId: undefined },
    message: { text: "" },
    reply: vi.fn(),
    ...overrides,
  } as any;
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set session data for registered users", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-123",
      orgId: "org-456",
      telegramUserId: "12345",
    });
    const next = vi.fn();
    const ctx = createMockContext();

    await authMiddleware(ctx, next);

    expect(ctx.session.userId).toBe("user-123");
    expect(ctx.session.orgId).toBe("org-456");
    expect(next).toHaveBeenCalled();
  });

  it("should allow /start for unregistered users", async () => {
    mockFindUnique.mockResolvedValue(null);
    const next = vi.fn();
    const ctx = createMockContext({ message: { text: "/start" } });

    await authMiddleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("should allow /help for unregistered users", async () => {
    mockFindUnique.mockResolvedValue(null);
    const next = vi.fn();
    const ctx = createMockContext({ message: { text: "/help" } });

    await authMiddleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("should block other commands for unregistered users", async () => {
    mockFindUnique.mockResolvedValue(null);
    const next = vi.fn();
    const ctx = createMockContext({ message: { text: "/clientes" } });

    await authMiddleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("No estas registrado")
    );
  });

  it("should pass through non-command messages from unregistered users", async () => {
    mockFindUnique.mockResolvedValue(null);
    const next = vi.fn();
    const ctx = createMockContext({ message: { text: "hello" } });

    await authMiddleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("should pass through when ctx.from is undefined", async () => {
    const next = vi.fn();
    const ctx = createMockContext({ from: undefined });

    await authMiddleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
