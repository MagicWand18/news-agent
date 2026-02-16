# Campaigns Router

Router para gestión de campañas de comunicación. Permite crear, vincular menciones, calcular estadísticas de impacto y comparar contra periodos pre-campaña.

**Ubicación:** `packages/web/src/server/routers/campaigns.ts`

## Endpoints

### list

Lista campañas con filtros por cliente y estado.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente |
| `status` | `CampaignStatus` | No | - | Filtrar por estado |
| `orgId` | `string` | No | - | Organización (Super Admin) |

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  clientId: string;
  description: string | null;
  status: CampaignStatus;
  startDate: Date | null;
  endDate: Date | null;
  objectives: { goals: string[] } | null;
  tags: string[];
  crisisAlertId: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string };
  crisisAlert: { id: string; severity: string; status: string } | null;
  _count: { mentions: number; socialMentions: number; notes: number };
}>
```

---

### getById

Obtiene una campaña por ID con notas, conteos y relaciones.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la campaña |

**Output:**
```typescript
{
  // ...campos de Campaign
  client: { id: string; name: string };
  crisisAlert: {
    id: string;
    severity: string;
    status: string;
    triggerType: string;
    mentionCount: number;
    createdAt: Date;
  } | null;
  notes: Array<{
    id: string;
    content: string;
    createdAt: Date;
    author: { id: string; name: string };
  }>;
  _count: { mentions: number; socialMentions: number };
}
```

**Errores:**
- `NOT_FOUND`: Campaña no encontrada o no pertenece a la organización

---

### create

Crea una nueva campaña para un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | `string` | Sí | Nombre de la campaña (1-200 chars) |
| `clientId` | `string` | Sí | ID del cliente |
| `description` | `string` | No | Descripción de la campaña |
| `startDate` | `string` | No | Fecha de inicio (ISO string) |
| `endDate` | `string` | No | Fecha de fin (ISO string) |
| `objectives` | `{ goals: string[] }` | No | Objetivos de la campaña |
| `tags` | `string[]` | No | Etiquetas |
| `crisisAlertId` | `string` | No | Vincular a una crisis existente |

**Output:** `Campaign` creada con relación `client` incluida

**Errores:**
- `NOT_FOUND`: Cliente no encontrado o no pertenece a la organización

---

### update

Actualiza una campaña existente. Solo se modifican los campos proporcionados.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la campaña |
| `name` | `string` | No | Nuevo nombre (1-200 chars) |
| `description` | `string` | No | Nueva descripción |
| `status` | `CampaignStatus` | No | Nuevo estado |
| `startDate` | `string \| null` | No | Nueva fecha de inicio (null para limpiar) |
| `endDate` | `string \| null` | No | Nueva fecha de fin (null para limpiar) |
| `objectives` | `{ goals: string[] } \| null` | No | Nuevos objetivos (null para limpiar) |
| `tags` | `string[]` | No | Nuevas etiquetas |
| `crisisAlertId` | `string \| null` | No | Vincular/desvincular crisis |

**Output:** `Campaign` actualizada con relación `client` incluida

**Errores:**
- `NOT_FOUND`: Campaña no encontrada o no pertenece a la organización

---

### delete

Elimina una campaña y todas sus relaciones (menciones vinculadas, notas).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la campaña |

**Output:**
```typescript
{ success: true }
```

**Errores:**
- `NOT_FOUND`: Campaña no encontrada o no pertenece a la organización

---

### addNote

Agrega una nota a la timeline de la campaña.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `campaignId` | `string` | Sí | ID de la campaña |
| `content` | `string` | Sí | Contenido de la nota (min 1 char) |

**Output:**
```typescript
{
  id: string;
  campaignId: string;
  content: string;
  authorId: string;
  createdAt: Date;
  author: { id: string; name: string };
}
```

---

### addMentions

Vincula menciones de medios a la campaña manualmente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `campaignId` | `string` | Sí | ID de la campaña |
| `mentionIds` | `string[]` | Sí | IDs de menciones (1-200) |

**Output:**
```typescript
{ success: true; count: number }
```

**Notas:**
- Usa `skipDuplicates` para evitar errores si ya están vinculadas

---

### removeMention

Desvincula una mención de medios de la campaña.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `campaignId` | `string` | Sí | ID de la campaña |
| `mentionId` | `string` | Sí | ID de la mención |

**Output:**
```typescript
{ success: true }
```

---

### addSocialMentions

Vincula menciones sociales a la campaña manualmente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `campaignId` | `string` | Sí | ID de la campaña |
| `socialMentionIds` | `string[]` | Sí | IDs de menciones sociales (1-200) |

**Output:**
```typescript
{ success: true; count: number }
```

**Notas:**
- Usa `skipDuplicates` para evitar errores si ya están vinculadas

---

### removeSocialMention

Desvincula una mención social de la campaña.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `campaignId` | `string` | Sí | ID de la campaña |
| `socialMentionId` | `string` | Sí | ID de la mención social |

**Output:**
```typescript
{ success: true }
```

---

### autoLinkMentions

Auto-vincula menciones del cliente que caen dentro del rango de fechas de la campaña. Vincula tanto menciones de medios (`publishedAt`) como sociales (`postedAt`).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `campaignId` | `string` | Sí | ID de la campaña |

**Output:**
```typescript
{
  success: true;
  linkedMentions: number;         // Menciones de medios vinculadas
  linkedSocialMentions: number;   // Menciones sociales vinculadas
}
```

**Errores:**
- `BAD_REQUEST`: La campaña debe tener fecha de inicio (`startDate`) para auto-vincular

**Notas:**
- Usa `skipDuplicates` para no duplicar vinculos existentes
- Si `endDate` es null, solo filtra desde `startDate` en adelante

---

### getStats

Obtiene estadísticas y métricas de impacto de la campaña, incluyendo comparativa con el periodo equivalente previo a la campaña.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la campaña |

**Output:**
```typescript
{
  totalMentions: number;
  totalSocialMentions: number;
  sentimentCounts: {
    POSITIVE: number;
    NEGATIVE: number;
    NEUTRAL: number;
    MIXED: number;
  };
  socialSentiment: {
    POSITIVE: number;
    NEGATIVE: number;
    NEUTRAL: number;
    MIXED: number;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  topSources: Array<{ source: string; count: number }>;  // Top 5
  platformCounts: Record<string, number>;                  // Por plataforma social
  preCampaignStats: {                                      // null si no hay startDate
    mentions: number;
    socialMentions: number;
    negative: number;
    positive: number;
    negativeRatio: number;    // % de negativas pre-campaña
    positiveRatio: number;    // % de positivas pre-campaña
  } | null;
  sentimentTimeline: Array<{
    date: string;             // YYYY-MM-DD
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  }>;
  currentNegativeRatio: number;   // % de negativas actual
  currentPositiveRatio: number;   // % de positivas actual
}
```

**Notas:**
- La comparativa pre-campaña calcula métricas del mismo periodo de duración antes del inicio de la campaña
- Si la campaña no tiene `endDate`, se usa la fecha actual como fin

**Errores:**
- `NOT_FOUND`: Campaña no encontrada

---

### getMentions

Lista menciones de medios vinculadas a la campaña con paginación por cursor.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `campaignId` | `string` | Sí | - | ID de la campaña |
| `cursor` | `string` | No | - | Cursor para paginación |
| `limit` | `number` | No | 20 | Elementos por página (1-50) |

**Output:**
```typescript
{
  items: Array<{
    id: string;
    campaignId: string;
    mentionId: string;
    assignedAt: Date;
    mention: {
      id: string;
      sentiment: string;
      relevance: number;
      publishedAt: Date;
      createdAt: Date;
      article: { title: string; source: string; url: string };
    };
  }>;
  nextCursor?: string;
}
```

---

### getSocialMentions

Lista menciones sociales vinculadas a la campaña con paginación por cursor.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `campaignId` | `string` | Sí | - | ID de la campaña |
| `cursor` | `string` | No | - | Cursor para paginación |
| `limit` | `number` | No | 20 | Elementos por página (1-50) |

**Output:**
```typescript
{
  items: Array<{
    id: string;
    campaignId: string;
    socialMentionId: string;
    assignedAt: Date;
    socialMention: {
      id: string;
      platform: string;
      postUrl: string;
      content: string;
      authorHandle: string;
      likes: number;
      comments: number;
      shares: number;
      sentiment: string;
      createdAt: Date;
    };
  }>;
  nextCursor?: string;
}
```

---

## CampaignStatus Enum

| Valor | Descripción |
|-------|-------------|
| `DRAFT` | Campaña en borrador, aún no iniciada |
| `ACTIVE` | Campaña en ejecución |
| `PAUSED` | Campaña pausada temporalmente |
| `COMPLETED` | Campaña finalizada |
| `CANCELLED` | Campaña cancelada |

## Modelo de Datos

### Campaign

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único |
| `name` | `string` | Nombre de la campaña |
| `clientId` | `string` | Cliente asociado |
| `description` | `string?` | Descripción |
| `status` | `CampaignStatus` | Estado actual |
| `startDate` | `Date?` | Fecha de inicio |
| `endDate` | `Date?` | Fecha de fin |
| `objectives` | `Json?` | Objetivos `{ goals: string[] }` |
| `tags` | `string[]` | Etiquetas |
| `crisisAlertId` | `string?` | Crisis vinculada (para campañas de defensa) |
| `createdAt` | `Date` | Fecha de creación |
| `updatedAt` | `Date` | Última actualización |

### CampaignNote

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único |
| `campaignId` | `string` | Campaña asociada |
| `content` | `string` | Contenido de la nota |
| `authorId` | `string` | Autor |
| `createdAt` | `Date` | Fecha |

### CampaignMention / CampaignSocialMention

Tablas pivot para vincular menciones a campañas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único |
| `campaignId` | `string` | Campaña |
| `mentionId` / `socialMentionId` | `string` | Mención vinculada |
| `assignedAt` | `Date` | Fecha de vinculación |

## Comparativa Pre-Campaña

Cuando `getStats` tiene una campaña con `startDate`, calcula automáticamente métricas del periodo equivalente previo:

```
[preStart] --- [preEnd/startDate] --- [endDate o now]
     |--- mismo duración ---|--- campaña en curso ---|
```

Los deltas se calculan comparando ratios de sentimiento entre ambos periodos.

## Ejemplo

```typescript
// 1. Crear campaña
const campaign = await trpc.campaigns.create.mutate({
  name: "Campaña de reputación Q1",
  clientId: "client-123",
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  objectives: { goals: ["Mejorar sentimiento", "Aumentar cobertura"] },
  tags: ["reputación", "Q1"],
});

// 2. Auto-vincular menciones del periodo
const linked = await trpc.campaigns.autoLinkMentions.mutate({
  campaignId: campaign.id,
});
console.log(`Vinculadas: ${linked.linkedMentions} media, ${linked.linkedSocialMentions} social`);

// 3. Obtener estadísticas con comparativa
const stats = await trpc.campaigns.getStats.query({ id: campaign.id });
if (stats.preCampaignStats) {
  const mentionsDelta = stats.totalMentions - stats.preCampaignStats.mentions;
  console.log(`Delta menciones: ${mentionsDelta > 0 ? "+" : ""}${mentionsDelta}`);
}

// 4. Agregar nota
await trpc.campaigns.addNote.mutate({
  campaignId: campaign.id,
  content: "Comunicado de prensa enviado a 50 medios",
});

// 5. Completar campaña
await trpc.campaigns.update.mutate({
  id: campaign.id,
  status: "COMPLETED",
});
```
