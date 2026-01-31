# MediaBot Innovation Roadmap 2026

**Fecha:** 2026-01-29
**Estado:** 🟡 Propuesta - Pendiente Aprobación
**Análisis:** Basado en codebase actual + tendencias de mercado 2025-2026

---

## Resumen Ejecutivo

MediaBot tiene **50+ funcionalidades implementadas** y está bien posicionado en el mercado mexicano. Sin embargo, para competir con plataformas globales (Meltwater, Cision, Brandwatch), necesita incorporar **innovaciones estratégicas** en 4 áreas clave:

| Área | Prioridad | Impacto | Esfuerzo |
|------|-----------|---------|----------|
| 🤖 AI Search Visibility | CRÍTICA | Alto | Medio |
| 📊 Predictive Analytics | ALTA | Alto | Alto |
| 🎙️ Multimedia Monitoring | MEDIA | Medio | Medio |
| 🔗 Integraciones Avanzadas | MEDIA | Medio | Bajo |

---

## Análisis de Brechas (Gap Analysis)

### Lo que MediaBot tiene vs. Competidores

| Funcionalidad | MediaBot | Meltwater | Cision | Brandwatch |
|--------------|----------|-----------|--------|------------|
| RSS/News monitoring | ✅ | ✅ | ✅ | ✅ |
| Sentiment analysis | ✅ | ✅ | ✅ | ✅ |
| Crisis detection | ✅ | ✅ | ✅ | ✅ |
| Share of Voice | ✅ | ✅ | ✅ | ✅ |
| Telegram alerts | ✅ | ❌ | ❌ | ❌ |
| Spanish-first | ✅ | Parcial | Parcial | Parcial |
| **LLM Brand Tracking** | ❌ | ✅ | ❌ | ❌ |
| **Podcast monitoring** | ❌ | ✅ | ✅ | ❌ |
| **Visual recognition** | ❌ | ✅ | ❌ | ✅ |
| **Influencer analytics** | ❌ | ✅ | ✅ | ✅ |
| **Predictive insights** | ❌ | ✅ | ✅ | ✅ |
| **White-label reports** | ❌ | ✅ | ✅ | ✅ |

---

## FASE 1: Innovaciones Críticas (Q1 2026)

### 1.1 🤖 LLM Brand Visibility Tracking

**El problema:** El 70% de las búsquedas en AI terminan sin clic. Si tu marca no aparece en ChatGPT/Claude/Perplexity, eres invisible para millones de usuarios.

**La solución:** Rastrear menciones de clientes en respuestas de modelos de lenguaje.

```
Funcionalidades:
├── Track brand mentions in ChatGPT, Claude, Perplexity, Gemini
├── LLM Share of Voice (comparado con competidores)
├── Sentiment en contexto AI (cómo describen la marca)
├── Alertas cuando competidor aparece más que cliente
└── Recomendaciones GEO (Generative Engine Optimization)
```

**Implementación técnica:**

```typescript
// Nuevo modelo Prisma
model LLMVisibility {
  id            String   @id @default(cuid())
  clientId      String
  llmProvider   LLMProvider // CHATGPT | CLAUDE | PERPLEXITY | GEMINI
  prompt        String   // Query que generó la respuesta
  mentioned     Boolean  // Si la marca fue mencionada
  context       String?  // Extracto del contexto
  sentiment     Sentiment?
  competitorsMentioned String[] // Competidores que aparecieron
  createdAt     DateTime @default(now())

  client        Client   @relation(fields: [clientId], references: [id])
}

enum LLMProvider {
  CHATGPT
  CLAUDE
  PERPLEXITY
  GEMINI
  COPILOT
}
```

**Nuevo worker:** `llm-visibility-checker.ts`
- Ejecutar queries relevantes a cada LLM usando sus APIs
- Analizar respuestas buscando menciones de cliente/competidores
- Calcular LLM-SOV (Share of Voice en AI)
- Generar alertas cuando visibilidad baja

**Archivos a crear:**
- `packages/workers/src/llm-visibility/checker.ts`
- `packages/workers/src/llm-visibility/prompts.ts`
- `packages/web/src/app/dashboard/llm-visibility/page.tsx`
- `packages/web/src/server/routers/llm-visibility.ts`

