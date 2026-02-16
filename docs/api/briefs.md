# Briefs Router

Router para consulta de AI Media Briefs generados automáticamente por el digest worker. Los briefs contienen un resumen diario de la actividad mediática de cada cliente generado por IA.

**Ubicación:** `packages/web/src/server/routers/briefs.ts`

## Endpoints

### list

Lista briefs con paginación por cursor, filtrados por cliente y organización.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente |
| `orgId` | `string` | No | - | Organización (Super Admin) |
| `limit` | `number` | No | 10 | Elementos por página (1-50) |
| `cursor` | `string` | No | - | Cursor para paginación |

**Output:**
```typescript
{
  briefs: Array<{
    id: string;
    clientId: string;
    date: Date;
    content: BriefContent;   // JSON (ver estructura abajo)
    stats: BriefStats;       // JSON (ver estructura abajo)
    createdAt: Date;
    updatedAt: Date;
    client: { id: string; name: string };
  }>;
  nextCursor?: string;
}
```

---

### getById

Obtiene un brief por ID.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del brief |

**Output:**
```typescript
{
  id: string;
  clientId: string;
  date: Date;
  content: BriefContent;
  stats: BriefStats;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string };
}
```

**Errores:**
- Lanza `Error` si el brief no se encuentra o no pertenece a la organización

---

### getLatest

Obtiene el brief más reciente de un cliente. Retorna `null` si no hay briefs.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `clientId` | `string` | Sí | ID del cliente |

**Output:**
```typescript
{
  id: string;
  clientId: string;
  date: Date;
  content: BriefContent;
  stats: BriefStats;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string };
} | null
```

---

## Estructura JSON: BriefContent

Campo `content` del modelo `DailyBrief`. Generado por `generateDailyBrief()` en `packages/workers/src/analysis/ai.ts`.

```typescript
interface BriefContent {
  /** Puntos destacados del día */
  highlights: string[];

  /** Comparativa vs día anterior */
  comparison: {
    mentionsDelta: number;       // Cambio en cantidad de menciones (ej: +5, -3)
    sentimentShift: string;      // Descripción del cambio de sentimiento
    sovChange: string;           // Descripción del cambio de SOV
  };

  /** Lista de vigilancia: temas o fuentes a monitorear */
  watchList: string[];

  /** Temas emergentes detectados */
  emergingTopics: string[];

  /** Acciones pendientes recomendadas */
  pendingActions: string[];
}
```

## Estructura JSON: BriefStats

Campo `stats` del modelo `DailyBrief`. Contiene métricas numéricas del día.

```typescript
interface BriefStats {
  /** Total de menciones del día */
  mentions: number;

  /** Desglose de sentimiento */
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };

  /** Share of Voice (%) */
  sov: number;

  /** Total de posts sociales */
  socialPosts: number;

  /** Engagement total (likes + comments + shares) */
  engagement: number;
}
```

## Modelo de Datos

### DailyBrief

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único |
| `clientId` | `string` | Cliente asociado |
| `date` | `Date` | Fecha del brief (unique con clientId) |
| `content` | `Json` | Contenido generado por IA (BriefContent) |
| `stats` | `Json` | Métricas numéricas del día (BriefStats) |
| `createdAt` | `Date` | Fecha de creación |
| `updatedAt` | `Date` | Última actualización |

**Notas:**
- El constraint unique `clientId + date` garantiza un solo brief por cliente por día
- Los briefs se generan automáticamente en el digest worker y se persisten con upsert
- El brief se ordena por `date DESC` en todas las queries

## Ejemplo

```typescript
// 1. Obtener el último brief de un cliente
const latest = await trpc.briefs.getLatest.query({
  clientId: "client-123",
});

if (latest) {
  console.log(latest.content.highlights);
  console.log(`SOV: ${latest.stats.sov}%`);
}

// 2. Listar briefs con paginación
const { briefs, nextCursor } = await trpc.briefs.list.query({
  clientId: "client-123",
  limit: 10,
});

// 3. Página siguiente
const page2 = await trpc.briefs.list.query({
  clientId: "client-123",
  limit: 10,
  cursor: nextCursor,
});

// 4. Ver brief específico
const brief = await trpc.briefs.getById.query({ id: "brief-456" });
console.log(brief.content.watchList);
console.log(brief.content.emergingTopics);
```
