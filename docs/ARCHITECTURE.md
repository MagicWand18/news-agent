# Arquitectura de MediaBot

## Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FUENTES DE DATOS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│   │   RSS   │  │NewsData │  │  GDELT  │  │ Google  │  │ Social  │          │
│   │300+ DB  │  │   API   │  │   API   │  │   CSE   │  │  Media  │          │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
│        │            │            │            │            │                │
│        └────────────┴─────┬──────┴────────────┴────────────┘                │
│                           ▼                                                 │
│                  ┌─────────────────┐                                        │
│                  │    COLECTORES   │                                        │
│                  │    (Workers)    │                                        │
│                  └────────┬────────┘                                        │
│                           │                                                 │
└───────────────────────────┼─────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE DE PROCESAMIENTO                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐              │
│   │   INGEST     │      │   MATCHING   │      │   ANALYSIS   │              │
│   │              │      │              │      │              │              │
│   │ - Dedup URL  │─────▶│ - Keywords   │─────▶│ - Claude AI  │              │
│   │ - Dedup hash │      │ - Por client │      │ - Sentiment  │              │
│   │ - Save DB    │      │ - Crear      │      │ - Relevance  │              │
│   │              │      │   Mention    │      │ - Summary    │              │
│   └──────────────┘      └──────────────┘      └──────┬───────┘              │
│                                                      │                      │
│                                                      ▼                      │
│                                             ┌──────────────┐                │
│                                             │ NOTIFICATION │                │
│                                             │              │                │
│                                             │ - Telegram   │                │
│                                             │ - Urgency    │                │
│                                             │ - Digest     │                │
│                                             └──────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Colectores (`packages/workers/src/collectors/`)

Cada colector normaliza articulos al tipo `NormalizedArticle`:

| Archivo | Fuente | Intervalo | Descripcion |
|---------|--------|-----------|-------------|
| `rss.ts` | RSS Feeds (DB) | 10 min | 300+ medios mexicanos desde tabla RssSource |
| `newsdata.ts` | NewsData.io | 30 min | API de noticias con filtro pais. Param `timeframe` removido (plan gratuito no lo soporta) |
| `gdelt.ts` | GDELT | 15 min | Base de datos global de eventos. Keywords en lotes de 8, rate limit 6s entre requests |
| `google.ts` | Google CSE | 2 horas | Busqueda personalizada |
| `social.ts` | EnsembleData | 30 min | Instagram, TikTok, YouTube |

### 2. Ingestion (`packages/workers/src/collectors/ingest.ts`)

```
┌───────────────┐
│   Article     │
│   entrante    │
└───────┬───────┘
        │
        ▼
┌───────────────┐     Ya existe?     ┌───────────────┐
│ Check URL dup │─────────Yes───────▶│     SKIP      │
└───────┬───────┘                    └───────────────┘
        │ No
        ▼
┌───────────────┐     Ya existe?     ┌───────────────┐
│Check hash dup │─────────Yes───────▶│     SKIP      │
└───────┬───────┘                    └───────────────┘
        │ No
        ▼
┌───────────────┐
│  Save to DB   │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Run Matching  │
└───────────────┘
```

### 3. Matching de Keywords

El matching se ejecuta contra TODAS las keywords activas de TODOS los clientes:

```sql
-- Pseudo-query
SELECT * FROM Keyword WHERE active = true
```

Para cada keyword encontrada en el texto (title + content):
1. Se crea una `Mention` vinculando Article -> Client
2. Se extrae un `snippet` de contexto (~300 chars)
3. Se encola job de analisis AI

### 4. Analisis AI (`packages/workers/src/analysis/`)

Usa Claude 3.5 Haiku para analizar cada mencion:

**Input:**
- Titulo del articulo
- Snippet de contexto
- Nombre del cliente
- Keywords del cliente

**Output:**
- `sentiment`: POSITIVE | NEGATIVE | NEUTRAL | MIXED
- `relevance`: 1-10 (1=nula, 10=altisima)
- `aiSummary`: Resumen ejecutivo
- `aiAction`: Accion sugerida
- `urgency`: CRITICAL | HIGH | MEDIUM | LOW

### 4.1 Clustering (`packages/workers/src/analysis/clustering.ts`)

Agrupa menciones del mismo evento automaticamente:

```
┌────────────────────────────────────────────────────────────────┐
│                    CLUSTERING FLOW                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐                                           │
│   │ Nueva mencion  │                                           │
│   │ relevance >= 5 │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ findClusterParent()                    │                   │
│   │                                        │                   │
│   │ 1. Check cache (30 min TTL)            │                   │
│   │ 2. Get recent mentions (24h)           │                   │
│   │ 3. Keyword similarity (Jaccard)        │                   │
│   │ 4. AI comparison if moderate match     │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌─────────────────┐    No match   ┌─────────────────┐       │
│   │ Match found?    │───────────────▶│ No clustering   │       │
│   └───────┬─────────┘               └─────────────────┘       │
│           │ Yes                                                │
│           ▼                                                    │
│   ┌─────────────────────────────────────────┐                  │
│   │ Update mention:                         │                  │
│   │ - parentMentionId = parent.id           │                  │
│   │ - clusterScore = similarity             │                  │
│   └─────────────────────────────────────────┘                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Algoritmo de similaridad:**
- Jaccard >= 0.7: Match directo (sin AI)
- Jaccard >= 0.3: Candidato para AI comparison
- AI confidence >= 0.7: Match confirmado

### 4.2 Extraccion de Temas (`packages/workers/src/analysis/topic-extractor.ts`)

Extrae automaticamente el tema principal de cada mencion:

```
┌────────────────────────────────────────────────────────────────┐
│                    TOPIC EXTRACTION FLOW                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐                                           │
│   │ Nueva mencion  │                                           │
│   │ analizada      │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ extractTopic() - Claude API            │                   │
│   │                                        │                   │
│   │ Input: titulo, contenido, cliente      │                   │
│   │ Output: tema, confianza, keywords      │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌─────────────────┐    < 0.3    ┌─────────────────┐         │
│   │ Confidence OK?  │─────────────▶│ Skip topic      │         │
│   └───────┬─────────┘             └─────────────────┘         │
│           │ >= 0.3                                              │
│           ▼                                                    │
│   ┌─────────────────────────────────────────┐                  │
│   │ Upsert TopicCluster (transaccion)       │                  │
│   │ - Buscar/crear cluster                  │                  │
│   │ - Actualizar mention.topic              │                  │
│   │ - Incrementar cluster.count             │                  │
│   └─────────────────────────────────────────┘                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Share of Voice (`packages/workers/src/analysis/sov-calculator.ts`)