**Dependencias nuevas:**
- `openai` (para ChatGPT API)
- Ya tenemos: `@anthropic-ai/sdk`, `@google/generative-ai`

**Costo estimado:** $50-100/mes en API calls
**Impacto:** DIFERENCIADOR ÚNICO en mercado mexicano

---

### 1.2 📈 Media Impact Value (MIV) Calculator

**El problema:** AVE está muerto. Los clientes necesitan métricas modernas que reflejen impacto real.

**La solución:** Implementar cálculo de MIV estandarizado.

```
Fórmula MIV:
MIV = Base_Value × Quality_Multiplier × Reach_Multiplier × Engagement_Factor

Donde:
- Base_Value: Tarifa publicitaria equivalente del medio
- Quality_Multiplier: Tier del source (1.0, 0.7, 0.4)
- Reach_Multiplier: Audiencia estimada del medio
- Engagement_Factor: Sentiment + Relevance + Prominence
```

**Implementación técnica:**

```typescript
// Extender modelo RssSource
model RssSource {
  // ... campos existentes
  estimatedReach    Int?      // Audiencia mensual estimada
  adRate            Decimal?  // Tarifa publicitaria (MXN/impresión)
}

// Nuevo campo en Mention
model Mention {
  // ... campos existentes
  mivValue          Decimal?  // Valor calculado en MXN
  mivBreakdown      Json?     // { base, quality, reach, engagement }
}

// Función de cálculo
function calculateMIV(mention: Mention, source: RssSource): number {
  const baseValue = source.adRate ?? getDefaultAdRate(source.tier);
  const qualityMultiplier = getTierMultiplier(source.tier);
  const reachMultiplier = source.estimatedReach ? source.estimatedReach / 1000000 : 1;
  const engagementFactor = (mention.relevance / 10) * getSentimentMultiplier(mention.sentiment);

  return baseValue * qualityMultiplier * reachMultiplier * engagementFactor;
}
```

**UI Components:**
- MIV total por cliente (KPI card)
- MIV trend chart (7/30/90 días)
- MIV breakdown por fuente/tier
- Comparativo MIV vs competidores

**Archivos a modificar:**
- `prisma/schema.prisma` (nuevos campos)
- `packages/workers/src/analysis/miv-calculator.ts` (nuevo)
- `packages/web/src/server/routers/intelligence.ts` (agregar getMIV)
- `packages/web/src/app/dashboard/intelligence/page.tsx` (UI)

---

### 1.3 🔮 Predictive Crisis Detection

**El problema:** La detección actual es reactiva (3+ menciones negativas). Los clientes necesitan anticipación.

**La solución:** Usar ML para predecir crisis antes de que escalen.

```
Señales predictivas:
├── Velocidad de menciones (aceleración anormal)
├── Propagación cross-source (mismo tema en múltiples medios)
├── Influencer involvement (periodistas de alto perfil)
├── Historical patterns (días/horas de mayor riesgo)
├── Competitor crisis spillover (crisis en industria)
└── Sentiment trajectory (tendencia negativa sostenida)
```

**Implementación técnica:**

```typescript
// Nuevo modelo para tracking de riesgo
model ReputationRisk {
  id            String   @id @default(cuid())
  clientId      String
  riskScore     Int      // 0-100
  riskLevel     RiskLevel // LOW | ELEVATED | HIGH | CRITICAL
  signals       Json     // { velocity, spread, influencers, sentiment }
  prediction    String?  // AI-generated risk explanation
  createdAt     DateTime @default(now())

  client        Client   @relation(fields: [clientId], references: [id])
}

enum RiskLevel {
  LOW        // 0-25: Normal activity
  ELEVATED   // 26-50: Watch closely
  HIGH       // 51-75: Prepare response
  CRITICAL   // 76-100: Crisis imminent
}
```

**Algoritmo de Risk Score:**

