# Plan: Sistema Multi-Tenant con Agencias y Onboarding

**Fecha:** 2026-02-01
**Modo:** --feature
**Estado:** 🟢 Implementado (Fases 1-5)

---

## Estado de Implementación

| Fase | Estado | Notas |
|------|--------|-------|
| 1. Schema y Backend Base | ✅ Completado | `isSuperAdmin`, `OnboardingStatus` enum, helpers en trpc.ts |
| 2. Router de Organizaciones | ✅ Completado | Todos los endpoints implementados |
| 3. Modificar Routers | ✅ Completado | Soporte Super Admin en todos los routers |
| 4. UI - Página de Agencias | ✅ Completado | Lista, detalle, crear/editar, reasignar |
| 5. UI - Sidebar | ✅ Completado | Menú "Agencias" visible solo para Super Admin |
| 6. Sistema de Onboarding | ⏳ Pendiente | React Joyride - implementar en siguiente iteración |
| 7. Correcciones de Seguridad | ✅ Completado | 8 hallazgos corregidos (ver abajo) |

### Correcciones de Seguridad (2026-02-01)

| # | Severidad | Issue | Archivo | Estado |
|---|-----------|-------|---------|--------|
| 1 | HIGH | `throw new Error()` → `TRPCError` | `intelligence.ts:32` | ✅ |
| 2 | HIGH | `throw new Error()` → `TRPCError` | `mentions.ts:113` | ✅ |
| 3 | MEDIUM | JSON.parse sin validación Zod | `clients.ts` | ✅ `OnboardingConfigSchema` |
| 4 | MEDIUM | JSON.parse sin validación Zod | `social.ts` | ✅ `HashtagSuggestionSchema` |
| 5 | MEDIUM | JSON.parse sin validación Zod | `mentions.ts` | ✅ `ResponseGenerationSchema` |
| 6 | MEDIUM | Logs exponen errores completos | `clients.ts:408` | ✅ Sanitizado |
| 7 | MEDIUM | Parámetros sin `.max()` | Múltiples | ✅ Límites agregados |
| 8 | HIGH | Error message expuesto al cliente | `social.ts:741` | ✅ Sanitizado |

**Pendiente antes de producción:**
1. Ejecutar `npx prisma db push` en el servidor de producción
2. Crear un Super Admin inicial: `UPDATE "User" SET "isSuperAdmin" = true WHERE email = 'admin@mediabot.local';`
3. Probar funcionalidad completa de Multi-Tenant
4. ~~Correcciones de seguridad~~ ✅

---

## Descripción

Implementar soporte para múltiples agencias de PR que puedan usar MediaBot de forma independiente, con un Super Admin que gestione todo el sistema y un tutorial interactivo para nuevos usuarios.

## Requerimientos

1. **Super Admin** - Rol que puede ver y gestionar todas las organizaciones
2. **CRUD de Agencias** - Crear, editar, eliminar organizaciones
3. **Asignación de clientes** - Mover clientes entre organizaciones
4. **Onboarding** - Tutorial guiado para nuevos usuarios

## Contexto del Codebase

### Patrones identificados:
- Multi-tenancy existente via `Organization` y `orgId`
- Roles: ADMIN, SUPERVISOR, ANALYST (enum en Prisma)
- Autenticación: NextAuth con JWT
- Filtrado: `where: { orgId: ctx.user.orgId }` en todos los routers

### Archivos relacionados:
- `prisma/schema.prisma` - Modelos Organization, User, Client
- `packages/web/src/lib/auth.ts` - Configuración NextAuth
- `packages/web/src/server/trpc.ts` - Middlewares de autorización
- `packages/web/src/server/routers/*.ts` - Routers tRPC
- `packages/web/src/components/sidebar.tsx` - Navegación principal

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPER ADMIN                               │
│  (isSuperAdmin=true, orgId=null)                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Agencia A   │   │   Agencia B   │   │   Agencia C   │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ ADMIN         │   │ ADMIN         │   │ ADMIN         │
│ SUPERVISOR    │   │ SUPERVISOR    │   │ SUPERVISOR    │
│ ANALYST       │   │ ANALYST       │   │ ANALYST       │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ Clientes...   │   │ Clientes...   │   │ Clientes...   │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Plan de Implementación

### Fase 1: Schema y Backend Base

**Cambios a Prisma (`prisma/schema.prisma`):**
- Agregar `isSuperAdmin: Boolean @default(false)` a User
- Hacer `orgId` opcional (`String?`)
- Agregar `OnboardingStatus` enum y campos relacionados

**Cambios a Auth (`packages/web/src/lib/auth.ts`):**
- Propagar `isSuperAdmin` en JWT y session