Calcula el porcentaje de menciones de un cliente vs competidores:

- **SOV basico**: `(menciones_cliente / total_menciones) * 100`
- **SOV ponderado**: Multiplica por tier de fuente (Tier 1 = 3x, Tier 2 = 2x, Tier 3 = 1x)
- **Historico**: Tendencia de las ultimas 8 semanas

### 4.4 Alertas de Temas Emergentes (`packages/workers/src/workers/emerging-topics-worker.ts`)

Detecta y notifica temas nuevos que estan ganando traccion:

```
┌────────────────────────────────────────────────────────────────┐
│                  EMERGING TOPICS DETECTION                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐                                           │
│   │ Cron job       │                                           │
│   │ cada 4 horas   │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ detectEmergingTopics(orgId, 24h, 3)    │                   │
│   │                                        │                   │
│   │ - Buscar temas con >= 3 menciones      │                   │
│   │ - Verificar si es nuevo (no existia    │                   │
│   │   hace 7 dias)                         │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌─────────────────┐    No hay    ┌─────────────────┐        │
│   │ Temas nuevos?   │──────────────▶│ No-op           │        │
│   └───────┬─────────┘              └─────────────────┘        │
│           │ Si                                                  │
│           ▼                                                    │
│   ┌─────────────────────────────────────────┐                  │
│   │ Para cada cliente con menciones:        │                  │
│   │ - Verificar telegramGroupId             │                  │
│   │ - Verificar no notificado en 24h        │                  │
│   │ - Encolar NOTIFY_EMERGING_TOPIC         │                  │
│   └─────────────────────────────────────────┘                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.5 Generacion de Respuesta (`packages/web/src/server/routers/mentions.ts`)

Genera borradores de comunicados de prensa on-demand:

**Input:**
- Mencion con articulo y cliente
- Tono solicitado (opcional)

**Output:**
- `title`: Titulo del comunicado
- `body`: Cuerpo (3-4 parrafos)
- `tone`: PROFESSIONAL | DEFENSIVE | CLARIFICATION | CELEBRATORY
- `audience`: Publico objetivo
- `callToAction`: Siguiente paso recomendado
- `keyMessages`: Lista de mensajes clave

### 4.9 Flujo de Acción (Pipeline de Acción)

Cierra el ciclo desde la detección de datos hasta la medición de resultados:

```
┌────────────────────────────────────────────────────────────────┐
│                    ACTION PIPELINE FLOW                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   DATO → INSIGHT → TAREA → ACCIÓN → MEDICIÓN                  │
│                                                                │
│   ┌──────────────┐                                             │
│   │ Fuentes de   │                                             │
│   │ Insight      │                                             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ├─ suggestedAction (cada mención analizada)           │
│          ├─ generateResponse (comunicado on-demand)            │
│          ├─ CrisisAlert (detección automática)                 │
│          └─ WeeklyInsights (recomendaciones semanales)         │
│                                                                │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │ Acciones     │                                             │
│   │ Disponibles  │                                             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ├─ Crear tarea desde mención                          │
│          ├─ Generar y persistir borrador de respuesta          │
│          ├─ Gestionar crisis (asignar, resolver, notar)        │
│          └─ Marcar acción recomendada como completada          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Modelo de salida de `generateResponse`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `title` | string | Título del comunicado |
| `body` | string | Cuerpo (3-4 párrafos) |
| `tone` | enum | PROFESSIONAL, DEFENSIVE, CLARIFICATION, CELEBRATORY |
| `audience` | string | Público objetivo |
| `callToAction` | string | Siguiente paso recomendado |
| `keyMessages` | string[] | Lista de mensajes clave |

### 4.10 Response Draft Workflow (`packages/web/src/server/routers/responses.ts`)

Workflow de aprobación de comunicados de prensa:

```
┌────────────────────────────────────────────────────────────────┐
│                  RESPONSE DRAFT WORKFLOW                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐                                           │
│   │ Usuario genera │                                           │
│   │ comunicado     │                                           │
│   │ (mención/social│                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌──────────────┐                                             │
│   │    DRAFT     │◄────────────────────────────┐               │
│   └──────┬───────┘                             │               │
│          │                                     │               │
│          ▼                                     │               │
│   ┌──────────────┐    Requiere cambios   ┌─────┴──────┐       │
│   │  IN_REVIEW   │─────────────────────▶│  (vuelve)  │       │
│   └──────┬───────┘                       └────────────┘       │
│          │                                                     │
│          ▼  (solo ADMIN/SUPERVISOR)                             │
│   ┌──────────────┐                                             │
│   │   APPROVED   │                                             │
│   └──────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│   ┌──────────────┐                                             │
│   │  PUBLISHED   │  (estado final)                             │
│   └──────────────┘                                             │
│                                                                │
│   Cualquier estado → DISCARDED → DRAFT (reactivar)             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.11 Alert Rules Worker (`packages/workers/src/workers/alert-rules-worker.ts`)

Evaluación periódica de reglas de alerta configurables por cliente:

```
┌────────────────────────────────────────────────────────────────┐
│                  ALERT RULES EVALUATION                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐                                           │
│   │ Cron job       │                                           │
│   │ cada 30 min    │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ Cargar AlertRules activas             │                   │
│   │ con datos de cliente                  │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ Para cada regla, evaluar condición:   │                   │
│   │                                        │                   │
│   │ NEGATIVE_SPIKE: >= N negativas en 1h  │                   │
│   │ VOLUME_SURGE:  >= N menciones en 1h   │                   │
│   │ NO_MENTIONS:   0 menciones en 24h     │                   │
│   │ SOV_DROP:      SOV actual < anterior  │                   │
│   │ COMPETITOR_SPIKE: competidor sube N%  │                   │
│   │ SENTIMENT_SHIFT: ratio negativo sube  │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌─────────────────┐    No     ┌─────────────────┐           │
│   │ Condición met?  │──────────▶│ Skip            │           │
│   └───────┬─────────┘           └─────────────────┘           │
│           │ Sí                                                 │
│           ▼                                                    │
│   ┌─────────────────┐    Sí     ┌─────────────────┐           │
│   │ Cooldown (1h)?  │──────────▶│ Skip duplicado  │           │
│   └───────┬─────────┘           └─────────────────┘           │
│           │ No                                                 │
│           ▼                                                    │
│   ┌─────────────────────────────────────────┐                  │
│   │ Crear notificación in-app              │                  │
│   │ + Encolar alerta Telegram              │                  │
│   └─────────────────────────────────────────┘                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.12 Archive Worker (`packages/workers/src/workers/archive-worker.ts`)

