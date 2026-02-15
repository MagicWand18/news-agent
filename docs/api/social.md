# Social Router

Router para monitoreo de redes sociales: menciones, cuentas, hashtags y colección manual.

**Ubicacion:** `packages/web/src/server/routers/social.ts`

## Endpoints

### extractComments

Extrae comentarios de un post social. Encola un job de extraccion y retorna inmediatamente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `mentionId` | `string` | Si | ID de la mencion social |
| `maxComments` | `number` | No | Maximo de comentarios a extraer (5-100) |

**Output:**
```typescript
{
  success: boolean;
  message: string;
  queued: boolean;
}
```

**Errores:**
- `NOT_FOUND`: Mencion no encontrada o no pertenece a la org del usuario
- `BAD_REQUEST`: Plataforma no soportada (Twitter)
- `TOO_MANY_REQUESTS`: Comentarios ya extraidos hace menos de 1 hora
- `INTERNAL_SERVER_ERROR`: Error al encolar el job

**Notas:**
- No soporta Twitter
- Cooldown de 1 hora entre extracciones por mencion
- La extraccion se ejecuta en background via BullMQ (cola `extract-social-comments`)
- Super Admin puede extraer de cualquier mencion

---

### suggestHashtags

Sugiere hashtags y cuentas sociales usando IA (Gemini) basandose en el perfil del cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `clientName` | `string` | Si | Nombre del cliente (1-100 chars) |
| `description` | `string` | No | Descripcion del cliente (max 500 chars) |
| `industry` | `string` | No | Industria (max 100 chars) |
| `existingKeywords` | `string[]` | No | Keywords de monitoreo actuales |
| `competitors` | `string[]` | No | Competidores identificados |

**Output:**
```typescript
{
  hashtags: Array<{
    hashtag: string;       // Sin simbolo #
    platform: "TWITTER" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "ALL";
    confidence: number;    // 0-1
    reason?: string;       // Por que es relevante
  }>;
  suggestedAccounts: Array<{
    platform: "TWITTER" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
    handle: string;        // Sin simbolo @
    reason?: string;
  }>;
}
```