```typescript
async function calculateRiskScore(clientId: string): Promise<number> {
  const [
    velocityScore,    // 0-25 pts: Menciones/hora vs baseline
    spreadScore,      // 0-25 pts: Número de fuentes únicas
    sentimentScore,   // 0-25 pts: % negativo y tendencia
    influencerScore   // 0-25 pts: Menciones en Tier 1
  ] = await Promise.all([
    calculateVelocityScore(clientId),
    calculateSpreadScore(clientId),
    calculateSentimentTrend(clientId),
    calculateInfluencerMentions(clientId)
  ]);

  return velocityScore + spreadScore + sentimentScore + influencerScore;
}
```

**Nuevo cron job:** `0 */1 * * *` (cada hora)
- Calcular risk score para cada cliente activo
- Generar alertas cuando score > 50
- Enviar predicción AI con recomendaciones

---

## FASE 2: Expansión de Cobertura (Q2 2026)

### 2.1 🎙️ Podcast & Audio Monitoring

**El problema:** Los podcasts son el nuevo "earned media". Sin monitoreo, perdemos menciones valiosas.

**La solución:** Transcribir y analizar podcasts en español.

```
Pipeline:
1. Descubrir podcasts relevantes (RSS feeds de podcasts)
2. Descargar episodios nuevos
3. Transcribir con AI (Whisper API)
4. Buscar keywords de clientes
5. Analizar sentiment del contexto
6. Crear menciones con timestamp exacto
```

**Implementación técnica:**

```typescript
// Nuevo modelo
model Podcast {
  id            String   @id @default(cuid())
  name          String
  feedUrl       String   @unique
  category      String?
  language      String   @default("es")
  active        Boolean  @default(true)
  lastFetch     DateTime?

  episodes      Episode[]
}

model Episode {
  id            String   @id @default(cuid())
  podcastId     String
  title         String
  audioUrl      String
  publishedAt   DateTime
  duration      Int?     // segundos
  transcript    String?  @db.Text
  transcribedAt DateTime?

  podcast       Podcast  @relation(fields: [podcastId], references: [id])
  mentions      PodcastMention[]
}

model PodcastMention {
  id            String   @id @default(cuid())
  episodeId     String
  clientId      String
  timestamp     Int      // segundo donde aparece
  context       String   // 30 segundos de contexto
  sentiment     Sentiment
  relevance     Int

  episode       Episode  @relation(fields: [episodeId], references: [id])
  client        Client   @relation(fields: [clientId], references: [id])
}
```

**Dependencias nuevas:**
- `openai` (Whisper API para transcripción)
- `podcast-index-api` (descubrimiento de podcasts)

**Costo estimado:** $0.006/minuto de audio (Whisper)
- 100 episodios × 60 min = $36/mes

**Archivos a crear:**
- `packages/workers/src/collectors/podcast-collector.ts`
- `packages/workers/src/analysis/transcribe.ts`
- `packages/web/src/app/dashboard/podcasts/page.tsx`

---

### 2.2 📸 Visual Brand Recognition

**El problema:** Las marcas aparecen en imágenes/videos sin ser mencionadas en texto.

**La solución:** Detectar logos y marcas en contenido visual.

```
Casos de uso:
├── Logo del cliente en fotos de eventos
├── Productos en videos de influencers
├── Menciones visuales en infografías
├── Screenshots de redes sociales
└── Logos en transmisiones de TV
```

**Implementación técnica:**

```typescript
// Usar Google Cloud Vision API
import vision from '@google-cloud/vision';

async function detectLogos(imageUrl: string): Promise<LogoDetection[]> {
  const client = new vision.ImageAnnotatorClient();
  const [result] = await client.logoDetection(imageUrl);

  return result.logoAnnotations?.map(logo => ({
    description: logo.description,
    score: logo.score,
    boundingBox: logo.boundingPoly
  })) ?? [];
}

// Nuevo modelo
model VisualMention {
  id            String   @id @default(cuid())
  articleId     String
  clientId      String
  imageUrl      String
  logoDetected  String   // Nombre del logo detectado
  confidence    Float    // 0-1
  boundingBox   Json?    // Coordenadas del logo
  createdAt     DateTime @default(now())

  article       Article  @relation(fields: [articleId], references: [id])
  client        Client   @relation(fields: [clientId], references: [id])
}
```

**Dependencias nuevas:**
- `@google-cloud/vision`

**Costo estimado:** $1.50/1000 imágenes

---

### 2.3 👥 Influencer Impact Analysis