Auto-archivado de menciones antiguas:

- **Cron**: 3:00 AM diario
- **Lógica**: Marca menciones con `isLegacy = true` si el artículo tiene > 30 días
- **Impacto**: Las menciones legacy se muestran en tab "Historial" del detalle de cliente

### 5. Notificaciones (`packages/workers/src/notifications/`)

**Alertas inmediatas:**
- Menciones con `urgency` HIGH o CRITICAL
- Se envian via Telegram al grupo del cliente
- **3 niveles de destinatarios**: Cliente (TelegramRecipient) → Organización (OrgTelegramRecipient) → SuperAdmin (User.telegramUserId)
- Resolución centralizada en `recipients.ts`: `getAllRecipientsForClient()` consolida, deduplica por chatId y filtra por preferencias

**Digest diario:**
- Se ejecuta a las 8:00 AM
- Resumen de todas las menciones del dia anterior
- Agrupadas por cliente

**Filtro de antigüedad (30 días):**

Menciones y posts con más de 30 días de antigüedad NO generan notificaciones ni alertas de crisis. Esto previene que artículos viejos recién descubiertos por colectores o grounding disparen alertas falsas.

| Worker | Campo evaluado | Comportamiento |
|--------|---------------|----------------|
| `analysis/worker.ts` | `mention.publishedAt` (fallback `article.publishedAt`) | Skip notificación + skip crisis check |
| `analysis/social-worker.ts` | `socialMention.postedAt` | Skip notificación Telegram |
| `notifications/worker.ts` | `mention.publishedAt` (fallback `article.publishedAt`) | Skip envío + marca `notified=true` (safety net) |

La verificación en `analysis/worker.ts` es la barrera principal; la verificación en `notifications/worker.ts` actúa como red de seguridad por si una mención se encola directamente.

## Modelo de Datos

```
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│  Organization  │──1:N─▶│     Client     │──1:N─▶│    Keyword     │
└────────────────┘       └───────┬────────┘       └────────────────┘
        │                        │
        │                        ├──1:N─▶ SocialAccount
        │                        ├──1:N─▶ SocialMention ──N:1─▶ TopicThread?
        │                        ├──1:N─▶ TopicThread ──1:N─▶ TopicThreadEvent
        │                        ├──1:N─▶ CrisisAlert ──1:N─▶ CrisisNote
        │                        ├──1:N─▶ ActionItem
        │                        ├──1:N─▶ AlertRule
        ▼                        ▼
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│      User      │       │    Mention     │◀──N:1─│    Article     │
└────────┬───────┘       └───────┬────────┘       └────────────────┘
         │                       │
         │                       ├──N:1─▶ TopicThread? (topicThreadId)
         │                       ├──1:N─▶ ResponseDraft
         │                       │
         │                       │ 1:N
         │                       ▼
         └──────────────▶┌────────────────┐
                         │      Task      │◀── socialMentionId (opcional)
                         └────────────────┘
```

### Entidades Principales

| Entidad | Proposito |
|---------|-----------|
| `Organization` | Agrupa usuarios y clientes |
| `User` | Usuario del sistema (roles: ADMIN, SUPERVISOR, ANALYST) |
| `Client` | Entidad monitoreada (ej: empresa, politico) |
| `Keyword` | Terminos a buscar (tipos: NAME, BRAND, COMPETITOR, TOPIC, ALIAS) |
| `Article` | Articulo colectado de cualquier fuente |
| `Mention` | Match de articulo con cliente (incluye `publishedAt` denormalizado) |
| `Task` | Tarea asignada a usuario para seguimiento |
| `EmergingTopicNotification` | Registro de notificaciones de temas emergentes |
| `RssSource` | Fuente RSS configurable (300+ medios mexicanos) |
| `SourceRequest` | Solicitud de inclusion de nueva fuente |
| `TelegramRecipient` | Múltiples destinatarios de Telegram por cliente |
| `Notification` | Notificaciones in-app para usuarios |
| `SocialAccount` | Cuentas de redes sociales a monitorear |
| `SocialMention` | Menciones detectadas en redes sociales |
| `ResponseDraft` | Borrador de comunicado con workflow de aprobación (Sprint 13) |
| `CrisisNote` | Notas y acciones en gestión de crisis (Sprint 13) |
| `ActionItem` | Acciones recomendadas por IA con seguimiento (Sprint 13) |
| `AlertRule` | Reglas de alerta configurables por cliente (Sprint 13) |
| `DailyBrief` | Brief ejecutivo diario por cliente (Sprint 15) |
| `Campaign` | Campañas de PR con métricas y comparativa (Sprint 16) |
| `CampaignMention` | Link entre campaña y mención de medios (Sprint 16) |
| `CampaignSocialMention` | Link entre campaña y mención social (Sprint 16) |
| `CampaignNote` | Notas en timeline de campaña (Sprint 16) |
| `OrgTelegramRecipient` | Destinatario Telegram a nivel organización |
| `SharedReport` | Reporte compartido con URL pública y expiración (Sprint 17) |
| `TopicThread` | Hilo temático que agrupa menciones por tema y cliente (Sprint 19) |
| `TopicThreadEvent` | Timeline de eventos del hilo temático (Sprint 19) |

