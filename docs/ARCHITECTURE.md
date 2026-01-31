# Arquitectura de MediaBot

## Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FUENTES DE DATOS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                       │
│   │   RSS   │  │NewsData │  │  GDELT  │  │ Google  │                       │
│   │ 9 feeds │  │   API   │  │   API   │  │   CSE   │                       │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                       │
│        │            │            │            │                             │
│        └────────────┴─────┬──────┴────────────┘                             │
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
| `newsdata.ts` | NewsData.io | 30 min | API de noticias con filtro pais |
| `gdelt.ts` | GDELT | 15 min | Base de datos global de eventos |
| `google.ts` | Google CSE | 2 horas | Busqueda personalizada |

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

### 5. Notificaciones (`packages/workers/src/notifications/`)

**Alertas inmediatas:**
- Menciones con `urgency` HIGH o CRITICAL
- Se envian via Telegram al grupo del cliente

**Digest diario:**
- Se ejecuta a las 8:00 AM
- Resumen de todas las menciones del dia anterior
- Agrupadas por cliente

## Modelo de Datos

```
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│  Organization  │──1:N─▶│     Client     │──1:N─▶│    Keyword     │
└────────────────┘       └───────┬────────┘       └────────────────┘
        │                        │
        │                        │ 1:N
        ▼                        ▼
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│      User      │       │    Mention     │◀──N:1─│    Article     │
└────────┬───────┘       └───────┬────────┘       └────────────────┘
         │                       │
         │                       │ 1:N
         │                       ▼
         └──────────────▶┌────────────────┐
                         │      Task      │
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
| `Mention` | Match de articulo con cliente |
| `Task` | Tarea asignada a usuario para seguimiento |
| `EmergingTopicNotification` | Registro de notificaciones de temas emergentes |
| `RssSource` | Fuente RSS configurable (300+ medios mexicanos) |
| `SourceRequest` | Solicitud de inclusion de nueva fuente |

## Sistema de Colas (BullMQ)

```
┌─────────────────────────────────────────────────────────────────┐
│                         REDIS / BULLMQ                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SCHEDULED JOBS (Cron patterns)                                │
│   ─────────────────────────────                                 │
│   collect-rss      : */10 * * * *  (cada 10 min)                │
│   collect-newsdata : */30 * * * *  (cada 30 min)                │
│   collect-gdelt    : */15 * * * *  (cada 15 min)                │
│   collect-google   : 0 */2 * * *   (cada 2 horas)               │
│   daily-digest     : 0 8 * * *     (8:00 AM diario)             │
│                                                                 │
│   ON-DEMAND QUEUES                                              │
│   ────────────────                                              │
│   ingest-article   : Procesar articulo individual               │
│   analyze-mention  : Analizar mencion con AI                    │
│   notify-alert     : Enviar alerta Telegram                     │
│   onboarding       : Generar keywords iniciales para cliente    │
│   extract-topic    : Extraer tema de mencion con AI             │
│   weekly-insights  : Generar insights semanales (Lun 6:00 AM)   │
│   emerging-topics  : Detectar temas emergentes (cada 4h)        │
│   notify-emerging  : Notificar tema emergente via Telegram      │
│   grounding-check  : Verificar menciones bajas (7:00 AM)        │
│   grounding-weekly : Grounding semanal programado (6:00 AM)     │
│   grounding-execute: Ejecutar búsqueda con Gemini               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

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

### Acciones Disponibles

- **Ver menciones**: Navegar a lista de menciones del cliente
- **Marcar resuelta**: Cambiar estado a RESOLVED
- **Monitorear**: Cambiar estado a MONITORING
- **Descartar**: Cambiar estado a DISMISSED

## API tRPC

### Routers Disponibles

| Router | Descripcion | Endpoints |
|--------|-------------|-----------|
| `dashboard` | Metricas principales | `stats`, `recentMentions` |
| `clients` | Gestion de clientes | `list`, `getById`, `create`, `update`, `addKeyword`, `removeKeyword`, `searchNews`, `generateOnboardingConfig`, `createWithOnboarding` |
| `mentions` | Consulta de menciones | `list`, `getById`, `generateResponse` |
| `tasks` | Gestion de tareas | `list`, `create`, `update` |
| `team` | Gestion de equipo | `list`, `create`, `update` |
| `settings` | Configuracion dinamica | `list`, `get`, `update`, `reset`, `seedDefaults` |
| `intelligence` | Media Intelligence | `getSOV`, `getTopics`, `getWeeklyInsights`, `getSourceTiers`, `getKPIs` |
| `sources` | Gestion de fuentes RSS | `list`, `stats`, `create`, `update`, `delete`, `requestSource`, `listRequests`, `approveRequest`, `rejectRequest`, `integrateRequest` |

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