**El problema:** No sabemos qué periodistas/influencers tienen más impacto en la reputación del cliente.

**La solución:** Identificar y trackear influencers clave por cliente.

```
Funcionalidades:
├── Identificar autores frecuentes por cliente
├── Calcular "Influencer Score" basado en:
│   ├── Tier del medio
│   ├── Frecuencia de cobertura
│   ├── Sentiment promedio
│   └── Alcance estimado
├── Alertas cuando influencer key publica
├── Historial de cobertura por periodista
└── Recomendaciones de outreach
```

**Implementación técnica:**

```typescript
// Extraer autor de artículos (nuevo campo)
model Article {
  // ... campos existentes
  author        String?  // Extraído del HTML/RSS
  authorProfile String?  // URL del perfil si disponible
}

// Nuevo modelo para influencers
model Influencer {
  id              String   @id @default(cuid())
  name            String
  outlet          String?  // Medio principal
  email           String?
  twitter         String?
  linkedIn        String?

  // Métricas calculadas
  totalMentions   Int      @default(0)
  avgSentiment    Float?   // -1 a 1
  influenceScore  Int?     // 0-100

  articles        Article[]
  clientRelations InfluencerClient[]
}

model InfluencerClient {
  id            String   @id @default(cuid())
  influencerId  String
  clientId      String
  mentionCount  Int      @default(0)
  avgSentiment  Float?
  lastMention   DateTime?
  relationship  RelationshipType @default(NEUTRAL)

  influencer    Influencer @relation(fields: [influencerId], references: [id])
  client        Client     @relation(fields: [clientId], references: [id])

  @@unique([influencerId, clientId])
}

enum RelationshipType {
  ADVOCATE    // Consistentemente positivo
  NEUTRAL     // Mixto o poco contacto
  CRITIC      // Consistentemente negativo
  WATCH       // Requiere atención especial
}
```

---

## FASE 3: Experiencia de Usuario (Q3 2026)

### 3.1 📄 White-Label Reports

**El problema:** Las agencias necesitan reportes con su propia marca para clientes.

**La solución:** Sistema de reportes personalizables con branding de agencia.

```
Características:
├── Logo de agencia en reportes
├── Colores personalizables por organización
├── Plantillas editables (ejecutivo, detallado, crisis)
├── Programación automática (semanal, mensual)
├── Entrega por email con PDF adjunto
├── Dominio personalizado (reports.agencia.com)
└── Editor drag-and-drop de secciones
```

**Implementación técnica:**

```typescript
// Nuevos modelos
model ReportTemplate {
  id            String   @id @default(cuid())
  orgId         String
  name          String
  type          ReportType // EXECUTIVE | DETAILED | CRISIS | CUSTOM
  sections      Json     // Array de secciones configuradas
  styling       Json     // { primaryColor, logo, font }
  isDefault     Boolean  @default(false)

  org           Organization @relation(fields: [orgId], references: [id])
  schedules     ReportSchedule[]
}

model ReportSchedule {
  id            String   @id @default(cuid())
  templateId    String
  clientId      String
  frequency     Frequency // DAILY | WEEKLY | MONTHLY
  dayOfWeek     Int?     // 0-6 para weekly
  dayOfMonth    Int?     // 1-31 para monthly
  recipients    String[] // Emails
  active        Boolean  @default(true)
  lastSent      DateTime?

  template      ReportTemplate @relation(fields: [templateId], references: [id])
  client        Client         @relation(fields: [clientId], references: [id])
}

enum ReportType {
  EXECUTIVE
  DETAILED
  CRISIS
  CUSTOM
}

enum Frequency {
  DAILY
  WEEKLY
  MONTHLY
}
```

**Tecnología de generación:**
- `@react-pdf/renderer` para PDFs
- `nodemailer` para envío
- Almacenamiento en S3/DO Spaces

---

### 3.2 🌐 API Pública + Webhooks

**El problema:** Clientes enterprise necesitan integrar MediaBot con sus sistemas.

**La solución:** REST API pública con autenticación y webhooks.

```
Endpoints públicos:
├── GET  /api/v1/clients
├── GET  /api/v1/clients/:id/mentions
├── GET  /api/v1/clients/:id/analytics
├── GET  /api/v1/clients/:id/sov
├── POST /api/v1/webhooks
└── GET  /api/v1/webhooks/:id/logs
```

