# Clients Router

Router para gestión de clientes, keywords, configuración de grounding y destinatarios de Telegram.

**Ubicación:** `packages/web/src/server/routers/clients.ts`

## Endpoints

### list

Lista todos los clientes de la organización.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:** Ninguno

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  active: boolean;
  orgId: string;
  _count: {
    keywords: number;  // Solo activos
    mentions: number;
    tasks: number;     // Solo PENDING/IN_PROGRESS
  };
}>
```

---

### getById

Obtiene un cliente con sus keywords y menciones recientes.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del cliente |

**Output:**
```typescript
{
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  keywords: Keyword[];       // Solo activos, ordenados por tipo
  mentions: Mention[];       // Últimos 50, con artículo
  _count: { mentions: number; tasks: number };
} | null
```

---

### create

Crea un nuevo cliente y encola onboarding con IA.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | `string` | Sí | Nombre del cliente (mín. 1 carácter) |
| `description` | `string` | No | Descripción |
| `industry` | `string` | No | Industria |

**Output:** `Client`

**Efectos secundarios:**
- Crea keyword automático con el nombre del cliente
- Encola job de onboarding para generar keywords adicionales

---

### update

Actualiza datos de un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del cliente |
| `name` | `string` | No | Nuevo nombre |
| `description` | `string` | No | Nueva descripción |
| `industry` | `string` | No | Nueva industria |
| `active` | `boolean` | No | Estado activo/inactivo |

**Output:** `Client`

---

### delete

Elimina un cliente y todos sus datos relacionados.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del cliente |

**Output:** `{ success: true }`

**Efectos secundarios:**
- Elimina en cascada: menciones, keywords, tareas

**Errores:**
- `NOT_FOUND`: Cliente no encontrado o no pertenece a la org

---

### addKeyword

Agrega un keyword a un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clientId` | `string` | Sí | ID del cliente |
| `word` | `string` | Sí | Palabra clave |
| `type` | `KeywordType` | Sí | Tipo: NAME, BRAND, COMPETITOR, TOPIC, ALIAS |

**Output:** `Keyword`

---

### removeKeyword

Desactiva un keyword (soft delete).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del keyword |

**Output:** `Keyword` (con `active: false`)

---

## Onboarding Mágico

### searchNews

Busca noticias en internet usando Gemini con grounding.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientName` | `string` | Sí | - | Nombre a buscar |
| `industry` | `string` | No | - | Contexto de industria |
| `days` | `number` | No | 30 | Días hacia atrás (7-60) |

**Output:**
```typescript
{
  articles: Array<{
    id: string;
    title: string;
    source: string;
    url: string;
    snippet?: string;
    publishedAt?: Date;
  }>;
  total: number;
  searchTerm: string;
  since: Date;
  searchedOnline: boolean;
  warning: string | null;  // Error de Google si hubo
}
```

---

### generateOnboardingConfig

Genera keywords y configuración con IA basado en noticias.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clientName` | `string` | Sí | Nombre del cliente |
| `description` | `string` | No | Descripción |
| `industry` | `string` | No | Industria |
| `articles` | `Article[]` | Sí | Artículos encontrados (máx. 15) |

**Output:**
```typescript
{
  suggestedKeywords: Array<{
    word: string;
    type: KeywordType;
    confidence: number;  // 0.5 - 1.0
    reason: string;
  }>;
  competitors: Array<{ name: string; reason: string }>;
  sensitiveTopics: string[];
  industryContext: string;
  monitoringStrategy: string[];
}
```

---

### createWithOnboarding

Crea cliente con configuración completa del wizard.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | `string` | Sí | Nombre del cliente |
| `description` | `string` | No | Descripción |
| `industry` | `string` | No | Industria |
| `keywords` | `Keyword[]` | Sí | Keywords a crear |
| `competitors` | `string[]` | No | Nombres de competidores |
| `selectedArticleIds` | `string[]` | No | IDs de artículos para crear menciones |

**Output:**
```typescript
{
  client: Client;
  keywordsCreated: number;
  mentionsCreated: number;
}
```

---

## Configuración de Grounding

### getGroundingConfig

Obtiene configuración de grounding de un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clientId` | `string` | Sí | ID del cliente |

**Output:**
```typescript
{
  id: string;
  name: string;
  industry: string | null;
  groundingEnabled: boolean;
  minDailyMentions: number;
  consecutiveDaysThreshold: number;
  groundingArticleCount: number;
  weeklyGroundingEnabled: boolean;
  weeklyGroundingDay: number;  // 0-6 (domingo-sábado)
  lastGroundingAt: Date | null;
  lastGroundingResult: object | null;
}
```

---

### updateGroundingConfig

Actualiza configuración de grounding.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Rango | Descripción |
|-------|------|-----------|-------|-------------|
| `clientId` | `string` | Sí | - | ID del cliente |
| `groundingEnabled` | `boolean` | No | - | Habilitar/deshabilitar |
| `minDailyMentions` | `number` | No | 1-20 | Umbral mínimo diario |
| `consecutiveDaysThreshold` | `number` | No | 1-10 | Días consecutivos |
| `groundingArticleCount` | `number` | No | 5-30 | Artículos a buscar |
| `weeklyGroundingEnabled` | `boolean` | No | - | Grounding semanal |
| `weeklyGroundingDay` | `number` | No | 0-6 | Día de la semana |

**Output:** Configuración actualizada

---

### executeManualGrounding

Ejecuta búsqueda de grounding manual.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Sí | - | ID del cliente |
| `days` | `number` | No | 30 | Días hacia atrás (7-60) |

**Output:**
```typescript
{
  success: true;
  message: string;
  queued: true;
}
```

---

## Destinatarios de Telegram

### getRecipients

Lista destinatarios de Telegram de un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clientId` | `string` | Sí | ID del cliente |

**Output:**
```typescript
{
  recipients: TelegramRecipient[];
  legacyGroupId: string | null;      // Compatibilidad
  legacyClientGroupId: string | null;
}
```

---

### addRecipient

Agrega un destinatario de Telegram.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clientId` | `string` | Sí | ID del cliente |
| `chatId` | `string` | Sí | ID del chat de Telegram |
| `type` | `RecipientType` | Sí | AGENCY_INTERNAL, CLIENT_GROUP, CLIENT_INDIVIDUAL |
| `label` | `string` | No | Etiqueta descriptiva |

**Output:** `TelegramRecipient`

**Errores:**
- `CONFLICT`: El destinatario ya existe

---

### updateRecipient

Actualiza un destinatario de Telegram.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del recipient |
| `label` | `string` | No | Nueva etiqueta |
| `active` | `boolean` | No | Estado activo |
| `type` | `RecipientType` | No | Nuevo tipo |

**Output:** `TelegramRecipient`

---

### removeRecipient

Elimina un destinatario (soft delete).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del recipient |

**Output:** `{ success: true }`

---

### compareCompetitors

Compara menciones del cliente vs competidores.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Sí | - | ID del cliente |
| `days` | `number` | No | 30 | Período (7-90 días) |

**Output:**
```typescript
{
  client: {
    name: string;
    mentions: number;
    sentiment: { positive: number; negative: number; neutral: number; mixed: number };
  };
  competitors: Array<{
    name: string;
    mentions: number;
    sentiment: { positive: number; negative: number; neutral: number; mixed: number };
  }>;
  period: { start: Date; end: Date };
}
```
