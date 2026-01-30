# Notifications Router

Router para gestión de notificaciones in-app.

**Ubicación:** `packages/web/src/server/routers/notifications.ts`

## Endpoints

### list

Lista notificaciones del usuario con filtros y paginación cursor.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Propias |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `type` | `NotificationType` | No | - | Filtrar por tipo |
| `read` | `boolean` | No | - | Filtrar por estado de lectura |
| `cursor` | `string` | No | - | ID para paginación |
| `limit` | `number` | No | 20 | Elementos por página (1-50) |

**Tipos de notificación:**
- `MENTION_CRITICAL` - Mención de urgencia crítica
- `MENTION_HIGH` - Mención de alta urgencia
- `CRISIS_ALERT` - Alerta de crisis detectada
- `WEEKLY_REPORT` - Reporte semanal generado
- `EMERGING_TOPIC` - Tema emergente detectado
- `SYSTEM` - Notificación del sistema

**Output:**
```typescript
{
  notifications: Array<{
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data: object | null;    // Datos adicionales (clientId, mentionId, etc.)
    read: boolean;
    readAt: Date | null;
    createdAt: Date;
  }>;
  nextCursor?: string;
}
```

---

### getUnreadCount

Obtiene el conteo de notificaciones no leídas.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Propias |

**Input:** Ninguno

**Output:**
```typescript
{
  count: number;
}
```

**Uso típico:** Badge en el ícono de notificaciones

---

### markAsRead

Marca una notificación como leída.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Propias |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la notificación |

**Output:**
```typescript
{
  success: boolean;  // true si se actualizó
}
```

**Efectos secundarios:**
- Registra `readAt` con la fecha actual

---

### markAllAsRead

Marca todas las notificaciones no leídas como leídas.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Propias |

**Input:** Ninguno

**Output:**
```typescript
{
  count: number;  // Cantidad de notificaciones actualizadas
}
```

---

### getById

Obtiene una notificación por ID.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Propias |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la notificación |

**Output:** `Notification | null`

---

### delete

Elimina una notificación.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Propias |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la notificación |

**Output:**
```typescript
{
  success: boolean;  // true si se eliminó
}
```

---

### deleteAllRead

Elimina todas las notificaciones leídas.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Propias |

**Input:** Ninguno

**Output:**
```typescript
{
  count: number;  // Cantidad de notificaciones eliminadas
}
```

---

## Tipos de Notificación

| Tipo | Descripción | Datos típicos |
|------|-------------|---------------|
| `MENTION_CRITICAL` | Mención con urgencia crítica | `{ mentionId, clientId }` |
| `MENTION_HIGH` | Mención de alta urgencia | `{ mentionId, clientId }` |
| `CRISIS_ALERT` | Se detectó una crisis | `{ crisisAlertId, clientId, severity }` |
| `WEEKLY_REPORT` | Reporte semanal listo | `{ reportId, clientId }` |
| `EMERGING_TOPIC` | Tema emergente detectado | `{ topic, clientId, count }` |
| `SYSTEM` | Mensaje del sistema | Variable |

---

## Ejemplo de Uso

```typescript
// Hook para badge de notificaciones
const { data: unread } = trpc.notifications.getUnreadCount.useQuery(
  undefined,
  { refetchInterval: 30000 } // Cada 30 segundos
);

// Lista infinita de notificaciones
const { data, fetchNextPage } = trpc.notifications.list.useInfiniteQuery(
  { limit: 20 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);

// Marcar como leída al hacer click
const markAsRead = trpc.notifications.markAsRead.useMutation();
const handleClick = (id: string) => {
  markAsRead.mutate({ id });
};

// Limpiar todas las leídas
const deleteRead = trpc.notifications.deleteAllRead.useMutation();
const handleClearRead = () => {
  deleteRead.mutate();
};
```
