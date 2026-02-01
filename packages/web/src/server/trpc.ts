import { initTRPC, TRPCError } from "@trpc/server";
import { getServerSession } from "next-auth";
import superjson from "superjson";
import { authOptions } from "@/lib/auth";

export async function createContext() {
  const session = await getServerSession(authOptions);
  return { session };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Tipo del usuario autenticado
export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  orgId: string | null;
  isSuperAdmin: boolean;
};

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user as AuthenticatedUser,
    },
  });
});

// Procedure para Super Admin solamente
export const superAdminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const user = ctx.session.user as AuthenticatedUser;
  if (!user.isSuperAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso restringido a Super Admin",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
      user,
    },
  });
});

/**
 * Obtiene el orgId efectivo para consultas.
 * - Si el usuario es Super Admin y proporciona un orgId, usa ese.
 * - Si el usuario es Super Admin sin orgId específico, retorna null (todos).
 * - Si el usuario NO es Super Admin, siempre usa su propio orgId.
 */
export function getEffectiveOrgId(
  user: AuthenticatedUser,
  requestedOrgId?: string | null
): string | null {
  if (user.isSuperAdmin) {
    // Super Admin puede ver cualquier org o todas si no especifica
    return requestedOrgId ?? null;
  }
  // Usuario normal siempre ve solo su org
  return user.orgId;
}

/**
 * Genera la cláusula where para filtrar por organización.
 * Retorna undefined si no hay restricción (Super Admin viendo todo).
 */
export function getOrgFilter(
  user: AuthenticatedUser,
  requestedOrgId?: string | null
): { orgId: string } | undefined {
  const effectiveOrgId = getEffectiveOrgId(user, requestedOrgId);
  if (effectiveOrgId === null) {
    // Super Admin viendo todo, sin filtro de org
    return undefined;
  }
  return { orgId: effectiveOrgId };
}

/**
 * Verifica si el usuario tiene acceso a un recurso por orgId.
 * - Super Admin tiene acceso a todo.
 * - Usuario normal solo accede si el recurso es de su org.
 */
export function canAccessResource(user: AuthenticatedUser, resourceOrgId: string | null): boolean {
  if (user.isSuperAdmin) return true;
  return user.orgId === resourceOrgId;
}

/**
 * Construye un filtro de organización para queries.
 * Retorna un objeto vacío para Super Admin (sin filtro),
 * o { orgId: string } para usuarios normales.
 */
export function buildOrgCondition(user: AuthenticatedUser): Record<string, never> | { orgId: string } {
  if (user.isSuperAdmin) return {};
  return { orgId: user.orgId! };
}

/**
 * Construye un filtro de organización anidado (para relaciones).
 * Retorna un objeto vacío para Super Admin (sin filtro),
 * o { client: { orgId: string } } para usuarios normales.
 */
export function buildClientOrgCondition(user: AuthenticatedUser): Record<string, never> | { client: { orgId: string } } {
  if (user.isSuperAdmin) return {};
  return { client: { orgId: user.orgId! } };
}
