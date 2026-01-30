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
