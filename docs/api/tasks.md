# Tasks Router

Router para gestión de tareas de seguimiento.

**Ubicación:** `packages/web/src/server/routers/tasks.ts`

## Endpoints

### list

Lista tareas con filtros.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clientId` | `string` | No | Filtrar por cliente |
| `status` | `TaskStatus` | No | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| `priority` | `Priority` | No | URGENT, HIGH, MEDIUM, LOW |
| `assigneeId` | `string` | No | Filtrar por asignado |

**Output:**
```typescript
Array<{
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  clientId: string | null;
  assigneeId: string | null;
  mentionId: string | null;
  socialMentionId: string | null;
  deadline: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  client: { name: string } | null;
  assignee: { name: string } | null;
  mention: {
    article: { title: string };
  } | null;
  socialMention: {
    platform: string;
    authorHandle: string;
    postUrl: string | null;
  } | null;
}>
```

**Ordenamiento:**
1. Por prioridad (URGENT → HIGH → MEDIUM → LOW)
2. Por fecha de creación (más reciente primero)

---

### create

Crea una nueva tarea.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `title` | `string` | Sí | - | Título de la tarea |
| `description` | `string` | No | - | Descripción detallada |
| `priority` | `Priority` | No | MEDIUM | Prioridad |
| `clientId` | `string` | No | - | Cliente relacionado |
| `assigneeId` | `string` | No | - | Usuario asignado |
| `deadline` | `Date` | No | - | Fecha límite |
| `mentionId` | `string` | No | - | Mención de medios relacionada |
| `socialMentionId` | `string` | No | - | Mención social relacionada (Sprint 13) |

**Output:** `Task`

**Errores:**
- `NOT_FOUND`: Cliente no encontrado o no pertenece a la org
- `NOT_FOUND`: Asignado no encontrado o no pertenece a la org

**Notas:**
- Si se especifica `clientId`, se verifica que pertenezca a la organización
- Si se especifica `assigneeId`, se verifica que el usuario pertenezca a la organización
- Las tareas se crean con estado `PENDING` por defecto
- Se puede vincular a una mención de medios (`mentionId`) o una mención social (`socialMentionId`)
- En la UI, las tareas vinculadas a menciones sociales muestran un link directo al post original

---

### update

Actualiza una tarea existente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la tarea |
| `title` | `string` | No | Nuevo título |
| `description` | `string` | No | Nueva descripción |
| `status` | `TaskStatus` | No | Nuevo estado |
| `priority` | `Priority` | No | Nueva prioridad |
| `assigneeId` | `string \| null` | No | Nuevo asignado (null para desasignar) |
| `deadline` | `Date \| null` | No | Nueva fecha límite |

**Output:** `Task`

**Errores:**
- `NOT_FOUND`: Tarea no encontrada o no pertenece a la org

**Efectos secundarios:**
- Si `status` cambia a `COMPLETED`, se registra `completedAt` automáticamente

---

## Estados de Tarea

| Estado | Descripción |
|--------|-------------|
| `PENDING` | Tarea creada, pendiente de iniciar |
| `IN_PROGRESS` | Tarea en progreso |
| `COMPLETED` | Tarea completada |
| `CANCELLED` | Tarea cancelada |

## Prioridades

| Prioridad | Descripción | Ícono |
|-----------|-------------|-------|
| `URGENT` | Requiere atención inmediata | 🔴 |
| `HIGH` | Alta prioridad | 🟠 |
| `MEDIUM` | Prioridad normal | 🟡 |
| `LOW` | Baja prioridad | 🟢 |

## Ejemplo de Flujo

```typescript
// 1. Crear tarea desde una mención urgente
const task = await trpc.tasks.create.mutate({
  title: "Responder a nota negativa en El Universal",
  description: "Preparar comunicado de aclaración para...",
  priority: "URGENT",
  clientId: "client-123",
  assigneeId: "user-456",
  mentionId: "mention-789",
  deadline: new Date("2024-01-15"),
});

// 2. Marcar como en progreso
await trpc.tasks.update.mutate({
  id: task.id,
  status: "IN_PROGRESS",
});

// 3. Completar tarea
await trpc.tasks.update.mutate({
  id: task.id,
  status: "COMPLETED",
});
```
