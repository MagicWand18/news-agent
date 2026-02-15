# Intelligence Router

Router para inteligencia competitiva: Share of Voice, análisis de temas y KPIs.

**Ubicación:** `packages/web/src/server/routers/intelligence.ts`

## Endpoints

### getSOV

Calcula el Share of Voice del cliente vs competidores.

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
| `includeCompetitors` | `boolean` | No | true | Incluir análisis de competidores |

**Output:**
```typescript
{
  clientSOV: {
    id: string;
    name: string;
    mentions: number;      // Menciones raw
    weighted: number;      // Menciones ponderadas por tier
    sov: number;           // % Share of Voice
    weightedSov: number;   // % SOV ponderado
  };
  competitorSOV: Array<{
    id: string;
    name: string;
    mentions: number;
    weighted: number;
    sov: number;
    weightedSov: number;
  }>;
  history: Array<{
    week: Date;
    sov: number;
    mentions: number;
  }>;
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  total: number;           // Total menciones
  totalWeighted: number;   // Total ponderado
}
```

**Ponderación por Tier:**
- Tier 1: x3 (medios nacionales principales)
- Tier 2: x2 (medios estatales relevantes)
- Tier 3: x1 (medios locales/municipales)

**Ejemplo:**
```typescript
// Cliente con 100 menciones (50 tier1, 30 tier2, 20 tier3)
// weighted = 50*3 + 30*2 + 20*1 = 150 + 60 + 20 = 230
```

---

### getTopics

Obtiene temas detectados en menciones con análisis de sentimiento.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente (todos si no se especifica) |
| `days` | `number` | No | 30 | Período (7-90 días) |

**Output:**
```typescript
{
  topics: Array<{
    name: string;
    count: number;
    sentiment: {
      positive: number;
      negative: number;
      neutral: number;
    };
  }>;
  emergingTopics: Array<{
    name: string;
    count: number;  // ≥3 menciones en últimas 24h
  }>;
}
```

**Notas:**
- Retorna máximo 20 temas ordenados por frecuencia
- "Temas emergentes" son aquellos con ≥3 menciones en las últimas 24 horas
- Los temas se extraen automáticamente durante el análisis de menciones

---

### getWeeklyInsights

Obtiene insights semanales generados por IA.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | No | - | Filtrar por cliente |
| `limit` | `number` | No | 4 | Número de semanas (1-10) |

**Output:**
```typescript
{
  insights: Array<{
    id: string;
    clientId: string;
    clientName: string;
    weekStart: Date;
    insights: string[];          // Lista de insights textuales
    sovData: {
      sov: number;
      trend: string;             // "up", "down", "stable"
    };
    topTopics: Array<{
      name: string;
      count: number;
    }>;
    createdAt: Date;
  }>;
}
```

**Notas:**
- Los insights se generan automáticamente cada semana por un worker
- Incluyen análisis de tendencias, temas destacados y recomendaciones

---

### getSourceTiers

Obtiene la configuración de tiers de fuentes.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:** Ninguno

**Output:**
```typescript
{
  sources: Array<{
    id: string;
    domain: string;    // "eluniversal.com.mx"
    name: string;      // "El Universal"
    tier: number;      // 1, 2, o 3
    reach: number;     // Alcance estimado
  }>;
  summary: {
    tier1: number;     // Cantidad de fuentes tier 1
    tier2: number;
    tier3: number;
  };
}
```

---

### getKPIs

Obtiene KPIs de inteligencia para el dashboard.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos |

**Input:** Ninguno

**Output:**
```typescript
{
  topicsCount: number;       // Temas únicos esta semana
  emergingTopics: number;    // Temas con ≥3 menciones en 24h
  avgSOV: number;            // SOV promedio de clientes activos
  weightedMentions: number;  // Total menciones ponderadas (7 días)
}
```

**Casos de uso:**
- Dashboard principal
- Resumen ejecutivo
- Alertas de actividad

### getActionItems

Obtiene action items (acciones recomendadas) de un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Sí | - | ID del cliente |
| `status` | `ActionStatus` | No | - | PENDING, IN_PROGRESS, COMPLETED, NOT_APPLICABLE |
| `limit` | `number` | No | 50 | Elementos (1-100) |

**Output:**
```typescript
Array<{
  id: string;
  clientId: string;
  source: string;           // "weekly_insight", "mention", "crisis", "manual"
  sourceId: string | null;  // ID del origen (WeeklyInsight, Mention, etc.)
  description: string;
  status: ActionStatus;
  completedAt: Date | null;
  createdAt: Date;
  assignee: { id: string; name: string } | null;
}>
```

**Notas:**
- Los action items se crean automáticamente desde weekly insights (campo `recommendedActions`)
- También se pueden crear manualmente desde la UI de Intelligence
- El `source` indica el origen: insights semanales, menciones analizadas, crisis, o manual

---

### updateActionItem

Actualiza el estado de un action item.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos (scoped por organización) |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | Sí | ID del action item |
| `status` | `ActionStatus` | Sí | Nuevo estado |

**Output:** `ActionItem` actualizado

**Efectos secundarios:**
- Si el nuevo estado es `COMPLETED`, se registra `completedAt` automáticamente

**Errores:**
- `NOT_FOUND`: Action item no encontrado o no pertenece a la organización

---

### generateReport

Genera un reporte ejecutivo bajo demanda para un cliente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Sí | - | ID del cliente |
| `period` | `string` | No | `"weekly"` | Período: weekly, monthly |

**Output:**
```typescript
{
  clientName: string;
  period: { start: Date; end: Date; days: number };
  totalMentions: number;
  weightedMentions: number;
  sentimentBreakdown: { positive: number; negative: number; neutral: number; mixed: number };
  crisisAlerts: number;
  topMentions: Array<{ title: string; source: string; sentiment: string }>;
  insights: string[];
  topTopics: Array<{ name: string; count: number }>;
  filename: string;
}
```

**Notas:**
- Retorna JSON estructurado (no PDF directo)
- Los reportes PDF semanales se generan automáticamente via cron (domingos 8pm)

---

## Funciones Auxiliares Internas

### getMentionsWithTier

Calcula menciones con peso por tier de fuente.

```typescript
async function getMentionsWithTier(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<{ count: number; weighted: number }>
```

### getSOVHistory

Obtiene histórico de SOV por semana.

```typescript
async function getSOVHistory(
  clientId: string,
  orgId: string,
  weeks: number
): Promise<Array<{ week: Date; sov: number; mentions: number }>>
```
