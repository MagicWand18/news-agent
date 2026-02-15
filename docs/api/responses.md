# Responses Router

Router para gestión de borradores de comunicados de prensa (ResponseDraft).

**Ubicación:** `packages/web/src/server/routers/responses.ts`

## Endpoints

### list

Lista borradores de respuesta con filtros y paginación por cursor.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `status` | `ResponseStatus` | No | - | DRAFT, IN_REVIEW, APPROVED, PUBLISHED, DISCARDED |
| `clientId` | `string` | No | - | Filtrar por cliente (via mención asociada) |
| `mentionId` | `string` | No | - | Filtrar por mención de medios |
| `socialMentionId` | `string` | No | - | Filtrar por mención social |
| `cursor` | `string` | No | - | Cursor para paginación |
| `limit` | `number` | No | 20 | Elementos por página (1-50) |
| `orgId` | `string` | No | - | Organización (Super Admin) |

**Output:**
```typescript
{
  drafts: Array<{
    id: string;
    title: string;
    body: string;
    tone: string;
    audience: string;
    callToAction: string;
    keyMessages: string[];
    status: ResponseStatus;
    mentionId: string | null;
    socialMentionId: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    mention: {
      id: string;
      sentiment: string;
      article: { title: string; source: string };
      client: { id: string; name: string };
    } | null;
    socialMention: {
      id: string;
      platform: string;
      authorHandle: string;
      content: string;
      client: { id: string; name: string };
    } | null;
    createdBy: { id: string; name: string };
    approvedBy: { id: string; name: string } | null;
  }>;
  nextCursor?: string;
}
```

---

### getById

Obtiene un borrador por ID con todas las relaciones.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del borrador |

**Output:** `ResponseDraft` con relaciones completas (mención, artículo, cliente, autor, aprobador)

**Errores:**
- `NOT_FOUND`: Borrador no encontrado o no pertenece a la organización

---

### create

Crea un nuevo borrador de respuesta vinculado a una mención.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `title` | `string` | Sí | - | Título del comunicado (max 500) |
| `body` | `string` | Sí | - | Cuerpo del comunicado (max 10000) |
| `tone` | `string` | Sí | - | Tono del comunicado (max 100) |
| `audience` | `string` | Sí | - | Público objetivo (max 500) |
| `callToAction` | `string` | Sí | - | Siguiente paso recomendado (max 1000) |
| `keyMessages` | `string[]` | No | `[]` | Mensajes clave (max 10 items, max 500 chars c/u) |
| `mentionId` | `string` | No | - | Mención de medios vinculada |
| `socialMentionId` | `string` | No | - | Mención social vinculada |

**Output:** `ResponseDraft` creado con status `DRAFT`

**Notas:**
- Se puede vincular a una mención de medios, una mención social, o ninguna
- Se registra automáticamente el `createdById` del usuario actual
- Se valida que la mención pertenezca a la organización del usuario

---

### update

Edita el contenido de un borrador. Solo funciona si está en estado DRAFT.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del borrador |
| `title` | `string` | No | Nuevo título |
| `body` | `string` | No | Nuevo cuerpo |
| `tone` | `string` | No | Nuevo tono |
| `audience` | `string` | No | Nueva audiencia |
| `callToAction` | `string` | No | Nuevo call to action |
| `keyMessages` | `string[]` | No | Nuevos mensajes clave |

**Output:** `ResponseDraft` actualizado

**Errores:**
- `NOT_FOUND`: Borrador no encontrado
- `BAD_REQUEST`: "Solo se pueden editar borradores en estado DRAFT"

---

### updateStatus

Cambia el estado de un borrador siguiendo el workflow definido.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (APPROVED requiere ADMIN/SUPERVISOR) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del borrador |
| `status` | `ResponseStatus` | Sí | Nuevo estado |

**Transiciones válidas:**

```
DRAFT → IN_REVIEW, DISCARDED
IN_REVIEW → APPROVED, DRAFT, DISCARDED
APPROVED → PUBLISHED, DISCARDED
PUBLISHED → (ninguna, estado final)
DISCARDED → DRAFT
```