### Campo `Mention.publishedAt` (denormalizado)

Campo `DateTime?` que almacena la fecha de publicación del artículo directamente en la mención, evitando JOINs costosos para queries temporales.

**Origen del dato:**
- `ingest.ts`: Copia `article.publishedAt` al crear la mención durante el matching de keywords
- `grounding-service.ts`: Copia `article.publishedAt` al crear menciones desde búsquedas con Gemini
- `clients.ts` (createWithOnboarding): Copia `article.publishedAt` al importar artículos durante el onboarding

**Uso en queries:**
- Todos los filtros temporales del dashboard, intelligence, executive y reports usan `publishedAt` en lugar de `createdAt`
- Raw SQL usa `COALESCE("publishedAt", "createdAt")` como fallback para menciones creadas antes de la migración que no tienen el campo poblado
- Índices de base de datos: `[clientId, publishedAt]`, `[clientId, isLegacy, publishedAt]`, `[clientId, parentMentionId, publishedAt]`

**Beneficio principal:**
- Permite filtrar menciones por fecha real de publicación del artículo, no por fecha de ingesta al sistema
- Evita que artículos viejos recién descubiertos por colectores o grounding aparezcan como noticias recientes
- Previene falsas alertas de crisis y notificaciones de artículos antiguos (ver filtro de 30 días en sección de Notificaciones)

## Sistema de Colas (BullMQ)

```
┌─────────────────────────────────────────────────────────────────┐
│                    REDIS / BULLMQ (31 colas)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   COLLECTOR QUEUES (Cron patterns)                              │
│   ────────────────────────────────                              │
│   collect-rss          : */10 * * * *  (cada 10 min)            │
│   collect-newsdata     : */30 * * * *  (cada 30 min)            │
│   collect-gdelt        : */15 * * * *  (cada 15 min)            │
│   collect-google       : 0 */2 * * *   (cada 2 horas)           │
│   collect-social       : */30 * * * *  (cada 30 min)            │
│   collect-gnews        : Google News RSS para fuentes sin feed  │
│   collect-gnews-client : Google News búsqueda por cliente       │
│                                                                 │
│   PROCESSING QUEUES                                             │
│   ─────────────────                                             │
│   ingest-article       : Procesar articulo individual           │
│   analyze-mention      : Analizar mencion con AI                │
│   analyze-social       : Analizar menciones sociales con AI     │
│   extract-topic        : Extraer tema de mencion con AI         │
│   extract-social-comments : Extraer comentarios de posts        │
│   onboarding           : Generar keywords iniciales para cliente│
│   crisis-check         : Verificar condiciones de crisis        │
│                                                                 │
│   SCHEDULED ANALYSIS QUEUES                                     │
│   ──────────────────────────                                    │
│   notify-digest        : 0 8 * * * (8:00 AM diario)            │
│   weekly-insights      : Generar insights semanales (Lun 6AM)   │
│   weekly-report        : Reporte semanal                        │
│   emerging-topics      : Detectar temas emergentes (cada 4h)    │
│   watchdog-mentions    : Vigilancia de menciones                │
│                                                                 │
│   GROUNDING QUEUES                                              │
│   ────────────────                                              │
│   grounding-check      : Verificar menciones bajas (7:00 AM)   │
│   grounding-weekly     : Grounding semanal programado (6:00 AM)│
│   grounding-execute    : Ejecutar búsqueda con Gemini           │
│                                                                 │
│   ACTION PIPELINE QUEUES (Sprint 13+)                           │
│   ───────────────────────────────────                           │
│   check-alert-rules    : */30 * * * * (cada 30 min)            │
│   archive-old-mentions : 0 3 * * * (3:00 AM diario)            │
│                                                                 │
│   NOTIFICATION QUEUES                                           │
│   ────────────────────                                          │
│   notify-alert         : Alerta inmediata por mención urgente   │
│   notify-crisis        : Alerta de crisis detectada             │
│   notify-emerging-topic: Notificar tema emergente via Telegram  │
│   notify-telegram      : Notificación genérica multi-nivel      │
│   notify-topic         : Notificación por tema (new/threshold/  │
│                          sentiment_shift)                        │
│                                                                 │
│   TOPIC THREAD QUEUES (Sprint 19)                               │
│   ───────────────────────────────                               │
│   close-inactive-threads : 0 */6 * * * (cada 6 horas)          │
│   analyze-social-topic   : Extracción de tema para social posts │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Auto-recuperación de Schedulers

Los schedulers de cron se re-registran cada 30 minutos via `upsertJobScheduler` (idempotente).
Esto previene la pérdida de cron jobs cuando Redis pierde keys por restart o eviction.

Configurado en `packages/workers/src/queues.ts`:
- `SCHEDULER_REFRESH_INTERVAL_MS = 30 * 60 * 1000` (30 minutos)
- Al iniciar: registra todos los schedulers
- Cada 30 min: re-registra (log compacto)
- `refreshInterval.unref()` para no bloquear shutdown

### Redis Persistence

Redis está configurado con persistencia dual en `docker-compose.prod.yml`:
- **RDB**: Snapshots cada 60s si hay 100+ cambios, o cada 300s si hay 1+ cambio
- **AOF**: Append-only file con `appendfsync everysec`
- **maxmemory-policy**: `noeviction` (nunca descarta keys, retorna error si lleno)

Esto previene la pérdida de BullMQ scheduler keys en reinicios de contenedores.

## Flujo de Onboarding de Cliente

```
┌──────────────┐
│ Crear Client │
│ (Dashboard)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Encolar job  │
│ "onboarding" │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│         AI Onboarding            │
│                                  │
│ Input:                           │
│ - Nombre del cliente             │
│ - Descripcion                    │
│ - Industria                      │
│                                  │
│ Output:                          │
│ - Keywords sugeridas             │
│ - Competidores identificados     │
│ - Temas sensibles                │
│ - Lineas de accion               │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Guardar en DB                   │
│  - Crear Keywords automaticas    │
│  - Actualizar client.onboarding  │
└──────────────────────────────────┘
```

## Estructura de Packages

```
packages/
├── shared/              # Codigo compartido
│   └── src/
│       ├── config.ts    # Configuracion centralizada
│       ├── prisma.ts    # Cliente Prisma singleton
│       ├── ai-client.ts # Cliente Anthropic singleton
│       ├── types.ts     # Tipos compartidos
│       └── index.ts     # Exports
│
├── workers/             # Workers de BullMQ
│   └── src/
│       ├── queues.ts    # Definicion de colas
│       ├── index.ts     # Entry point
│       ├── collectors/  # Colectores de fuentes
│       ├── analysis/    # AI analysis + onboarding
│       └── notifications/
│
├── web/                 # Dashboard Next.js 15
│   └── src/
│       ├── app/         # App Router
│       ├── server/      # tRPC routers
│       └── lib/         # Utilities
│
└── bot/                 # Bot Telegram
    └── src/
        ├── bot.ts       # Configuracion Grammy
        ├── commands/    # Handlers de comandos
        └── conversations/
