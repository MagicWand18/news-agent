# Executive Router

Router del Executive Dashboard. Todos los endpoints son exclusivos para Super Admin (`superAdminProcedure`). Provee KPIs globales, tarjetas por organización, health scores de clientes, alertas de inactividad y heatmap de actividad.

**Ubicación:** `packages/web/src/server/routers/executive.ts`

## Endpoints

### globalKPIs

KPIs globales con deltas porcentuales respecto al periodo anterior equivalente.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Super Admin exclusivo |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `days` | `number` | No | 7 | Periodo en días (1-90) |

**Nota:** El input completo es opcional (se puede llamar sin parámetros).

**Output:**
```typescript
{
  totalMentions: number;         // Menciones de medios en el periodo
  totalSocialMentions: number;   // Menciones sociales en el periodo
  activeCrises: number;          // Crisis activas actualmente
  activeClients: number;         // Clientes activos totales
  avgSentiment: number;          // % de sentimiento positivo
  mentionsDelta: number;         // Delta % vs periodo anterior
  socialDelta: number;           // Delta % vs periodo anterior
  crisesDelta: number;           // Delta % vs periodo anterior
}
```

**Cálculo de deltas:**
- Formula: `((current - previous) / previous) * 100`, redondeado
- Si el periodo anterior es 0 y actual > 0, el delta es 100%
- Si ambos son 0, el delta es 0%
- En caso de error, retorna todos los valores en 0

---

### orgCards

Tarjetas resumen por organización con métricas del periodo.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Super Admin exclusivo |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `days` | `number` | No | 7 | Periodo en días (1-90) |

**Nota:** El input completo es opcional.

**Output:**
```typescript
Array<{
  orgId: string;
  orgName: string;
  clientCount: number;                    // Clientes activos
  mentionCount: number;                   // Menciones en el periodo
  socialMentionCount: number;             // Menciones sociales en el periodo
  activeCrises: number;                   // Crisis activas
  avgSentiment: number;                   // % positivo
  topClient: {                            // Cliente con más menciones
    id: string;
    name: string;
    mentionCount: number;
  } | null;
}>
```

**Notas:**
- Organizaciones sin clientes activos retornan todos los conteos en 0
- `topClient` es el cliente con más menciones de medios en el periodo
- En caso de error, retorna array vacío

---

### clientHealthScores

Health scores por cliente (0-100) con 6 componentes ponderados y tendencia respecto a la semana anterior.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Super Admin exclusivo |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `orgId` | `string` | No | - | Filtrar por organización |
| `limit` | `number` | No | 20 | Máximo de resultados (1-100) |

**Nota:** El input completo es opcional.

**Output:**
```typescript
Array<{
  clientId: string;
  clientName: string;
  orgName: string;
  score: number;           // 0-100, ponderado
  components: {
    volume: number;        // 0-100 (peso: 20%)
    sentiment: number;     // 0-100 (peso: 25%)
    sov: number;           // 0-100 (peso: 15%)
    crisisFree: number;    // 0-100 (peso: 20%)
    responseRate: number;  // 0-100 (peso: 10%)
    engagement: number;    // 0-100 (peso: 10%)
  };
  trend: "up" | "down" | "stable";  // Comparado con semana anterior
}>
```

**Formula del Health Score:**

| Componente | Peso | Cálculo |
|-----------|------|---------|
| Volume | 20% | Menciones del cliente / promedio entre clientes. >= 1.5x = 100, <= 0.5x = 30, interpolado |
| Sentiment | 25% | Positivas / total menciones. >= 70% = 100, <= 30% = 20, interpolado |
| SOV | 15% | Menciones cliente / total menciones * 100. >= 40% = 100, <= 5% = 20, interpolado |
| CrisisFree | 20% | Sin crisis activas = 100. Con crisis activa = 0. Sin crisis, días desde última / 30 * 100 |
| ResponseRate | 10% | Borradores de respuesta / menciones negativas * 100, capped a 100. Sin negativas = 100 |
| Engagement | 10% | Social con engagement > 10 / total social * 100, capped a 100. Sin social = 50 |

**Tendencia:**
- `up`: score actual > score anterior + 5 puntos
- `down`: score actual < score anterior - 5 puntos
- `stable`: diferencia <= 5 puntos

**Notas:**
- Periodos: actual = últimos 7 días, anterior = 7-14 días atrás
- Resultados ordenados por score descendente
- En caso de error, retorna array vacío

---

### inactivityAlerts

Clientes activos sin actividad reciente (sin menciones de medios ni sociales en el periodo umbral).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Super Admin exclusivo |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `thresholdDays` | `number` | No | 3 | Días de inactividad para alertar (1-90) |

**Nota:** El input completo es opcional.

**Output:**
```typescript
Array<{
  clientId: string;
  clientName: string;
  orgName: string;
  lastMentionAt: Date | null;         // Última mención de medios
  lastSocialMentionAt: Date | null;   // Última mención social
  daysSinceActivity: number;          // Días desde última actividad (999 si nunca)
}>
```

**Notas:**
- Solo incluye clientes donde AMBAS fuentes (medios y social) están sin actividad
- Ordenados por `daysSinceActivity` descendente (los más inactivos primero)
- Clientes sin actividad nunca registrada tienen `daysSinceActivity: 999`
- En caso de error, retorna array vacío

---

### activityHeatmap

Heatmap de actividad: menciones (medios + sociales) agrupadas por día de la semana y hora. Usa SQL raw para eficiencia.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | Requerido |
| Permisos | Super Admin exclusivo |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `days` | `number` | No | 30 | Periodo en días (1-90) |
| `orgId` | `string` | No | - | Filtrar por organización |

**Nota:** El input completo es opcional.

**Output:**
```typescript
Array<{
  dayOfWeek: number;   // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  hour: number;        // 0-23
  count: number;       // Total de menciones en esa celda
}>
```

**Notas:**
- Combina menciones de medios (`Mention.publishedAt`) y sociales (`SocialMention.postedAt`) via `UNION ALL`
- Usa `COALESCE` para fallback a `createdAt` si la fecha de publicación es null
- Grid completo: 7 x 24 = 168 celdas posibles (solo retorna celdas con count > 0)
- En caso de error, retorna array vacío

---

## Ejemplo

```typescript
// 1. Obtener KPIs globales (últimos 14 días)
const kpis = await trpc.executive.globalKPIs.query({ days: 14 });
console.log(`Menciones: ${kpis.totalMentions} (${kpis.mentionsDelta > 0 ? "+" : ""}${kpis.mentionsDelta}%)`);

// 2. Tarjetas de organizaciones
const cards = await trpc.executive.orgCards.query({ days: 7 });
for (const card of cards) {
  console.log(`${card.orgName}: ${card.mentionCount} menciones, ${card.activeCrises} crisis`);
}

// 3. Health scores de todos los clientes
const scores = await trpc.executive.clientHealthScores.query({ limit: 50 });
for (const s of scores) {
  console.log(`${s.clientName}: ${s.score}/100 (${s.trend})`);
}

// 4. Alertas de inactividad (5 días sin actividad)
const alerts = await trpc.executive.inactivityAlerts.query({ thresholdDays: 5 });
for (const a of alerts) {
  console.log(`${a.clientName} (${a.orgName}): ${a.daysSinceActivity} días inactivo`);
}

// 5. Heatmap de actividad (último mes, por organización)
const heatmap = await trpc.executive.activityHeatmap.query({
  days: 30,
  orgId: "org-123",
});
// heatmap es un array de { dayOfWeek, hour, count }
```