**Notas:**
- Usa Gemini para generar sugerencias
- Si la IA falla, retorna fallback con el nombre del cliente como hashtag
- Los hashtags se limpian (se quita #) y la confianza se normaliza a [0.5, 1.0]

---

### validateHandle

Valida que un handle existe en una plataforma social via EnsembleData API.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `platform` | `SocialPlatform` | Si | TWITTER, INSTAGRAM, TIKTOK, YOUTUBE |
| `handle` | `string` | Si | Handle a validar (sin @) |

**Output:**
```typescript
{
  valid: boolean;
  platformUserId?: string;  // ID interno de la plataforma
  error?: string;           // Mensaje si no es valido
  warning?: string;         // Si API no configurada
}
```

**Notas:**
- Si EnsembleData no esta configurado, retorna `valid: true` con warning
- El handle se valida contra la API real de cada plataforma

---

### listAllSocialMentions

Lista todas las menciones sociales con filtros y paginacion cursor. Para el dashboard global.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente |
| `platform` | `SocialPlatform` | No | - | TWITTER, INSTAGRAM, TIKTOK, YOUTUBE |
| `sentiment` | `Sentiment` | No | - | POSITIVE, NEGATIVE, NEUTRAL, MIXED |
| `sourceType` | `SocialSourceType` | No | - | HANDLE, HASHTAG, KEYWORD |
| `dateFrom` | `Date` | No | - | Fecha inicio |
| `dateTo` | `Date` | No | - | Fecha fin |
| `cursor` | `string` | No | - | ID para paginacion |
| `limit` | `number` | No | 30 | Elementos por pagina (1-50) |
| `orgId` | `string` | No | - | Super Admin: filtrar por org |

**Output:**
```typescript
{
  mentions: Array<SocialMention & {
    client: { id: string; name: string };
  }>;
  nextCursor?: string;
  hasMore: boolean;
}
```

**Uso con React Query (infinite scroll):**
```typescript
const { data, fetchNextPage, hasNextPage } = trpc.social.listAllSocialMentions.useInfiniteQuery(
  { platform: "INSTAGRAM", limit: 30 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);
```

---

### getGlobalSocialStats

Estadisticas globales de menciones sociales agrupadas por plataforma, sentimiento y tipo de fuente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente |
| `days` | `number` | No | 7 | Periodo en dias (1-90) |
| `orgId` | `string` | No | - | Super Admin: filtrar por org |

**Output:**
```typescript
{
  total: number;
  byPlatform: Record<SocialPlatform, number>;   // { INSTAGRAM: 45, TIKTOK: 23 }
  bySentiment: Record<Sentiment, number>;        // { POSITIVE: 30, NEGATIVE: 10, ... }
  bySourceType: Record<SocialSourceType, number>; // { HANDLE: 50, HASHTAG: 18 }
}
```

---

### getSocialMentionById

Obtiene una mencion social por ID con datos del cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID de la mencion social |

**Output:**
```typescript
SocialMention & {
  client: { id: string; name: string };
} | null
```

**Notas:**
- Super Admin puede ver cualquier mencion
- Usuarios normales solo ven menciones de clientes de su organizacion

---

### getSocialMentions

Lista menciones sociales de un cliente especifico con filtros y paginacion.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Si | - | ID del cliente |
| `platform` | `SocialPlatform` | No | - | Filtrar por plataforma |
| `sentiment` | `Sentiment` | No | - | Filtrar por sentimiento |
| `days` | `number` | No | 7 | Periodo en dias (1-90) |
| `cursor` | `string` | No | - | ID para paginacion |
| `limit` | `number` | No | 20 | Elementos por pagina (1-50) |

**Output:**
```typescript
{
  items: SocialMention[];
  nextCursor?: string;
  hasMore: boolean;
}
```

**Errores:**
- `NOT_FOUND`: Cliente no encontrado o no pertenece a la org

---

### getSocialTrend

Tendencia de menciones sociales agrupadas por dia. Util para graficas de area/linea.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente |
| `days` | `number` | No | 7 | Periodo en dias (1-90) |
| `orgId` | `string` | No | - | Super Admin: filtrar por org |

**Output:**
```typescript
{
  trend: Array<{
    date: string;   // "2026-02-10"
    count: number;
  }>;
}
```

**Notas:**
- Usa raw SQL para agrupar por fecha (DATE function)
- Filtra por organizacion via JOIN con Client

---

### getSocialStats

Estadisticas de menciones sociales para un cliente especifico, incluyendo top menciones por engagement.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Si | - | ID del cliente |
| `days` | `number` | No | 7 | Periodo en dias (1-90) |

**Output:**
```typescript
{
  total: number;
  byPlatform: Record<SocialPlatform, number>;
  bySentiment: Record<Sentiment, number>;
  topMentions: SocialMention[];  // Top 5 por likes/comments
}
```

**Errores:**
- `NOT_FOUND`: Cliente no encontrado o no pertenece a la org

---

### getSocialAccounts

Lista las cuentas sociales monitoreadas de un cliente, junto con configuracion de monitoreo.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `clientId` | `string` | Si | ID del cliente |

**Output:**
```typescript
{
  accounts: SocialAccount[];
  socialMonitoringEnabled: boolean;
  socialHashtags: string[];
}
```

**Errores:**
- `NOT_FOUND`: Cliente no encontrado o no pertenece a la org

---

### addSocialAccount

Agrega una cuenta social a monitorear para un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Si | - | ID del cliente |
| `platform` | `SocialPlatform` | Si | - | Plataforma social |
| `handle` | `string` | Si | - | Handle de la cuenta (sin @) |
| `label` | `string` | No | - | Etiqueta descriptiva |
| `isOwned` | `boolean` | No | false | Si la cuenta es del cliente |

**Output:**
```typescript
SocialAccount  // La cuenta creada o reactivada
```

**Errores:**
- `NOT_FOUND`: Cliente no encontrado
- `CONFLICT`: La cuenta ya esta siendo monitoreada (activa)
- `BAD_REQUEST`: Handle no encontrado en la plataforma (si API configurada)

**Notas:**
- Limpia el handle (quita @ si viene)
- Si la cuenta existia pero estaba inactiva, la reactiva
- Valida el handle via EnsembleData API si esta configurada
- Si la API no esta configurada, crea sin validar

---

### updateSocialAccount

Actualiza propiedades de una cuenta social monitoreada.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID de la cuenta social |
| `label` | `string` | No | Nueva etiqueta |
| `isOwned` | `boolean` | No | Si es cuenta del cliente |
| `active` | `boolean` | No | Activar/desactivar |

**Output:**
```typescript
SocialAccount  // La cuenta actualizada
```

**Errores:**
- `NOT_FOUND`: Cuenta no encontrada o no pertenece a la org

---

### removeSocialAccount

Desactiva una cuenta social (soft delete - marca como `active: false`).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID de la cuenta social |

**Output:**
```typescript
{ success: boolean }
```

**Errores:**
- `NOT_FOUND`: Cuenta no encontrada o no pertenece a la org

**Notas:**
- No elimina fisicamente, solo desactiva (`active: false`)
- La cuenta puede reactivarse con `addSocialAccount` usando el mismo handle/plataforma

---

### updateSocialConfig

Actualiza la configuracion de monitoreo social de un cliente (habilitado, hashtags).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `clientId` | `string` | Si | ID del cliente |
| `socialMonitoringEnabled` | `boolean` | No | Habilitar/deshabilitar monitoreo |
| `socialHashtags` | `string[]` | No | Lista de hashtags a monitorear |

**Output:**
```typescript
{
  id: string;
  socialMonitoringEnabled: boolean;
  socialHashtags: string[];
}
```

**Errores:**
- `NOT_FOUND`: Cliente no encontrado o no pertenece a la org

**Notas:**
- Los hashtags se limpian automaticamente (se quita # si viene)

---

### deleteSocialMention

Elimina una mencion social individual (hard delete).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `id` | `string` | Si | ID de la mencion social |

**Output:**
```typescript
{ success: boolean }
```

**Errores:**
- `NOT_FOUND`: Mencion no encontrada o no pertenece a la org

---

### deleteSocialMentions

Elimina multiples menciones sociales en lote (hard delete).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `ids` | `string[]` | Si | IDs de menciones a eliminar (1-100) |

**Output:**
```typescript
{
  success: boolean;
  deletedCount: number;  // Cantidad efectivamente eliminada
}
```

**Errores:**
- `NOT_FOUND`: Ninguna mencion encontrada (todas fuera de la org)

**Notas:**
- Solo elimina menciones que pertenezcan a la organizacion del usuario
- Si algunas IDs no existen o no pertenecen a la org, se ignoran silenciosamente
- Super Admin puede eliminar de cualquier org
- Maximo 100 menciones por operacion

---

### triggerCollection

Ejecuta recoleccion manual de redes sociales para un cliente. Encola un job y retorna inmediatamente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (filtrado por org) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Si | - | ID del cliente |
| `platforms` | `SocialPlatform[]` | No | Todas | Plataformas a recolectar |
| `collectHashtags` | `boolean` | No | true | Recolectar por hashtags |
| `collectHandles` | `boolean` | No | true | Recolectar por handles |
| `maxPostsPerSource` | `number` | No | - | Max posts por fuente (1-50) |
| `maxAgeDays` | `number` | No | - | Edad maxima de posts (1-90 dias) |

**Output:**
```typescript
{
  success: boolean;
  message: string;
  queued: boolean;
}
```

**Errores:**
- `NOT_FOUND`: Cliente no encontrado
- `BAD_REQUEST`: Monitoreo social no habilitado para el cliente
- `TOO_MANY_REQUESTS`: Cooldown de 30 minutos no cumplido
- `INTERNAL_SERVER_ERROR`: Error al encolar el job

**Notas:**
- Cooldown de 30 minutos entre recolecciones por cliente
- La recoleccion se ejecuta en background via BullMQ (cola `collect-social`)
- Actualiza `lastSocialCollectionAt` del cliente inmediatamente
- Si no se especifican plataformas, recolecta de todas las configuradas