```

## Variables de Entorno Criticas

| Variable | Usado por | Impacto si falta |
|----------|-----------|------------------|
| `DATABASE_URL` | Todos | App no inicia |
| `REDIS_URL` | Workers | Colas no funcionan |
| `ANTHROPIC_API_KEY` | Workers | AI no funciona |
| `TELEGRAM_BOT_TOKEN` | Bot, Workers | Notificaciones fallan |

## Sistema de Configuracion

MediaBot utiliza un sistema de configuracion de dos niveles:

```
┌─────────────────────────────────────────────────────────────────┐
│                 SISTEMA DE CONFIGURACION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   NIVEL 1: Variables de Entorno                                 │
│   ─────────────────────────────                                 │
│   - Cargadas al iniciar la app                                  │
│   - Requieren redeploy para cambiar                             │
│   - Configuracion de infraestructura                            │
│                                                                 │
│   Ejemplos:                                                     │
│   ├── COLLECTOR_RSS_CRON      (cron patterns)                   │
│   ├── ANALYSIS_WORKER_CONCURRENCY (workers)                     │
│   ├── CLAUDE_MODEL            (AI)                              │
│   └── JOB_RETRY_ATTEMPTS      (jobs)                            │
│                                                                 │
│   NIVEL 2: Settings Dinamicos (DB)                              │
│   ────────────────────────────────                              │
│   - Guardados en tabla `Setting`                                │
│   - Editables desde /dashboard/settings                         │
│   - Cache en memoria con TTL de 1 minuto                        │
│   - No requieren redeploy                                       │
│                                                                 │
│   Ejemplos:                                                     │
│   ├── prefilter.confidence_threshold  (0.6)                     │
│   ├── urgency.critical_min_relevance  (8)                       │
│   ├── crisis.negative_spike_threshold (3)                       │
│   └── dashboard.recent_mentions_limit (10)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6 Fuentes RSS Dinamicas (`packages/workers/src/collectors/rss.ts`)

Sprint 8 migra las fuentes RSS de config hardcodeada a base de datos:

```
┌────────────────────────────────────────────────────────────────┐
│                    RSS COLLECTOR FLOW                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐                                           │
│   │ Cron job       │                                           │
│   │ cada 10 min    │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ getRssSources()                        │                   │
│   │                                        │                   │
│   │ 1. Query tabla RssSource (active=true) │                   │
│   │ 2. Si hay resultados, usar DB          │                   │
│   │ 3. Si no, fallback a config.rssFeeds   │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ Para cada fuente:                      │                   │
│   │ - Parsear RSS feed                     │                   │
│   │ - Match keywords                       │                   │
│   │ - Actualizar lastFetch/errorCount      │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ deactivateFailingSources()             │                   │
│   │ Desactiva fuentes con 10+ errores      │                   │
│   └────────────────────────────────────────┘                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.8 Grounding Avanzado por Cliente (`packages/workers/src/grounding/`)

Sistema de búsqueda automática de noticias con Gemini cuando un cliente tiene pocas menciones:

```
┌────────────────────────────────────────────────────────────────┐
│                    GROUNDING SYSTEM FLOW                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   TRIGGER 1: LOW MENTIONS CHECK (Cron 7:00 AM)                 │
│   ─────────────────────────────────────────────                │
│   ┌────────────────┐                                           │
│   │ Cron job       │                                           │
│   │ cada día 7AM   │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ Para cada cliente con groundingEnabled: │                   │
│   │                                        │                   │
│   │ 1. Verificar lastGroundingAt > 12h     │                   │
│   │ 2. Contar menciones últimos N días     │                   │
│   │ 3. Si < minDailyMentions consecutivos  │                   │
│   │    → Encolar grounding-execute         │                   │
│   └────────────────────────────────────────┘                   │
│                                                                │
│   TRIGGER 2: WEEKLY GROUNDING (Cron 6:00 AM)                   │
│   ──────────────────────────────────────────                   │
│   ┌────────────────┐                                           │
│   │ Cron job       │                                           │
│   │ cada día 6AM   │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ Para clientes con weeklyGroundingDay   │                   │
│   │ igual a hoy:                           │                   │
│   │                                        │                   │
│   │ 1. Verificar no ejecutado hoy          │                   │
│   │ 2. Encolar grounding-execute           │                   │
│   └────────────────────────────────────────┘                   │
│                                                                │
│   TRIGGER 3: MANUAL (UI Button)                                │
│   ─────────────────────────────                                │
│   ┌────────────────┐                                           │
│   │ Usuario click  │                                           │
│   │ "Ejecutar      │                                           │
│   │ búsqueda ahora"│                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ clients.executeManualGrounding()       │                   │
│   │ → Encolar grounding-execute            │                   │
│   └────────────────────────────────────────┘                   │
│                                                                │
│   GROUNDING EXECUTE WORKER                                     │
│   ────────────────────────                                     │
│   ┌────────────────────────────────────────┐                   │
│   │ executeGroundingSearch():              │                   │
│   │                                        │                   │
│   │ 1. Llamar Gemini con Google Search     │                   │
│   │    grounding (googleSearch tool)       │                   │
│   │ 2. Parsear JSON de artículos           │                   │
│   │ 3. Crear/encontrar artículos en DB     │                   │
│   │ 4. Complementar con artículos de DB    │                   │
│   │ 5. Crear menciones nuevas              │                   │
│   │ 6. Actualizar lastGroundingAt/Result   │                   │
│   └────────────────────────────────────────┘                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Colas BullMQ de Grounding:**