**Output:** `ResponseDraft` actualizado

**Efectos secundarios:**
- Si el nuevo estado es `APPROVED`, se registran `approvedById` y `approvedAt`

**Errores:**
- `BAD_REQUEST`: Transición de estado no permitida
- `FORBIDDEN`: Solo ADMIN/SUPERVISOR pueden aprobar
- `NOT_FOUND`: Borrador no encontrado

---

### regenerate

Genera un nuevo borrador con IA (Gemini) basado en una mención existente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `mentionId` | `string` | No* | - | Mención de medios como contexto |
| `socialMentionId` | `string` | No* | - | Mención social como contexto |
| `tone` | `string` | No | `"PROFESSIONAL"` | PROFESSIONAL, DEFENSIVE, CLARIFICATION, CELEBRATORY |

*Se requiere al menos uno de `mentionId` o `socialMentionId`.

**Output:** `ResponseDraft` creado con el contenido generado

**Notas:**
- Usa Gemini (Google AI) para generar el comunicado
- El contexto incluye: nombre del cliente, industria, artículo/post, sentimiento, resumen
- El borrador se crea automáticamente en estado `DRAFT`
- Genera: título, cuerpo (3-4 párrafos), audiencia, call to action, mensajes clave

**Tonos disponibles:**
| Tono | Descripción |
|------|-------------|
| `PROFESSIONAL` | Tono corporativo neutral |
| `DEFENSIVE` | Respuesta a críticas o acusaciones |
| `CLARIFICATION` | Aclarar malentendidos o información incorrecta |
| `CELEBRATORY` | Celebrar logros o noticias positivas |

---

## Modelo de Datos

### ResponseDraft

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único |
| `mentionId` | `string?` | Mención de medios vinculada |
| `socialMentionId` | `string?` | Mención social vinculada |
| `title` | `string` | Título del comunicado |
| `body` | `string` | Cuerpo del comunicado |
| `tone` | `string` | Tono usado |
| `audience` | `string` | Público objetivo |
| `callToAction` | `string` | Siguiente paso recomendado |
| `keyMessages` | `string[]` | Lista de mensajes clave |
| `status` | `ResponseStatus` | Estado actual del workflow |
| `createdById` | `string` | Usuario que creó el borrador |
| `approvedById` | `string?` | Usuario que aprobó |
| `approvedAt` | `Date?` | Fecha de aprobación |
| `createdAt` | `Date` | Fecha de creación |
| `updatedAt` | `Date` | Última actualización |

## Workflow Completo

```
                    ┌──────────────┐
                    │    DRAFT     │◄──────────────┐
                    └──────┬───────┘               │
                           │                       │
                    ┌──────▼───────┐               │
                    │  IN_REVIEW   │───────────────┘
                    └──────┬───────┘    (requiere cambios)
                           │
                    ┌──────▼───────┐
                    │   APPROVED   │  (solo ADMIN/SUPERVISOR)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  PUBLISHED   │  (estado final)
                    └──────────────┘

    Cualquier estado (excepto PUBLISHED) → DISCARDED
    DISCARDED → DRAFT (reactivar)
```

## Ejemplo

```typescript
// 1. Generar comunicado desde mención
const draft = await trpc.responses.regenerate.mutate({
  mentionId: "mention-123",
  tone: "PROFESSIONAL",
});

// 2. Editar borrador
await trpc.responses.update.mutate({
  id: draft.id,
  body: "Texto modificado...",
});

// 3. Enviar a revisión
await trpc.responses.updateStatus.mutate({
  id: draft.id,
  status: "IN_REVIEW",
});

// 4. Aprobar (ADMIN/SUPERVISOR)
await trpc.responses.updateStatus.mutate({
  id: draft.id,
  status: "APPROVED",
});

// 5. Publicar
await trpc.responses.updateStatus.mutate({
  id: draft.id,
  status: "PUBLISHED",
});

// 6. Listar todos los borradores aprobados
const { drafts } = await trpc.responses.list.query({
  status: "APPROVED",
});
```
