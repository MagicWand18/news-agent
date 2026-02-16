# Reports Router

Router para generación de reportes PDF exportables y links compartidos públicos. Los PDFs se generan server-side con PDFKit y se retornan como base64 data URLs. Los links compartidos permiten acceso sin autenticación con expiración configurable.

**Ubicación:** `packages/web/src/server/routers/reports.ts`

## Endpoints

### generateCampaignPDF

Genera un PDF con el reporte completo de una campaña, incluyendo métricas, sentimiento, fuentes top y comparativa pre-campaña.

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
  url: string;        // Data URL base64 del PDF (data:application/pdf;base64,...)
  filename: string;   // Nombre sugerido (ej: "campana-nombre-campana.pdf")
}
```

**Contenido del PDF:**
- Nombre de campaña, cliente, estado, fechas
- Total de menciones (medios + sociales)
- Ratios de sentimiento positivo/negativo (actual vs pre-campaña)
- Engagement social (likes, comments, shares, views)
- Top 10 fuentes de medios
- Notas de la campaña (últimas 20)

**Errores:**
- `NOT_FOUND`: Campaña no encontrada

---

### generateBriefPDF

Genera un PDF de un brief diario con highlights, métricas y recomendaciones.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `briefId` | `string` | Sí | ID del brief |

**Output:**
```typescript
{
  url: string;        // Data URL base64 del PDF
  filename: string;   // Nombre sugerido (ej: "brief-cliente-2026-02-15.pdf")
}
```

**Contenido del PDF:**
- Nombre del cliente y fecha
- Highlights del día
- Comparativa vs día anterior (mentionsDelta, sentimentShift, sovChange)
- Watch list y temas emergentes
- Acciones pendientes
- Métricas: menciones, sentimiento, SOV, social posts, engagement

**Errores:**
- `NOT_FOUND`: Brief no encontrado

---

### generateClientPDF

Genera un PDF resumen de un cliente con métricas de un periodo configurable.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `clientId` | `string` | Sí | - | ID del cliente |
| `days` | `number` | No | 30 | Periodo en días (1-365) |

**Output:**
```typescript
{
  url: string;        // Data URL base64 del PDF
  filename: string;   // Nombre sugerido (ej: "resumen-nombre-cliente.pdf")
}
```

**Contenido del PDF:**
- Nombre del cliente, industria, periodo
- Total menciones (medios + sociales)
- Desglose de sentimiento (positivo, negativo, neutral, mixto)
- Sentimiento promedio (% positivo)
- Top 10 fuentes de medios
- Menciones por semana (tendencia)
- Crisis recientes (severidad, estado, fecha)
- Campañas activas/borrador

**Errores:**
- `NOT_FOUND`: Cliente no encontrado

---

### createSharedLink

Crea un link público para compartir un reporte sin autenticación. Genera un snapshot de los datos al momento de la creación.

| Propiedad | Valor |
|-----------|-------|
| Tipo | Mutation |
| Auth | Requerido |
| Permisos | Todos |

**Input:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `type` | `ReportType` | Sí | - | Tipo de reporte: CAMPAIGN, BRIEF, CLIENT_SUMMARY |
| `referenceId` | `string` | Sí | - | ID del recurso (campaignId, briefId o clientId) |
| `expiresInDays` | `number` | No | 7 | Días hasta expiración (1-30) |

**Output:**
```typescript
{
  publicId: string;     // ID público del reporte (UUID)
  url: string;          // Ruta pública: /shared/{publicId}
  expiresAt: Date;      // Fecha de expiración
}
```

**Datos incluidos en el snapshot según tipo:**

| Tipo | Datos incluidos |
|------|----------------|
| `CAMPAIGN` | Campaña completa con cliente, notas (top 20), conteos de menciones |
| `BRIEF` | Brief completo con cliente |
| `CLIENT_SUMMARY` | Cliente + stats del último mes (mentionCount, socialCount, sentimiento) |

**Errores:**
- `NOT_FOUND`: Recurso referenciado no encontrado

---

### getSharedReport

Obtiene un reporte compartido por su ID público. **No requiere autenticación** (`publicProcedure`).

| Propiedad | Valor |
|-----------|-------|
| Tipo | Query |
| Auth | **No requerido** |
| Permisos | Público |

**Input:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `publicId` | `string` | Sí | ID público del reporte |

**Output:**
```typescript
// Reporte encontrado y válido
{
  error: null;
  report: {
    id: string;
    publicId: string;
    clientId: string;
    type: ReportType;
    title: string;
    data: unknown;          // JSON con datos del snapshot
    createdBy: string;
    expiresAt: Date;
    createdAt: Date;
    client: { name: string };
  };
}

// Reporte no encontrado
{ error: "not_found"; report: null }

// Reporte expirado
{ error: "expired"; report: null }
```

**Notas:**
- Nunca lanza errores, siempre retorna objetos con campo `error`
- Los datos en `data` varían según el `type` del reporte (ver tabla en createSharedLink)
- La página `/shared/[id]` consume este endpoint para renderizar reportes públicos

---

## ReportType Enum

| Valor | Descripción |
|-------|-------------|
| `CAMPAIGN` | Reporte de campaña |
| `BRIEF` | Brief diario |
| `CLIENT_SUMMARY` | Resumen de cliente |

## Modelo de Datos

### SharedReport

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID interno |
| `publicId` | `string` | ID público (UUID, unique) |
| `clientId` | `string` | Cliente asociado |
| `type` | `ReportType` | Tipo de reporte |
| `title` | `string` | Título descriptivo auto-generado |
| `data` | `Json` | Snapshot de datos al momento de creación |
| `createdBy` | `string` | Usuario que creó el link |
| `expiresAt` | `Date` | Fecha de expiración |
| `createdAt` | `Date` | Fecha de creación |

## Generadores PDF

Los PDFs se generan con PDFKit en `packages/web/src/lib/pdf/`:

| Archivo | Función | Descripción |
|---------|---------|-------------|
| `campaign-pdf.ts` | `generateCampaignPDF()` | PDF de campaña |
| `brief-pdf.ts` | `generateBriefPDF()` | PDF de brief |
| `client-pdf.ts` | `generateClientPDF()` | PDF resumen de cliente |
| `pdf-utils.ts` | Utilidades compartidas | Headers, footers, estilos comunes |

## Ejemplo

```typescript
// 1. Generar PDF de campaña
const { url, filename } = await trpc.reports.generateCampaignPDF.mutate({
  campaignId: "campaign-123",
});
// url = "data:application/pdf;base64,..." → descargar en el navegador

// 2. Generar PDF de brief
const briefPdf = await trpc.reports.generateBriefPDF.mutate({
  briefId: "brief-456",
});

// 3. Generar resumen de cliente (últimos 60 días)
const clientPdf = await trpc.reports.generateClientPDF.mutate({
  clientId: "client-789",
  days: 60,
});

// 4. Crear link compartido para una campaña (expira en 14 días)
const shared = await trpc.reports.createSharedLink.mutate({
  type: "CAMPAIGN",
  referenceId: "campaign-123",
  expiresInDays: 14,
});
console.log(`Link público: https://app.mediabot.com${shared.url}`);
// Link público: https://app.mediabot.com/shared/abc-def-123

// 5. Obtener reporte compartido (sin auth, desde página pública)
const result = await trpc.reports.getSharedReport.query({
  publicId: "abc-def-123",
});
if (result.error === null) {
  console.log(result.report.title);
  console.log(result.report.data);
} else if (result.error === "expired") {
  console.log("Este link ha expirado");
} else {
  console.log("Reporte no encontrado");
}
```
