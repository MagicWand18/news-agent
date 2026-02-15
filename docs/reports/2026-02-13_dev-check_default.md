# Dev Check Report

**Fecha:** 2026-02-13
**Modo:** default (code-review + security-scan + dependency-analyzer)
**Scope:** Proyecto completo (post Sprint 13 - Pipeline de Accion)
**Veredicto:** ❌ BLOCKED

---

## Resumen Ejecutivo

| Check | Estado | Issues |
|-------|--------|--------|
| Code Review | ❌ FAIL | 2 CRITICAL, 6 HIGH, 11 MEDIUM, 11 LOW |
| Security | ❌ FAIL | 11 endpoints sin org-scoping (IDOR) |
| Dependencies | ⚠️ WARN | 1 HIGH vuln (next DoS), 1 version conflict |

## Veredicto: ❌ BLOCKED

Razon principal: Endpoints nuevos (responses.ts, crisis.ts) carecen de org-scoping, permitiendo acceso cross-tenant (IDOR).

---

## Detalles por Categoria

### Code Review

#### CRITICAL (2)
1. **crisis.ts:getById** - Sin org-scoping. Cualquier usuario autenticado puede ver crisis de otra organizacion.
2. **responses.ts:getById** - Sin org-scoping. Cualquier usuario autenticado puede ver borradores de otra organizacion.

#### HIGH (6)
1. **responses.ts** - Todos los endpoints mutacion (create, update, updateStatus, regenerate) sin org-scoping
2. **crisis.ts** - Endpoints updateStatus, addNote, assignResponsible sin org-scoping
3. **intelligence.ts** - getActionItems y updateActionItem sin org-scoping
4. **intelligence.ts** - getTopics y getKPIs usan `ctx.user.orgId` directo (null causa error SQL)
5. **alert-rules-worker.ts** - Cooldown en memoria (Map) se pierde al reiniciar worker
6. **mentions/[id]/page.tsx** - Usa `isLoading` deprecado en vez de `isPending`

#### MEDIUM (11)
1. N+1 queries en getSOVHistory (consulta por dia individual)
2. Null orgId SQL bugs en getTopics/getKPIs (falta getEffectiveOrgId)
3. Unbounded string lengths en inputs de responses.create
4. Missing pagination en tasks.list
5. Polling setInterval sin cleanup en social-mentions/[id]
6. Self-approval posible en responses.updateStatus
7. KPIs misleading (compara 7d actual vs 7d previo sin normalizar)
8. Duplicate ActionItems posible en insights-worker (sin deduplicacion)
9. Orphan ResponseDrafts visibles cross-org
10. Sin rate limiting en endpoints de AI (generateReport, regenerate)
11. AlertRule condition como Json sin validacion de esquema

#### LOW (11)
- Console.log residuales, tipos innecesariamente amplios (Record<string, unknown>), falta de loading states en crisis detail, TODOs en codigo, formateo inconsistente de fechas, etc.

### Security

#### HIGH - IDOR Multi-Tenant (11 endpoints)
| Router | Endpoint | Riesgo |
|--------|----------|--------|
| responses.ts | list | Filtro por orgId faltante |
| responses.ts | getById | Acceso directo sin org check |
| responses.ts | create | Crear draft para cualquier mencion |
| responses.ts | update | Editar draft de otra org |
| responses.ts | updateStatus | Cambiar estado de draft ajeno |
| responses.ts | regenerate | Regenerar draft ajeno con AI |
| crisis.ts | getById | Ver crisis de otra org |
| crisis.ts | updateStatus | Cambiar estado de crisis ajena |
| crisis.ts | addNote | Agregar nota a crisis ajena |
| crisis.ts | assignResponsible | Asignar responsable en crisis ajena |
| intelligence.ts | updateActionItem | Modificar accion de otra org |

#### MEDIUM
- Self-approval en respuestas (mismo usuario crea y aprueba)
- Inputs sin limite de longitud (body, content, notes)
- tasks.list sin paginacion (posible DoS con muchas tareas)

### Dependencies

#### HIGH
- **next 15.5.9**: Vulnerabilidad DoS conocida. Fix disponible: >=15.5.10
- **@prisma/client**: Conflicto de version - root tiene v6, workspaces usan v5

#### MEDIUM
- Deps no usadas: crypto-js, node-fetch (fetch nativo disponible), @grammyjs/menu
- tRPC y React Query una major version detras

---

## Acciones Requeridas

### Bloqueantes (resolver antes de deploy)
1. Agregar org-scoping a TODOS los endpoints de responses.ts
2. Agregar org-scoping a TODOS los endpoints de crisis.ts
3. Agregar org-scoping a intelligence.ts (getActionItems, updateActionItem)
4. Corregir getTopics/getKPIs para usar getEffectiveOrgId en vez de ctx.user.orgId directo

### Recomendadas (resolver pronto)
1. Actualizar next a >=15.5.10
2. Resolver conflicto de version @prisma/client
3. Agregar deduplicacion de ActionItems en insights-worker
4. Agregar cleanup de setInterval en social-mentions/[id]
5. Cambiar isLoading → isPending en mentions/[id]
6. Persistir cooldown de alert-rules en Redis en vez de memoria

### Nice to Have
1. Agregar paginacion a tasks.list
2. Agregar rate limiting a endpoints AI
3. Remover deps no usadas (crypto-js, node-fetch, @grammyjs/menu)
4. Validar schema de AlertRule.condition con Zod
5. Agregar self-approval prevention en responses

---

## Archivos Afectados
- `packages/web/src/server/routers/responses.ts` - CRITICAL (org-scoping)
- `packages/web/src/server/routers/crisis.ts` - CRITICAL (org-scoping)
- `packages/web/src/server/routers/intelligence.ts` - HIGH (org-scoping + null orgId)
- `packages/web/src/app/dashboard/mentions/[id]/page.tsx` - HIGH (isLoading)
- `packages/web/src/app/dashboard/social-mentions/[id]/page.tsx` - MEDIUM (polling cleanup)
- `packages/workers/src/workers/alert-rules-worker.ts` - HIGH (in-memory cooldown)
- `packages/workers/src/analysis/insights-worker.ts` - MEDIUM (dedup)

---

---

## Fixes Aplicados

Los siguientes issues fueron corregidos en esta sesion:

### CRITICAL (2/2 resueltos)
- **responses.ts**: Agregado org-scoping a `getById`, `create`, `update`, `updateStatus`, `regenerate`
- **crisis.ts**: Agregado org-scoping a `getById`, `updateStatus`, `addNote`, `assignResponsible`

### HIGH (5/6 resueltos)
- **intelligence.ts**: Agregado org-scoping a `getActionItems` y `updateActionItem`
- **intelligence.ts**: `getTopics` y `getKPIs` ahora usan `getEffectiveOrgId()` con manejo de null
- **mentions/[id]/page.tsx**: Cambiado `isLoading` → `isPending` (4 ocurrencias)
- **responses.ts**: Agregado limites de longitud a inputs (title: 500, body: 10000, etc.)

### MEDIUM (2/11 resueltos)
- **social-mentions/[id]/page.tsx**: Agregado `useEffect` cleanup para polling interval
- **insights-worker.ts**: Agregada deduplicacion de ActionItems por sourceId + description

### Pendiente (alert-rules-worker cooldown)
- El cooldown en memoria del alert-rules-worker requiere Redis, pendiente para siguiente sprint

### Verificacion
- `npx tsc --noEmit` web: PASS
- `npx tsc --noEmit` workers: PASS

*Generado por `/dev-check` - 2026-02-13*