| Cola | Descripción | Cron |
|------|-------------|------|
| `grounding-check` | Verificación de menciones bajas | `0 7 * * *` (7:00 AM) |
| `grounding-weekly` | Grounding semanal programado | `0 6 * * *` (6:00 AM) |
| `grounding-execute` | Ejecución de búsquedas con Gemini | On-demand |

**Rate Limiting:**
- Concurrencia: 2 jobs simultáneos
- Límite: 5 jobs por minuto
- Delay entre jobs encolados: 30-60 segundos

### 4.7 Onboarding Magico con IA (`packages/web/src/app/dashboard/clients/new/`)

Wizard de 4 pasos para crear clientes con configuracion automatica:

```
┌────────────────────────────────────────────────────────────────┐
│                    ONBOARDING WIZARD FLOW                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   PASO 1: INFO BASICA                                          │
│   ┌────────────────────────────────────────┐                   │
│   │ Input: nombre, descripcion, industria  │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   PASO 2: BUSQUEDA DE NOTICIAS                                 │
│   ┌────────────────────────────────────────┐                   │
│   │ clients.searchNews()                   │                   │
│   │ - Busca articulos del ultimo mes       │                   │
│   │ - Filtra por nombre del cliente        │                   │
│   │ - Retorna hasta 50 resultados          │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ clients.generateOnboardingConfig()     │                   │
│   │ - Envia articulos a Claude             │                   │
│   │ - Genera keywords sugeridos            │                   │
│   │ - Identifica competidores              │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   PASO 3: REVISION Y SELECCION                                 │
│   ┌────────────────────────────────────────┐                   │
│   │ Usuario revisa y edita:                │                   │
│   │ - Keywords sugeridos                   │                   │
│   │ - Articulos a importar                 │                   │
│   │ - Puede agregar keywords manuales      │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   PASO 4: CREACION                                             │
│   ┌────────────────────────────────────────┐                   │
│   │ clients.createWithOnboarding()         │                   │
│   │ - Crea cliente en DB                   │                   │
│   │ - Crea keywords seleccionados          │                   │
│   │ - Crea menciones de articulos          │                   │
│   └────────────────────────────────────────┘                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Flujo de Carga de Configuracion

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  App Start    │────▶│  Load .env    │────▶│  config.ts    │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                    │
                      ┌─────────────────────────────┘
                      │
                      ▼
              ┌───────────────────────────────────────────────┐
              │                 Runtime                        │
              ├───────────────────────────────────────────────┤
              │                                               │
              │   getSettingValue("key", default)             │
              │         │                                     │
              │         ▼                                     │
              │   ┌─────────────┐    Cache    ┌────────────┐ │
              │   │ Check cache │────Hit─────▶│Return value│ │
              │   └──────┬──────┘             └────────────┘ │
              │          │ Miss                               │
              │          ▼                                    │
              │   ┌─────────────┐                             │
              │   │ Query DB    │                             │
              │   └──────┬──────┘                             │
              │          │                                    │
              │          ▼                                    │
              │   ┌─────────────┐                             │
              │   │Update cache │                             │
              │   │ (TTL 60s)   │                             │
              │   └──────┬──────┘                             │
              │          │                                    │
              │          ▼                                    │
              │   ┌────────────┐                              │
              │   │Return value│                              │
              │   └────────────┘                              │
              │                                               │
              └───────────────────────────────────────────────┘
```

### Categorias de Settings

| Categoria | Descripcion | Keys |
|-----------|-------------|------|
| `analysis` | Analisis AI | `prefilter.*`, `urgency.*` |
| `notifications` | Notificaciones | `digest.*` |
| `ui` | Interfaz | `mentions.*`, `dashboard.*` |
| `crisis` | Deteccion de crisis | `crisis.*` |

## Deteccion de Crisis

El sistema detecta automaticamente situaciones de crisis mediaticas.

### Flujo de Deteccion

