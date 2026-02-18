# Topics API - MediaBot

Router para la gestión de hilos temáticos (TopicThreads). Agrupa menciones del mismo tema por cliente.

## Endpoints

| Endpoint | Tipo | Descripción |
|----------|------|-------------|
| `topics.list` | Query | Lista de topic threads con filtros y paginación cursor |
| `topics.getById` | Query | Detalle de un topic thread |
| `topics.getMentions` | Query | Menciones (Mention + SocialMention) de un thread |
| `topics.getEvents` | Query | Timeline de eventos del thread |
| `topics.getStats` | Query | Stats agregados: temas activos, negativos, nuevos |
| `topics.archive` | Mutation | Archivar un topic thread manualmente |
| `topics.getNegativeCount` | Query | Conteo de temas negativos activos (badge sidebar) |

---

## topics.list

Lista de topic threads con paginación cursor y filtros.

### Input

```typescript
z.object({
  clientId: z.string().optional(),
  status: z.enum(["ACTIVE", "CLOSED", "ARCHIVED"]).optional().default("ACTIVE"),
  sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
})
```

### Output

```typescript
{
  threads: TopicThread[];  // Con client: { name, id }
  nextCursor?: string;
}
```

### Ejemplo

```typescript
const { data } = trpc.topics.list.useInfiniteQuery(
  { status: "ACTIVE", limit: 20 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);
```

---

## topics.getById

Detalle de un topic thread con información del cliente.

### Input

```typescript
z.object({ id: z.string() })
```

### Output

```typescript
TopicThread & {
  client: { name: string; id: string; orgId: string };
} | null
```

Retorna `null` si el thread no existe o el usuario no tiene acceso (filtrado por orgId).

---

## topics.getMentions

Menciones de un topic thread. Combina Mention y SocialMention en una lista unificada ordenada por fecha.

### Input

```typescript
z.object({
  topicThreadId: z.string(),
  cursor: z.string().optional(),
  limit: z.number().default(20),
})
```

### Output

```typescript
{
  items: Array<{
    id: string;
    type: "mention" | "social";
    title: string;
    source: string;
    url: string | null;
    sentiment: string | null;
    relevance: string | null;
    date: Date;
    content: string | null;
  }>;
  nextCursor?: string;
}
```

---

## topics.getEvents

Timeline de eventos del thread (creación, menciones añadidas, umbrales alcanzados, cambios de sentimiento).

### Input

```typescript
z.object({
  topicThreadId: z.string(),
  limit: z.number().default(20),
})
```

### Output

```typescript
TopicThreadEvent[]
// Cada evento: { id, topicThreadId, type, data, createdAt }
// type: CREATED | MENTION_ADDED | THRESHOLD_REACHED | SENTIMENT_SHIFT | CLOSED | REOPENED
```

---

## topics.getStats

Stats agregados de temas activos, con filtros por cliente y periodo.

### Input

```typescript
z.object({
  clientId: z.string().optional(),
  days: z.number().default(7),
})
```

### Output

```typescript
{
  activeTopics: number;     // Total de temas ACTIVE
  negativeTopics: number;   // Temas ACTIVE con dominantSentiment NEGATIVE
  newTopics: number;        // Temas nuevos en el periodo
  bySentiment: Array<{      // Distribución por sentimiento
    sentiment: string;
    count: number;
  }>;
}
```

---

## topics.archive

Archiva un topic thread manualmente. Cambia status a ARCHIVED, establece closedAt y crea un evento CLOSED.

### Input

```typescript
z.object({ id: z.string() })
```

### Output

```typescript
TopicThread  // El thread actualizado
```

---

## topics.getNegativeCount

Conteo rápido de temas negativos activos. Usado por el sidebar para mostrar el badge de alerta.

### Input

Sin input.

### Output

```typescript
{ count: number }
```

---

## Modelo TopicThread

```typescript
interface TopicThread {
  id: string;
  clientId: string;
  name: string;              // Nombre del tema
  normalizedName: string;    // Lowercase para búsqueda/dedup
  status: "ACTIVE" | "CLOSED" | "ARCHIVED";

  // Métricas
  mentionCount: number;
  socialMentionCount: number;
  sentimentBreakdown: object | null;  // {positive:N, negative:N, neutral:N, mixed:N}
  dominantSentiment: string | null;
  topSources: string[] | null;
  aiSummary: string | null;

  // Temporal
  firstSeenAt: Date;
  lastMentionAt: Date;
  closedAt: Date | null;

  // Notificaciones
  lastNotifiedAt: Date | null;
  notifyCount: number;
  thresholdsReached: number[] | null;  // Umbrales ya notificados

  createdAt: Date;
  updatedAt: Date;
}
```

## Modelo TopicThreadEvent

```typescript
interface TopicThreadEvent {
  id: string;
  topicThreadId: string;
  type: "CREATED" | "MENTION_ADDED" | "THRESHOLD_REACHED" | "SENTIMENT_SHIFT" | "CLOSED" | "REOPENED";
  data: object | null;  // Metadata: mentionId, oldSentiment, newSentiment, etc.
  createdAt: Date;
}
```
