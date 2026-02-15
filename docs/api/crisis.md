# Crisis Router

Router para gestión de alertas de crisis mediáticas.

**Ubicación:** `packages/web/src/server/routers/crisis.ts`

## Endpoints

### list

Lista alertas de crisis con filtros y paginación por cursor.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `status` | `CrisisStatus` | No | - | ACTIVE, MONITORING, RESOLVED, DISMISSED |
| `severity` | `CrisisSeverity` | No | - | CRITICAL, HIGH, MEDIUM |
| `clientId` | `string` | No | - | Filtrar por cliente |
| `cursor` | `string` | No | - | Cursor para paginación |
| `limit` | `number` | No | 20 | Elementos por página (1-50) |
| `orgId` | `string` | No | - | Organización (Super Admin) |

**Output:**
```typescript
{
  crises: Array<{
    id: string;
    clientId: string;
    triggerType: CrisisTriggerType;  // NEGATIVE_SPIKE, HIGH_VOLUME, CRITICAL_SOURCE, MANUAL
    severity: CrisisSeverity;       // CRITICAL, HIGH, MEDIUM
    status: CrisisStatus;           // ACTIVE, MONITORING, RESOLVED, DISMISSED
    mentionCount: number;
    resolvedAt: Date | null;
    resolvedBy: string | null;
    assignedToId: string | null;
    createdAt: Date;
    client: { id: string; name: string };
    assignedTo: { id: string; name: string } | null;
    _count: { crisisNotes: number };
  }>;
  nextCursor?: string;
}
```

---

### getById

Obtiene una crisis por ID con notas, menciones relacionadas y todas las relaciones.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la crisis |

**Output:**
```typescript
{
  // ...campos de CrisisAlert
  client: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  crisisNotes: Array<{
    id: string;
    content: string;
    type: string;        // "NOTE", "ACTION", "STATUS_CHANGE"
    createdAt: Date;
    user: { id: string; name: string };
  }>;
  relatedMentions: Array<{
    id: string;
    sentiment: string;
    createdAt: Date;
    article: { title: string; source: string; url: string };
  }>;
}
```

**Notas:**
- Las menciones relacionadas son menciones NEGATIVE del mismo cliente en una ventana de ±24 horas
- Se retornan máximo 20 menciones relacionadas
- Las notas vienen ordenadas por fecha descendente

---

### updateStatus

Cambia el estado de una crisis. Crea automáticamente una CrisisNote con el cambio de estado.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | ADMIN, SUPERVISOR, Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la crisis |
| `status` | `CrisisStatus` | Sí | Nuevo estado |

**Output:** `CrisisAlert` actualizada

**Efectos secundarios:**
- Si el nuevo estado es `RESOLVED`, se registran `resolvedAt` y `resolvedBy` automáticamente
- Se crea una `CrisisNote` con tipo `STATUS_CHANGE` registrando la transición

**Errores:**
- `FORBIDDEN`: Usuario sin rol ADMIN o SUPERVISOR
- `NOT_FOUND`: Crisis no encontrada o no pertenece a la organización

---

### addNote

Agrega una nota a una crisis.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `crisisAlertId` | `string` | Sí | - | ID de la crisis |
| `content` | `string` | Sí | - | Contenido de la nota (min 1 char) |
| `type` | `string` | No | `"NOTE"` | Tipo: NOTE, ACTION, STATUS_CHANGE |

**Output:**
```typescript
{
  id: string;
  crisisAlertId: string;
  userId: string;
  content: string;
  type: string;
  createdAt: Date;
  user: { id: string; name: string };
}
```

---

### assignResponsible

Asigna un usuario responsable a una crisis.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | ADMIN, SUPERVISOR, Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la crisis |
| `assignedToId` | `string \| null` | Sí | ID del usuario (null para desasignar) |

**Output:** `CrisisAlert` con relación `assignedTo` incluida

**Errores:**
- `FORBIDDEN`: Usuario sin rol ADMIN o SUPERVISOR
- `NOT_FOUND`: Crisis o usuario asignado no encontrado

---

### getActiveCrisisCount

Cuenta las crisis activas (ACTIVE o MONITORING). Usado para el badge en sidebar.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `orgId` | `string` | No | Organización (Super Admin) |

**Output:**
```typescript
{ count: number }
```

---

## Modelo de Datos

### CrisisAlert

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único |
| `clientId` | `string` | Cliente afectado |
| `triggerType` | `CrisisTriggerType` | Tipo de trigger |
| `severity` | `CrisisSeverity` | Severidad |
| `status` | `CrisisStatus` | Estado actual |
| `mentionCount` | `number` | Menciones negativas que dispararon la crisis |
| `resolvedAt` | `Date?` | Fecha de resolución |
| `resolvedBy` | `string?` | Usuario que resolvió |
| `assignedToId` | `string?` | Usuario responsable |
| `createdAt` | `Date` | Fecha de creación |

### CrisisNote

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único |
| `crisisAlertId` | `string` | Crisis asociada |
| `userId` | `string` | Autor de la nota |
| `content` | `string` | Contenido |
| `type` | `string` | NOTE, ACTION, STATUS_CHANGE |
| `createdAt` | `Date` | Fecha |

## Severidad

| Condición | Severidad | Descripción |
|-----------|-----------|-------------|
| `count >= threshold * 3` | CRITICAL | Crisis severa, requiere acción inmediata |
| `count >= threshold * 2` | HIGH | Crisis importante |
| `count >= threshold` | MEDIUM | Crisis moderada |

## Flujo de Gestión

```
ACTIVE → MONITORING → RESOLVED
  ↓                      ↑
  └────── DISMISSED ─────┘
```

1. Crisis se crea como `ACTIVE` automáticamente
2. Equipo puede pasar a `MONITORING` mientras investiga
3. Se resuelve como `RESOLVED` o se descarta como `DISMISSED`
4. Cada cambio de estado genera una nota automática

## Ejemplo

```typescript
// 1. Listar crisis activas
const { crises } = await trpc.crisis.list.query({
  status: "ACTIVE",
  limit: 10,
});

// 2. Ver detalle con timeline
const crisis = await trpc.crisis.getById.query({ id: "crisis-123" });

// 3. Asignar responsable
await trpc.crisis.assignResponsible.mutate({
  id: "crisis-123",
  assignedToId: "user-456",
});

// 4. Agregar nota de acción
await trpc.crisis.addNote.mutate({
  crisisAlertId: "crisis-123",
  content: "Comunicado de prensa enviado a medios principales",
  type: "ACTION",
});

// 5. Resolver crisis
await trpc.crisis.updateStatus.mutate({
  id: "crisis-123",
  status: "RESOLVED",
});

// 6. Badge en sidebar
const { count } = await trpc.crisis.getActiveCrisisCount.query();
```
