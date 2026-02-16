# Organizations Router

Router para gestion de organizaciones (agencias). Todos los endpoints requieren Super Admin.

**Ubicacion:** `packages/web/src/server/routers/organizations.ts`

## Endpoints

### list

Lista todas las organizaciones con conteo de usuarios y clientes.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:** Ninguno

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  maxClients: number | null;
  createdAt: Date;
  _count: {
    users: number;
    clients: number;
  };
}>
```

**Notas:**
- Ordenado por nombre ascendente

---

### getById

Obtiene detalle de una organizacion con todos sus usuarios y clientes.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID de la organizacion |

**Output:**
```typescript
{
  id: string;
  name: string;
  maxClients: number | null;
  createdAt: Date;
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    role: Role;          // ADMIN, SUPERVISOR, ANALYST
    isSuperAdmin: boolean;
    createdAt: Date;
  }>;
  clients: Array<{
    id: string;
    name: string;
    active: boolean;
    createdAt: Date;
    _count: {
      mentions: number;
      keywords: number;
    };
  }>;
}
```

**Errores:**
- `NOT_FOUND`: Organizacion no encontrada

---

### create

Crea una nueva organizacion.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `name` | `string` | Si | Nombre de la organizacion (min 1 char) |

**Output:**
```typescript
Organization  // La organizacion creada
```

---

### update

Actualiza una organizacion existente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID de la organizacion |
| `name` | `string` | Si | Nuevo nombre (min 1 char) |
| `maxClients` | `number \| null` | No | Limite de clientes (0+ o null para ilimitado) |

**Output:**
```typescript
Organization  // La organizacion actualizada
```

**Errores:**
- `NOT_FOUND`: Organizacion no encontrada

---

### delete

Elimina una organizacion. Solo funciona si no tiene usuarios ni clientes.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID de la organizacion |

**Output:**
```typescript
Organization  // La organizacion eliminada
```

**Errores:**
- `NOT_FOUND`: Organizacion no encontrada
- `PRECONDITION_FAILED`: Tiene usuarios o clientes asociados

**Notas:**
- No se puede eliminar si tiene usuarios o clientes. Primero hay que reasignar o eliminar los recursos.

---

### globalStats

Estadisticas globales para el panel de Super Admin.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:** Ninguno

**Output:**
```typescript
{
  organizations: number;    // Total de organizaciones
  users: number;            // Total de usuarios
  activeClients: number;    // Clientes activos
  mentionsToday: number;    // Menciones creadas hoy
  mentionsWeek: number;     // Menciones ultimos 7 dias
  activeCrises: number;     // Alertas de crisis activas
}
```

---

### reassignClient

Reasigna un cliente de una organizacion a otra.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `clientId` | `string` | Si | ID del cliente a reasignar |
| `targetOrgId` | `string` | Si | ID de la organizacion destino |

**Output:**
```typescript
Client  // El cliente reasignado (o sin cambios si ya estaba en esa org)
```

**Errores:**
- `NOT_FOUND`: Cliente o organizacion destino no encontrada

**Notas:**
- Si el cliente ya pertenece a la organizacion destino, no hace nada y retorna el cliente actual

---

### createUserInOrg

Crea un nuevo usuario en cualquier organizacion.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `orgId` | `string` | Si | - | ID de la organizacion |
| `name` | `string` | Si | - | Nombre del usuario |
| `email` | `string` | Si | - | Email (debe ser unico) |
| `password` | `string` | Si | - | Contrasena (min 8 chars, mayuscula+minuscula+numero) |
| `role` | `Role` | No | ANALYST | ADMIN, SUPERVISOR, ANALYST |
| `isSuperAdmin` | `boolean` | No | false | Otorgar permisos de Super Admin |

**Output:**
```typescript
{
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isSuperAdmin: boolean;
  createdAt: Date;
}
```

**Errores:**
- `NOT_FOUND`: Organizacion no encontrada
- `CONFLICT`: Ya existe un usuario con ese email

**Notas:**
- La contrasena se hashea con bcrypt (12 rounds)
- Validacion de contrasena: minimo 8 caracteres, al menos una mayuscula, una minuscula y un numero

---

### listForSelector

Version ligera de list, solo id y nombre. Para usar en selectores/dropdowns.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:** Ninguno

**Output:**
```typescript
Array<{
  id: string;
  name: string;
}>
```

**Notas:**
- Ordenado por nombre ascendente
- No incluye conteos ni fechas para mejor rendimiento

---

## Endpoints de Destinatarios Telegram (Org-Level)

Gestionan destinatarios Telegram a nivel de organización. Estos recipients reciben notificaciones de TODOS los clientes de la org.

### listOrgTelegramRecipients

Lista los destinatarios Telegram de una organización.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `orgId` | `string` | Si | ID de la organizacion |

**Output:**
```typescript
Array<{
  id: string;
  orgId: string;
  chatId: string;
  label: string | null;
  active: boolean;
  preferences: Record<string, boolean> | null;  // null = todo ON
  createdAt: Date;
}>
```

---

### addOrgTelegramRecipient

Agrega un destinatario Telegram a una organización.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `orgId` | `string` | Si | ID de la organizacion |
| `chatId` | `string` | Si | ID del chat/grupo de Telegram |
| `label` | `string` | No | Etiqueta descriptiva (ej: "Grupo Crisalida") |

**Output:**
```typescript
OrgTelegramRecipient  // El recipient creado
```

**Notas:**
- `preferences` se inicializa como `null` (todos los tipos de notificación activados)
- Si ya existe un recipient con el mismo `orgId + chatId`, se reactiva

---

### updateOrgRecipientPreferences

Actualiza las preferencias de notificación de un destinatario de organización.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID del recipient |
| `preferences` | `Record<string, boolean>` | Si | Mapa de tipo → habilitado |

**Ejemplo de preferences:**
```json
{
  "MENTION_ALERT": true,
  "CRISIS_ALERT": true,
  "DAILY_DIGEST": false,
  "WEEKLY_REPORT": false
}
```

**Output:**
```typescript
OrgTelegramRecipient  // El recipient actualizado
```

---

### removeOrgTelegramRecipient

Desactiva un destinatario Telegram de organización.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Super Admin |
| Permisos | Solo Super Admin |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID del recipient |

**Output:**
```typescript
OrgTelegramRecipient  // El recipient desactivado (active: false)
```
