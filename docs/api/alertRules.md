# AlertRules Router

Router para gestión de reglas de alerta automáticas. Permite crear, configurar y monitorear reglas que se evalúan cada 30 minutos por el `alert-rules-worker`.

**Ubicación:** `packages/web/src/server/routers/alertRules.ts`

## Endpoints

### list

Lista reglas de alerta con filtros por cliente y estado activo/inactivo.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente |
| `active` | `boolean` | No | - | Filtrar por estado activo/inactivo |
| `orgId` | `string` | No | - | Organización (Super Admin) |

**Output:**
```typescript
Array<{
  id: string;
  clientId: string;
  name: string;
  type: AlertRuleType;
  condition: Record<string, number>;
  channels: string[];
  active: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string };
}>
```

---

### getById

Obtiene una regla de alerta por ID.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la regla |

**Output:**
```typescript
{
  id: string;
  clientId: string;
  name: string;
  type: AlertRuleType;
  condition: Record<string, number>;
  channels: string[];
  active: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string };
}
```

**Errores:**
- `NOT_FOUND`: Regla no encontrada o no pertenece a la organización

---

### create

Crea una nueva regla de alerta para un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clientId` | `string` | Sí | ID del cliente |
| `name` | `string` | Sí | Nombre de la regla (1-200 chars) |
| `type` | `AlertRuleType` | Sí | Tipo de regla (ver enum abajo) |
| `condition` | `Record<string, number>` | Sí | Condiciones de disparo (varían por tipo) |
| `channels` | `string[]` | Sí | Canales de notificación (min 1) |

**Output:** `AlertRule` creada con relación `client` incluida

**Errores:**
- `NOT_FOUND`: Cliente no encontrado o no pertenece a la organización

---

### update

Actualiza una regla de alerta existente. Solo se modifican los campos proporcionados.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la regla |
| `name` | `string` | No | Nuevo nombre (1-200 chars) |
| `type` | `AlertRuleType` | No | Nuevo tipo |
| `condition` | `Record<string, number>` | No | Nuevas condiciones |
| `channels` | `string[]` | No | Nuevos canales |

**Output:** `AlertRule` actualizada con relación `client` incluida

**Errores:**
- `NOT_FOUND`: Regla no encontrada o no pertenece a la organización

---

### delete

Elimina una regla de alerta.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la regla |

**Output:**
```typescript
{ success: true }
```

**Errores:**
- `NOT_FOUND`: Regla no encontrada o no pertenece a la organización

---

### toggle

Activa o desactiva una regla de alerta. Invierte el valor actual de `active`.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la regla |

**Output:** `AlertRule` actualizada con relación `client` incluida (campo `active` invertido)

**Errores:**
- `NOT_FOUND`: Regla no encontrada o no pertenece a la organización

---

## Tipos de Regla (AlertRuleType)

| Tipo | Descripción | Condiciones típicas |
|------|-------------|---------------------|
| `NEGATIVE_SPIKE` | Pico de menciones negativas | `{ threshold: number }` — cantidad mínima de negativas |
| `SOV_DROP` | Caída del Share of Voice | `{ dropPercent: number }` — % mínimo de caída |
| `VOLUME_SURGE` | Aumento repentino de volumen | `{ threshold: number }` — multiplicador vs promedio |
| `COMPETITOR_SPIKE` | Pico de menciones de competidores | `{ threshold: number }` — vía ClientCompetitor |
| `SENTIMENT_SHIFT` | Cambio de sentimiento general | `{ negativeRatio: number }` — % ratio negativo |
| `NO_MENTIONS` | Sin menciones en periodo | `{ hours: number }` — horas sin menciones |

## Modelo de Datos

### AlertRule

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único |
| `clientId` | `string` | Cliente asociado |
| `name` | `string` | Nombre descriptivo |
| `type` | `AlertRuleType` | Tipo de regla |
| `condition` | `Json` | Condiciones de disparo (Record<string, number>) |
| `channels` | `string[]` | Canales de notificación |
| `active` | `boolean` | Si la regla está activa |
| `lastTriggeredAt` | `Date?` | Última vez que se disparó |
| `createdAt` | `Date` | Fecha de creación |
| `updatedAt` | `Date` | Última actualización |

## Evaluación

Las reglas se evalúan automáticamente por `alert-rules-worker.ts` con cron `*/30` (cada 30 minutos):

1. Se obtienen todas las reglas activas
2. Según el tipo, se evalúa la condición contra datos recientes
3. Si se cumple la condición, se dispara la notificación por los canales configurados
4. Se actualiza `lastTriggeredAt`

## Ejemplo

```typescript
// 1. Crear regla de pico negativo
const rule = await trpc.alertRules.create.mutate({
  clientId: "client-123",
  name: "Alerta de negatividad alta",
  type: "NEGATIVE_SPIKE",
  condition: { threshold: 5 },
  channels: ["TELEGRAM", "EMAIL"],
});

// 2. Listar reglas activas de un cliente
const rules = await trpc.alertRules.list.query({
  clientId: "client-123",
  active: true,
});

// 3. Desactivar temporalmente una regla
await trpc.alertRules.toggle.mutate({ id: rule.id });

// 4. Actualizar condiciones
await trpc.alertRules.update.mutate({
  id: rule.id,
  condition: { threshold: 10 },
});

// 5. Eliminar regla
await trpc.alertRules.delete.mutate({ id: rule.id });
```
