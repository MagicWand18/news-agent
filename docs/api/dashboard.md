# Dashboard Router

Router para estadísticas y analíticas del dashboard principal.

**Ubicación:** `packages/web/src/server/routers/dashboard.ts`

## Endpoints

### stats

Obtiene estadísticas generales del dashboard.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:** Ninguno

**Output:**
```typescript
{
  clientCount: number;        // Clientes activos
  mentions24h: number;        // Menciones últimas 24h
  mentions7d: number;         // Menciones últimos 7 días
  tasksPending: number;       // Tareas PENDING o IN_PROGRESS
  mentionsByDay: Array<{
    date: string;             // "YYYY-MM-DD"
    count: number;
  }>;
  sentimentBreakdown: Array<{
    sentiment: Sentiment;
    count: number;
  }>;
}
```

**Notas:**
- `mentionsByDay` incluye los últimos 7 días
- `sentimentBreakdown` incluye menciones de los últimos 7 días
- Todos los datos son filtrados por la organización del usuario

---

### recentMentions

Obtiene las menciones más recientes.

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
  articleId: string;
  clientId: string;
  keywordMatched: string;
  sentiment: Sentiment;
  relevance: number;
  urgency: Urgency;
  createdAt: Date;
  article: {
    title: string;
    source: string;
    url: string;
  };
  client: {
    name: string;
  };
}>
```

**Notas:**
- Retorna las últimas 10 menciones
- Ordenadas por fecha de creación descendente
- Útil para el feed de actividad en el dashboard

---

### analytics

Obtiene analíticas detalladas con múltiples dimensiones.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente (todos si no se especifica) |
| `days` | `number` | No | 30 | Período de análisis (7-90 días) |

**Output:**
```typescript
{
  mentionsByDay: Array<{
    date: string;           // "YYYY-MM-DD"
    count: number;
  }>;
  sentimentTrend: Array<{
    week: string;           // "YYYY-MM-DD" (inicio de semana)
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  }>;
  topSources: Array<{
    source: string;         // Nombre del medio
    count: number;
  }>;
  topKeywords: Array<{
    keyword: string;
    count: number;
  }>;
  urgencyBreakdown: Array<{
    urgency: Urgency;
    count: number;
  }>;
}
```

**Detalles de cada métrica:**

#### mentionsByDay
- Menciones agrupadas por día
- Ordenadas cronológicamente
- Útil para gráficos de línea de tendencia

#### sentimentTrend
- Sentimiento agrupado por semana
- Permite ver evolución del sentimiento en el tiempo
- Útil para detectar cambios en percepción

#### topSources
- Top 10 fuentes con más menciones
- Ordenadas por cantidad descendente
- Identifica medios más activos

#### topKeywords
- Top 10 keywords más matcheados
- Muestra qué términos generan más cobertura
- Útil para optimizar estrategia de monitoreo

#### urgencyBreakdown
- Distribución de menciones por urgencia
- HIGH, MEDIUM, LOW
- Indica carga de trabajo del equipo

**Ejemplo de uso:**
```typescript
// Analíticas de todos los clientes, últimos 30 días
const { data } = trpc.dashboard.analytics.useQuery({});

// Analíticas de un cliente específico, últimos 7 días
const { data } = trpc.dashboard.analytics.useQuery({
  clientId: "client-123",
  days: 7,
});
```