**Webhooks disponibles:**
- `mention.created` - Nueva mención detectada
- `mention.analyzed` - Análisis AI completado
- `crisis.detected` - Crisis activada
- `crisis.resolved` - Crisis resuelta
- `digest.sent` - Digest diario enviado

**Implementación técnica:**

```typescript
// Modelo para API keys
model ApiKey {
  id            String   @id @default(cuid())
  orgId         String
  name          String
  key           String   @unique // hash del key real
  prefix        String   // mb_live_ o mb_test_
  permissions   String[] // ['read:mentions', 'read:analytics']
  rateLimit     Int      @default(1000) // requests/hora
  lastUsed      DateTime?
  expiresAt     DateTime?
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())

  org           Organization @relation(fields: [orgId], references: [id])
}

model Webhook {
  id            String   @id @default(cuid())
  orgId         String
  url           String
  events        String[] // ['mention.created', 'crisis.detected']
  secret        String   // Para verificar firma HMAC
  active        Boolean  @default(true)
  failCount     Int      @default(0)
  lastSuccess   DateTime?
  lastFailure   DateTime?

  org           Organization @relation(fields: [orgId], references: [id])
  logs          WebhookLog[]
}

model WebhookLog {
  id            String   @id @default(cuid())
  webhookId     String
  event         String
  payload       Json
  response      Int?     // HTTP status code
  error         String?
  createdAt     DateTime @default(now())

  webhook       Webhook  @relation(fields: [webhookId], references: [id])
}
```

**Archivos a crear:**
- `packages/web/src/app/api/v1/` (endpoints REST)
- `packages/workers/src/webhooks/dispatcher.ts`
- `packages/web/src/app/dashboard/settings/api/page.tsx`

---

### 3.3 📱 Mobile App (React Native)

**El problema:** Los usuarios necesitan acceso móvil para gestión en tiempo real.

**La solución:** App nativa con funcionalidades clave.

```
Funcionalidades mobile:
├── Dashboard resumido con KPIs
├── Timeline de menciones con filtros básicos
├── Push notifications (HIGH/CRITICAL)
├── Gestión de tareas
├── Detalle de mención con respuesta rápida
└── Configuración de alertas
```

**Stack técnico:**
- React Native + Expo
- tRPC client (mismo backend)
- Push notifications via Firebase/Expo
- Biometric auth (FaceID/TouchID)

**Estimación:** 3-4 meses de desarrollo dedicado

---

## FASE 4: Inteligencia Avanzada (Q4 2026)

### 4.1 🎯 Journalist Matching AI

**El problema:** Los clientes no saben a qué periodistas contactar para cada historia.

**La solución:** AI que recomienda periodistas basado en historial y afinidad.

```
Algoritmo de matching:
1. Analizar historial del periodista (temas, sentiment, frecuencia)
2. Comparar con pitch/historia del cliente
3. Calcular "Match Score" (0-100)
4. Rankear y recomendar top 10 periodistas
5. Incluir tips de approach basados en estilo
```

**Prompt para Claude:**
```
Basándote en el historial de cobertura de este periodista:
- Temas frecuentes: [lista]
- Sentiment promedio hacia [industria]: [valor]
- Medios donde publica: [lista]
- Estilo de escritura: [análisis]

Y considerando este pitch del cliente:
[pitch text]

Calcula un match score (0-100) y explica por qué este periodista
sería o no un buen contacto para esta historia.
```

### 4.2 📊 Competitive Intelligence Dashboard

**El problema:** El SOV actual es básico. Los clientes necesitan inteligencia competitiva profunda.

**La solución:** Dashboard dedicado a análisis competitivo.

```
Métricas competitivas:
├── SOV trend por competidor
├── Topic analysis: ¿De qué hablan los competidores?
├── Sentiment comparison por tema
├── Share of Search (visibilidad en buscadores)
├── Crisis timeline comparativo
├── Media mix comparison (qué medios cubren a quién)
└── Message penetration: qué narrativas ganan
```

### 4.3 🔄 Automated Response Workflows