```
┌────────────────────────────────────────────────────────────────┐
│                    CRISIS DETECTION                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐                                           │
│   │ Mention with   │                                           │
│   │ NEGATIVE       │                                           │
│   │ sentiment      │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ processMentionForCrisis(mentionId)     │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ checkForCrisis(clientId)               │                   │
│   │                                        │                   │
│   │ - Get threshold from settings (3)      │                   │
│   │ - Get window from settings (60 min)    │                   │
│   │ - Count negative mentions in window    │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌─────────────────┐    No    ┌─────────────────┐            │
│   │ Count >= thresh?│─────────▶│ Return (no-op)  │            │
│   └───────┬─────────┘          └─────────────────┘            │
│           │ Yes                                                │
│           ▼                                                    │
│   ┌─────────────────┐    Yes   ┌─────────────────┐            │
│   │ Active crisis   │─────────▶│ Update count    │            │
│   │ exists?         │          └─────────────────┘            │
│   └───────┬─────────┘                                          │
│           │ No                                                 │
│           ▼                                                    │
│   ┌─────────────────────────────────────────┐                  │
│   │ createCrisisAlert()                     │                  │
│   │                                         │                  │
│   │ - Determine severity (CRITICAL/HIGH/MED)│                  │
│   │ - Save to DB                            │                  │
│   │ - Enqueue NOTIFY_CRISIS job             │                  │
│   └─────────────────────────────────────────┘                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Severidad de Crisis

| Condicion | Severidad |
|-----------|-----------|
| `count >= threshold * 3` | CRITICAL |
| `count >= threshold * 2` | HIGH |
| `count >= threshold` | MEDIUM |

### Protección contra Falsas Crisis (publishedAt)

El filtro de 30 días en `analysis/worker.ts` previene falsas alertas de crisis:
- Si `publishedAt` > 30 días, se omite la llamada a `processMentionForCrisis()`
- Esto evita que artículos negativos antiguos (recién descubiertos por grounding o colectores) sumen al conteo de negativos en la ventana de crisis
- Sin este filtro, un lote de artículos viejos negativos podría superar el threshold y crear una CrisisAlert espuria

### Acciones Disponibles

- **Ver menciones**: Navegar a lista de menciones del cliente
- **Marcar resuelta**: Cambiar estado a RESOLVED
- **Monitorear**: Cambiar estado a MONITORING
- **Descartar**: Cambiar estado a DISMISSED

## Topic Threads (Sprint 19)

### Arquitectura: Menciones → TopicThread → Notificaciones por tema

```
┌────────────────────────────────────────────────────────────────┐
│                    TOPIC THREAD FLOW                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐     ┌────────────────┐                    │
│   │ Mention        │     │ SocialMention  │                    │
│   │ (con topic)    │     │ (con topic)    │                    │
│   └───────┬────────┘     └───────┬────────┘                    │
│           │                      │                             │
│           └──────────┬───────────┘                             │
│                      │                                         │
│                      ▼                                         │
│   ┌────────────────────────────────────────┐                   │
│   │ assignMentionToThread()               │                   │
│   │                                        │                   │
│   │ 1. Normalizar nombre (lowercase)       │                   │
│   │ 2. Buscar thread ACTIVE                │                   │
│   │    (clientId + normalizedName)         │                   │
│   │ 3. Si existe → update stats, vincular  │                   │
│   │ 4. Si no → buscar CLOSED reciente 72h  │                   │
│   │    → reabrir o crear nuevo             │                   │
│   │ 5. Verificar eventos notificables      │                   │
│   └───────┬────────────────────────────────┘                   │
│           │                                                    │
│           ▼                                                    │
│   ┌─────────────────────────────────────────┐                  │
│   │ Eventos notificables:                   │                  │
│   │                                         │                  │
│   │ TOPIC_NEW:     mentionCount == 2        │                  │
│   │   → NOTIFY_TOPIC (max 10/día/cliente)   │                  │
│   │                                         │                  │
│   │ THRESHOLD:     [5, 10, 20, 50]          │                  │
│   │   → NOTIFY_TOPIC + update reached       │                  │
│   │                                         │                  │
│   │ SENTIMENT_SHIFT: dominante cambió       │                  │
│   │   → NOTIFY_TOPIC (cooldown 4h)          │                  │
│   └─────────────────────────────────────────┘                  │
│                                                                │
│   ┌────────────────┐                                           │
│   │ Cron job       │                                           │
│   │ cada 6 horas   │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ closeInactiveThreads()                │                   │
│   │                                        │                   │
│   │ Cierra threads ACTIVE sin menciones    │                   │
│   │ en las últimas 72 horas                │                   │
│   └────────────────────────────────────────┘                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### NOTIFY_ALERT condicional

```
┌────────────────────────────────────────────────────────────────┐
│           NOTIFICATION ROUTING (Post Sprint 19)                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Mención analizada                                            │
│        │                                                       │
│        ▼                                                       │
│   ¿Tiene topicThreadId?                                        │
│        │                                                       │
│   ┌────┴────┐                                                  │
│   │ Sí      │ No                                               │
│   ▼         ▼                                                  │
│ Topic     NOTIFY_ALERT                                         │
│ thread    individual                                           │
│ maneja    (fallback)                                           │
│ notif                                                          │
│                                                                │
│   Crisis check: SIEMPRE (independiente de topics)              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Real-time Dashboard (Sprint 18)

### Arquitectura: Workers → Redis Pub/Sub → SSE → Browser

```
┌────────────────────────────────────────────────────────────────┐
│                    REAL-TIME EVENT FLOW                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌────────────────┐                                           │
│   │ Worker         │                                           │
│   │ (ingest/       │                                           │
│   │ analysis/      │                                           │
│   │ social/crisis) │                                           │
│   └───────┬────────┘                                           │
│           │                                                    │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ publishRealtimeEvent(channel, data)    │                   │
│   │ (packages/shared/src/                  │                   │
│   │  realtime-publisher.ts)                │                   │
│   └───────┬────────────────────────────────┘                   │
│           │  Redis PUBLISH                                     │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ Redis Pub/Sub                          │                   │
│   │                                        │                   │
│   │ Canales:                               │                   │
│   │ - mediabot:mention:new                 │                   │
│   │ - mediabot:mention:analyzed            │                   │
│   │ - mediabot:social:new                  │                   │
│   │ - mediabot:crisis:new                  │                   │
│   └───────┬────────────────────────────────┘                   │
│           │  Redis SUBSCRIBE                                   │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ SSE Endpoint (/api/events)             │                   │
│   │                                        │                   │
│   │ - Auth via getServerSession            │                   │
│   │ - Filtra por orgId                     │                   │
│   │ - SuperAdmin ve todo                   │                   │
│   │ - Keepalive cada 30s                   │                   │
│   └───────┬────────────────────────────────┘                   │
│           │  Server-Sent Events                                │
│           ▼                                                    │
│   ┌────────────────────────────────────────┐                   │
│   │ Browser (EventSource)                  │                   │
│   │                                        │                   │
│   │ - use-realtime.ts hook                 │                   │
│   │ - Reconnect backoff (1s→30s)           │                   │
│   │ - RealtimeProvider (50 event buffer)   │                   │
│   │                                        │                   │
│   │ Consumers:                             │                   │
│   │ - LiveFeed (últimas 20 menciones)      │                   │
│   │ - Live KPI (deltas incrementales)      │                   │
│   │ - Alert sound (CRITICAL mentions)      │                   │
│   └────────────────────────────────────────┘                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Restricciones de importación

