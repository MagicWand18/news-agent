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
| `rss.ts` | RSS Feeds | 10 min | 9 medios mexicanos e internacionales |
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

### 4.2 Generacion de Respuesta (`packages/web/src/server/routers/mentions.ts`)

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
├── web/                 # Dashboard Next.js
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
| `clients` | Gestion de clientes | `list`, `getById`, `create`, `update`, `addKeyword`, `removeKeyword` |
| `mentions` | Consulta de menciones | `list`, `getById`, `generateResponse` |
| `tasks` | Gestion de tareas | `list`, `create`, `update` |
| `team` | Gestion de equipo | `list`, `create`, `update` |
| `settings` | Configuracion dinamica | `list`, `get`, `update`, `reset`, `seedDefaults` |

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