**El problema:** La generación de respuestas es manual. Se pierde tiempo valioso en crisis.

**La solución:** Workflows automatizados de respuesta.

```
Workflow ejemplo - Crisis Response:
1. TRIGGER: Crisis detectada (severity >= HIGH)
2. AUTO: Generar draft de holding statement
3. AUTO: Notificar a equipo de crisis por Telegram
4. AUTO: Crear tarea urgente asignada a PR lead
5. AUTO: Preparar Q&A anticipado con AI
6. MANUAL: Aprobación y envío
7. AUTO: Monitorear respuesta en medios
8. AUTO: Generar reporte post-crisis
```

**Implementación con BullMQ Flows:**
```typescript
const crisisWorkflow = new FlowProducer({ connection: redis });

await crisisWorkflow.add({
  name: 'crisis-response',
  queueName: 'workflows',
  children: [
    { name: 'generate-holding-statement', queueName: 'ai-tasks' },
    { name: 'notify-crisis-team', queueName: 'notifications' },
    { name: 'create-urgent-task', queueName: 'tasks' },
    { name: 'generate-qa', queueName: 'ai-tasks' },
  ],
});
```

---

## Priorización y Roadmap

### Q1 2026 (Enero - Marzo)
| Feature | Semanas | Impacto | Riesgo |
|---------|---------|---------|--------|
| LLM Brand Visibility | 3-4 | 🔥🔥🔥 | Medio |
| MIV Calculator | 2 | 🔥🔥 | Bajo |
| Predictive Crisis | 3 | 🔥🔥🔥 | Medio |

### Q2 2026 (Abril - Junio)
| Feature | Semanas | Impacto | Riesgo |
|---------|---------|---------|--------|
| Podcast Monitoring | 4 | 🔥🔥 | Bajo |
| Visual Recognition | 3 | 🔥🔥 | Medio |
| Influencer Analysis | 3 | 🔥🔥 | Bajo |

### Q3 2026 (Julio - Septiembre)
| Feature | Semanas | Impacto | Riesgo |
|---------|---------|---------|--------|
| White-Label Reports | 4 | 🔥🔥🔥 | Bajo |
| Public API + Webhooks | 4 | 🔥🔥 | Bajo |
| Mobile App (MVP) | 8 | 🔥🔥 | Alto |

### Q4 2026 (Octubre - Diciembre)
| Feature | Semanas | Impacto | Riesgo |
|---------|---------|---------|--------|
| Journalist Matching | 3 | 🔥🔥 | Medio |
| Competitive Intelligence | 4 | 🔥🔥🔥 | Bajo |
| Automated Workflows | 4 | 🔥🔥 | Medio |

---

## Costos Estimados

### Nuevas APIs
| Servicio | Uso estimado | Costo mensual |
|----------|--------------|---------------|
| OpenAI Whisper | 6000 min/mes | $36 |
| OpenAI GPT-4 | 500K tokens | $15 |
| Google Vision | 10K imágenes | $15 |
| **Total adicional** | | **~$66/mes** |

### Infraestructura
| Recurso | Actual | Propuesto |
|---------|--------|-----------|
| DigitalOcean Droplet | $24/mes | $48/mes (upgrade) |
| Storage (DO Spaces) | $0 | $5/mes |
| **Total infra** | $24/mes | **$53/mes** |

### Total mensual proyectado: ~$120/mes (+$96 vs actual)

---

## Métricas de Éxito

| Métrica | Actual | Target Q4 2026 |
|---------|--------|----------------|
| Features implementadas | 50+ | 70+ |
| Fuentes monitoreadas | 300+ RSS | 500+ RSS + 100 podcasts |
| Precisión análisis | 74% | 85% |
| Tiempo detección crisis | 60 min | 15 min (predictivo) |
| Clientes satisfechos | N/A | NPS > 50 |

---

## Próximos Pasos

1. **Revisión y priorización** con stakeholders
2. **Proof of Concept** de LLM Brand Visibility (1 semana)
3. **Sprint Planning** para Q1 2026
4. **Documentación técnica** detallada por feature

---

*Generado por análisis de innovación - 2026-01-29*
*Basado en: Codebase MediaBot + Tendencias de mercado 2025-2026*