- `realtime-publisher.ts` **NO se exporta** desde `packages/shared/src/index.ts` — importa ioredis que trae Node.js modules incompatibles con Next.js client
- `realtime-types.ts` tiene **copia local** en `packages/web/src/lib/` para que client components (`"use client"`) puedan usarlo sin importar desde `@mediabot/shared`

## API tRPC

### Routers Disponibles (22 total)

| Router | Descripcion | Endpoints |
|--------|-------------|-----------|
| `dashboard` | Metricas principales | `stats`, `recentMentions`, `analytics`, `getSocialDashboardStats`, `getSocialAnalytics` |
| `clients` | Gestion de clientes | `list`, `getById`, `create`, `update`, `delete`, `transferClient`, `addKeyword`, `removeKeyword`, `searchNews`, `generateOnboardingConfig`, `createWithOnboarding`, `executeManualGrounding`, `addRecipient`, `updateRecipient`, `removeRecipient`, `addCompetitor`, `removeCompetitor`, `updateGroundingConfig`, `getGroundingConfig`, `getRecipients`, `compareCompetitors`, `listOrgCompetitors` |
| `mentions` | Consulta de menciones | `list`, `getById`, `generateResponse`, `exportMentions` |
| `tasks` | Gestion de tareas | `list`, `create`, `update` |
| `team` | Gestion de equipo | `list`, `create`, `update` |
| `settings` | Configuracion dinamica | `list`, `get`, `update`, `categories` |
| `intelligence` | Media Intelligence | `getSOV`, `getTopics`, `getWeeklyInsights`, `getSourceTiers`, `getKPIs`, `getActionItems`, `updateActionItem`, `generateReport` |
| `sources` | Gestion de fuentes RSS | `list`, `stats`, `get`, `states`, `create`, `update`, `delete`, `toggleActive`, `resetErrors`, `requestSource`, `listRequests`, `requestStats`, `approveRequest`, `rejectRequest`, `integrateRequest` |
| `social` | Monitoreo redes sociales | `listAllSocialMentions`, `getSocialMentions`, `getGlobalSocialStats`, `getSocialMentionById`, `getSocialTrend`, `getSocialStats`, `getSocialAccounts`, `extractComments`, `suggestHashtags`, `validateHandle`, `addSocialAccount`, `updateSocialAccount`, `removeSocialAccount`, `updateSocialConfig`, `deleteSocialMention`, `deleteSocialMentions`, `exportSocialMentions`, `triggerCollection` |
| `notifications` | Notificaciones in-app | `list`, `getById`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `delete`, `deleteAllRead` |
| `organizations` | Gestion multi-tenant | `list`, `getById`, `globalStats`, `listForSelector`, `create`, `update`, `delete`, `reassignClient`, `createUserInOrg` |
| `onboarding` | Tour de onboarding | `getStatus`, `updateStatus`, `reset`, `resetForUser` |
| `crisis` | Gestion de crisis | `list`, `getById`, `updateStatus`, `addNote`, `assignResponsible`, `getActiveCrisisCount` |
| `responses` | Workflow de comunicados | `list`, `getById`, `create`, `update`, `updateStatus`, `regenerate` |
| `alertRules` | Reglas de alerta | `list`, `getById`, `create`, `update`, `delete`, `toggle` |
| `briefs` | AI Media Briefs | `list`, `getById`, `getLatest` |
| `campaigns` | Tracking de campañas | `list`, `getById`, `create`, `update`, `delete`, `addNote`, `addMentions`, `removeMention`, `addSocialMentions`, `removeSocialMention`, `autoLinkMentions`, `getStats`, `getMentions` |
| `executive` | Dashboard ejecutivo (Super Admin) | `globalKPIs`, `orgCards`, `clientHealthScores`, `inactivityAlerts`, `activityHeatmap` |
| `reports` | Reportes PDF + links compartidos | `generateCampaignPDF`, `generateBriefPDF`, `generateClientPDF`, `createSharedLink`, `getSharedReport` |
| `search` | Búsqueda global (Cmd+K) | `globalSearch` |
| `topics` | Topic threads (agrupación por tema) | `list`, `getById`, `getMentions`, `getEvents`, `getStats`, `archive`, `getNegativeCount` |

## Patrón de Colores Dark Mode

El sistema usa un patrón consistente de colores para dark mode:

| Elemento | Light Mode | Dark Mode |
|----------|------------|-----------|
| Card background | `bg-white` | `dark:bg-gray-800` |
| Card border | `border-gray-100/200` | `dark:border-gray-700` |
| Title text | `text-gray-900` | `dark:text-white` |
| Body text | `text-gray-600` | `dark:text-gray-300` |
| Muted text | `text-gray-500` | `dark:text-gray-400` |
| Input background | `bg-white` | `dark:bg-gray-700` |
| Input border | `border-gray-300` | `dark:border-gray-600` |
| Badge background | `bg-{color}-100` | `dark:bg-{color}-900/30` |
| Badge text | `text-{color}-700/800` | `dark:text-{color}-400` |

### Proteccion de Endpoints

- **protectedProcedure**: Requiere autenticacion (cualquier rol)
- **adminProcedure**: Requiere autenticacion + rol ADMIN

### Ejemplo de Uso (settings)

```typescript
// Listar settings por categoria
const { data } = trpc.settings.list.useQuery({ category: "analysis" });

// Actualizar un setting (ADMIN only)
trpc.settings.update.mutate({ key: "prefilter.confidence_threshold", value: "0.7" });

// Resetear a valor default (ADMIN only)
trpc.settings.reset.mutate({ key: "prefilter.confidence_threshold" });
```