**Cambios a tRPC (`packages/web/src/server/trpc.ts`):**
- Crear `superAdminProcedure` middleware
- Crear helper `getEffectiveOrgId(ctx, requestedOrgId)`

### Fase 2: Router de Organizaciones

**Nuevo archivo:** `packages/web/src/server/routers/organizations.ts`

| Endpoint | Tipo | Descripción |
|----------|------|-------------|
| `list` | Query | Lista todas las organizaciones |
| `getById` | Query | Detalle con usuarios y clientes |
| `create` | Mutation | Crear organización |
| `update` | Mutation | Editar organización |
| `delete` | Mutation | Eliminar (si está vacía) |
| `globalStats` | Query | Métricas globales |
| `reassignClient` | Mutation | Mover cliente a otra org |
| `createUserInOrg` | Mutation | Crear usuario en cualquier org |

### Fase 3: Modificar Routers Existentes

Agregar soporte para filtrado por `orgId` opcional cuando el usuario es Super Admin.

**Routers a modificar:**
- `clients.ts`
- `dashboard.ts`
- `mentions.ts`
- `tasks.ts`
- `team.ts`
- `intelligence.ts`
- `social.ts`

### Fase 4: UI - Página de Agencias

**Nuevo archivo:** `packages/web/src/app/dashboard/agencies/page.tsx`

Componentes:
- Lista de agencias con conteos
- Modal crear/editar
- Vista detalle
- Acciones de reasignación

### Fase 5: UI - Selector de Organización

**Modificar:** `packages/web/src/components/sidebar.tsx`
- Agregar menú "Agencias" (solo Super Admin)
- Agregar selector de organización (solo Super Admin)

**Nuevo archivo:** `packages/web/src/contexts/OrgSelectorContext.tsx`

### Fase 6: Sistema de Onboarding

**Librería:** React Joyride

**Nuevos archivos:**
```
packages/web/src/components/onboarding/
├── OnboardingProvider.tsx
├── WelcomeModal.tsx
├── OnboardingTour.tsx
├── TourTooltip.tsx
└── tour-steps.ts
```

**Pasos del tour (14 pasos):**
1. Sidebar - Navegación principal
2. KPIs - Métricas del dashboard
3. Gráfico de menciones
4. Análisis de sentimiento
5. Menciones recientes
6. Notificaciones
7-14. Explicación de cada sección del menú

## Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `packages/web/src/server/routers/organizations.ts` | CRUD de agencias |
| `packages/web/src/app/dashboard/agencies/page.tsx` | Página de gestión |
| `packages/web/src/contexts/OrgSelectorContext.tsx` | Estado global |
| `packages/web/src/components/onboarding/*` | Sistema de tutorial |

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `prisma/schema.prisma` | Nuevos campos y enum |
| `packages/web/src/lib/auth.ts` | Propagar isSuperAdmin |
| `packages/web/src/server/trpc.ts` | superAdminProcedure |
| `packages/web/src/server/routers/*.ts` | Soporte filtro por org |
| `packages/web/src/components/sidebar.tsx` | Menú agencias, selector, tutorial |

## Riesgos Identificados

| Riesgo | Mitigación |
|--------|-----------|
| Filtrado incorrecto expone datos de otras orgs | Tests E2E que verifiquen aislamiento |
| Super Admin se quita su propio flag | Validación que lo impida |
| Migración rompe usuarios existentes | Backup antes, migración incremental |

## Decisiones Tomadas

| Decisión | Alternativas | Justificación |
|----------|--------------|---------------|
| `isSuperAdmin` como campo booleano | Agregar SUPER_ADMIN al enum Role | El super admin es transversal, no un rol dentro de org |
| Super Admin sin orgId | Org especial "Sistema" | Más flexible, semánticamente correcto |
| React Joyride para tour | Intro.js, Shepherd.js | Nativo React, TypeScript, bien mantenido |
| Estado onboarding en DB | Solo localStorage | Persiste entre dispositivos, permite analytics |

## Verificación

### Tests de Super Admin:
- [ ] Login y ve menú "Agencias"
- [ ] Crear nueva agencia
- [ ] Crear usuario en agencia
- [ ] Ver clientes de todas las agencias
- [ ] Reasignar cliente

### Tests de Usuario Normal:
- [ ] Solo ve su organización
- [ ] No ve menú "Agencias"
- [ ] Permisos por rol funcionan

### Tests de Onboarding:
- [ ] Modal de bienvenida aparece
- [ ] Tour funciona correctamente
- [ ] Estado persiste
- [ ] Botón "Ver tutorial" funciona

---

*Generado por `/dev-plan --feature` - 2026-02-01*
