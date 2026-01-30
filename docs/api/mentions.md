# Mentions Router

Router para gestión de menciones y generación de comunicados con IA.

**Ubicación:** `packages/web/src/server/routers/mentions.ts`

## Endpoints

### list

Lista menciones con filtros y paginación cursor.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente |
| `sentiment` | `Sentiment` | No | - | POSITIVE, NEGATIVE, NEUTRAL, MIXED |
| `urgency` | `Urgency` | No | - | HIGH, MEDIUM, LOW |
| `source` | `string` | No | - | Filtrar por fuente (contiene) |
| `dateFrom` | `Date` | No | - | Fecha inicio |
| `dateTo` | `Date` | No | - | Fecha fin |
| `cursor` | `string` | No | - | ID para paginación |
| `limit` | `number` | No | 20 | Elementos por página (1-50) |

**Output:**
```typescript
{
  mentions: Array<{
    id: string;
    articleId: string;
    clientId: string;
    keywordMatched: string;
    sentiment: Sentiment;
    relevance: number;
    urgency: Urgency;
    aiSummary: string | null;
    snippet: string | null;
    createdAt: Date;
    article: {
      title: string;
      source: string;
      url: string;
      publishedAt: Date | null;
    };
    client: {
      name: string;
    };
  }>;
  nextCursor?: string;  // undefined si no hay más páginas
}
```

**Uso con React Query (infinite scroll):**
```typescript
const { data, fetchNextPage, hasNextPage } = trpc.mentions.list.useInfiniteQuery(
  { clientId: "xxx", limit: 20 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);
```

---

### getById

Obtiene una mención con todos sus detalles.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID de la mención |

**Output:**
```typescript
{
  id: string;
  articleId: string;
  clientId: string;
  keywordMatched: string;
  sentiment: Sentiment;
  relevance: number;
  urgency: Urgency;
  aiSummary: string | null;
  snippet: string | null;
  topic: string | null;
  parentMentionId: string | null;  // Clustering
  createdAt: Date;
  article: Article;  // Completo
  client: Client;    // Completo
  tasks: Task[];     // Tareas relacionadas
} | null
```

---

### generateResponse

Genera un comunicado de prensa con IA.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `mentionId` | `string` | Sí | ID de la mención |
| `tone` | `ResponseTone` | No | Tono del comunicado |

**Tonos disponibles:**
- `PROFESSIONAL` - Tono neutro y profesional (default si no se especifica)
- `DEFENSIVE` - Para responder a críticas
- `CLARIFICATION` - Para aclarar malentendidos
- `CELEBRATORY` - Para noticias positivas

**Output:**
```typescript
{
  title: string;        // Título del comunicado
  body: string;         // Cuerpo (3-4 párrafos)
  tone: ResponseTone;   // Tono utilizado
  audience: string;     // Público objetivo
  callToAction: string; // Siguiente paso para el equipo
  keyMessages: string[]; // 3 mensajes clave
}
```

**Ejemplo de respuesta:**
```json
{
  "title": "Posición oficial de Empresa X sobre cobertura mediática reciente",
  "body": "Empresa X desea aclarar la información publicada...\n\nNuestra posición es...\n\nReiteramos nuestro compromiso...",
  "tone": "CLARIFICATION",
  "audience": "Medios especializados en tecnología",
  "callToAction": "Enviar comunicado a lista de prensa tech y programar follow-up en 48h",
  "keyMessages": [
    "Empresa X mantiene los más altos estándares de calidad",
    "La situación mencionada ha sido resuelta",
    "Invitamos a los medios a conocer nuestras instalaciones"
  ]
}
```

**Errores:**
- `NOT_FOUND` (implícito): Mención no encontrada

**Notas:**
- Utiliza Claude (Anthropic) para generar el comunicado
- El prompt incluye contexto del cliente, artículo y análisis previo
- Si la IA no puede generar un JSON válido, retorna un fallback con mensaje de error
