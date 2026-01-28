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
