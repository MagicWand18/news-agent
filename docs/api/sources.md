# Sources Router

Router para gestión de fuentes RSS y solicitudes de nuevas fuentes.

**Ubicación:** `packages/web/src/server/routers/sources.ts`

## Endpoints

### list

Lista fuentes RSS con filtros y paginación numérica.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `type` | `SourceType` | No | - | NATIONAL, STATE, MUNICIPAL, INTERNATIONAL |
| `state` | `string` | No | - | Filtrar por estado |
| `tier` | `number` | No | - | Filtrar por tier (1-3) |
| `active` | `boolean` | No | - | Filtrar por estado activo |
| `search` | `string` | No | - | Buscar en nombre, URL, estado, ciudad |
| `page` | `number` | No | 1 | Página actual |
| `limit` | `number` | No | 50 | Elementos por página (1-100) |

**Output:**
```typescript
{
  sources: RssSource[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

### stats

Obtiene estadísticas de fuentes.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:** Ninguno

**Output:**
```typescript
{
  total: number;
  active: number;
  inactive: number;
  failing: number;           // errorCount >= 3
  recentlyUpdated: number;   // lastFetch en últimas 24h
  byType: Record<SourceType, number>;
  byTier: Record<number, number>;
  byState: Record<string, number>;
}
```

---

### get

Obtiene una fuente por ID.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la fuente |

**Output:** `RssSource`

**Errores:**
- `NOT_FOUND`: Fuente no encontrada

---

### create

Crea una nueva fuente RSS.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `name` | `string` | Sí | - | Nombre del medio |
| `url` | `string` | Sí | - | URL del feed RSS |
| `tier` | `number` | No | 3 | Importancia (1-3) |
| `type` | `SourceType` | No | NATIONAL | Tipo de fuente |
| `state` | `string` | No | - | Estado (para STATE/MUNICIPAL) |
| `city` | `string` | No | - | Ciudad (para MUNICIPAL) |

**Output:** `RssSource`

**Errores:**
- `FORBIDDEN`: Usuario no es admin
- `CONFLICT`: URL ya registrada

---

### update

Actualiza una fuente RSS.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la fuente |
| `name` | `string` | No | Nuevo nombre |
| `url` | `string` | No | Nueva URL |
| `tier` | `number` | No | Nuevo tier (1-3) |
| `type` | `SourceType` | No | Nuevo tipo |
| `state` | `string \| null` | No | Nuevo estado |
| `city` | `string \| null` | No | Nueva ciudad |
| `active` | `boolean` | No | Estado activo |

**Output:** `RssSource`

**Errores:**
- `FORBIDDEN`: Usuario no es admin
- `CONFLICT`: URL ya existe en otra fuente

---

### delete

Elimina una fuente RSS.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la fuente |

**Output:** `RssSource` (eliminada)

---

### toggleActive

Activa/desactiva una fuente y resetea errores.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la fuente |

**Output:** `RssSource` (con `active` invertido y `errorCount: 0`)

**Errores:**
- `NOT_FOUND`: Fuente no encontrada

---

### resetErrors

Resetea contador de errores y reactiva fuente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la fuente |

**Output:** `RssSource` (con `errorCount: 0` y `active: true`)

---

### states

Lista estados disponibles.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:** Ninguno

**Output:** `string[]` (estados únicos ordenados)

---

## Solicitudes de Fuentes

### requestSource

Solicita la inclusión de una nueva fuente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | `string` | Sí | Nombre del medio |
| `url` | `string` | Sí | URL del feed RSS |
| `state` | `string` | No | Estado |
| `city` | `string` | No | Ciudad |
| `notes` | `string` | No | Notas adicionales |

**Output:** `SourceRequest`

**Errores:**
- `CONFLICT`: URL ya registrada como fuente
- `CONFLICT`: Solicitud pendiente para esta URL

---

### listRequests

Lista solicitudes de fuentes.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Admin: todas, Usuario: propias |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `status` | `RequestStatus` | No | - | PENDING, APPROVED, REJECTED, INTEGRATED |
| `page` | `number` | No | 1 | Página actual |
| `limit` | `number` | No | 20 | Elementos por página (1-50) |

**Output:**
```typescript
{
  requests: SourceRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

### requestStats

Estadísticas de solicitudes por estado.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:** Ninguno

**Output:** `Record<RequestStatus, number>`

```typescript
{
  PENDING: 5,
  APPROVED: 12,
  REJECTED: 3,
  INTEGRATED: 10
}
```

---

### approveRequest

Aprueba una solicitud de fuente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la solicitud |

**Output:** `SourceRequest` (con status APPROVED)

---

### rejectRequest

Rechaza una solicitud de fuente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la solicitud |
| `notes` | `string` | No | Motivo del rechazo |

**Output:** `SourceRequest` (con status REJECTED)

---

### integrateRequest

Integra una solicitud aprobada creando la fuente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | **ADMIN** |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `id` | `string` | Sí | - | ID de la solicitud |
| `tier` | `number` | No | 3 | Tier de la fuente (1-3) |
| `type` | `SourceType` | No | MUNICIPAL | Tipo de fuente |

**Output:** `RssSource` (fuente creada)

**Errores:**
- `NOT_FOUND`: Solicitud no encontrada
- `BAD_REQUEST`: Solicitud no está aprobada

**Efectos secundarios:**
- Crea la fuente RSS
- Marca la solicitud como INTEGRATED
