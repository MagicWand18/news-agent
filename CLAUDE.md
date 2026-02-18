# MediaBot - Project Documentation for Claude

## Project Overview

MediaBot is a media monitoring platform for PR agencies. It monitors news sources, detects mentions of clients, analyzes sentiment using AI, and sends alerts via Telegram.

## Tech Stack

- **Frontend**: Next.js 15, React, TailwindCSS, Recharts, tRPC
- **Backend**: Node.js, tRPC, Prisma ORM
- **Database**: PostgreSQL
- **Queue**: Redis + BullMQ
- **AI**: Anthropic Claude API
- **Notifications**: Telegram Bot (grammy)
- **Deployment**: Docker Compose on DigitalOcean

## Project Structure

```
/
├── packages/
│   ├── web/          # Next.js frontend + tRPC API (20 dashboard pages, 21 routers)
│   ├── workers/      # Background jobs (5 collectors, 20+ workers, 28 colas)
│   ├── bot/          # Telegram bot (Grammy)
│   └── shared/       # Shared code (prisma, config, types, ai-client, realtime)
├── prisma/           # Database schema (35 models, 22 enums)
├── deploy/           # Deployment scripts
├── docs/             # Documentation (architecture, plan, guides)
└── tests/            # Test files
    └── e2e/          # End-to-end tests (Playwright)
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database models (Mention.publishedAt denormalized from Article) |
| `packages/web/src/server/routers/` | tRPC API endpoints |
| `packages/web/src/app/dashboard/` | Dashboard pages |
| `packages/web/src/components/platform-icons.tsx` | Iconos SVG compartidos de plataformas sociales |
| `packages/web/src/components/social-mention-row.tsx` | Componente de fila de mencion social (con checkbox para bulk select) |
| `packages/shared/src/telegram-notification-types.ts` | Constantes y tipos de 10 notificaciones Telegram |
| `packages/workers/src/notifications/recipients.ts` | Resolución centralizada de destinatarios Telegram (3 niveles, filtro 30 días) |
| `packages/workers/src/queues.ts` | Job queues and cron schedules (28 colas, auto-refresh cada 30 min) |
| `packages/workers/src/collectors/social.ts` | Social media collector (EnsembleData) |
| `packages/web/src/server/routers/social.ts` | Social media monitoring API (18 endpoints, incl. generateResponse) |
| `packages/web/src/server/routers/crisis.ts` | Crisis management API (6 endpoints) |
| `packages/web/src/server/routers/responses.ts` | Response draft workflow API (6 endpoints) |
| `packages/web/src/server/routers/alertRules.ts` | Alert rules CRUD API (6 endpoints) |
| `packages/web/src/server/routers/briefs.ts` | Daily briefs API (3 endpoints: list, getById, getLatest) |
| `packages/web/src/server/routers/campaigns.ts` | Campaign tracking API (13 endpoints: CRUD, notes, link mentions, auto-link, stats) |
| `packages/web/src/server/routers/organizations.ts` | Multi-tenant organization management |
| `packages/web/src/server/routers/executive.ts` | Executive dashboard API (5 endpoints, superAdminOnly) |
| `packages/web/src/server/routers/reports.ts` | PDF generation + shared reports API (5 endpoints) |
| `packages/web/src/lib/pdf/` | PDF generators (campaign, brief, client, utils) |
| `packages/web/src/components/export-button.tsx` | Reusable export dropdown (PDF + share link) |
| `packages/workers/src/workers/alert-rules-worker.ts` | Alert rule evaluation - 6 types (cron */30) |
| `packages/workers/src/analysis/crisis-detector.ts` | Auto crisis detection on negative spikes (uses publishedAt/postedAt) |
| `packages/workers/src/analysis/ai.ts` | AI functions (analyze, brief, insights, response, etc.) |
| `packages/workers/src/notifications/digest.ts` | Daily digest worker with AI Media Brief (uses publishedAt/postedAt) |
| `packages/shared/src/realtime-types.ts` | Realtime event types and channels (Redis Pub/Sub) |
| `packages/shared/src/realtime-publisher.ts` | Realtime event publisher (workers-only, not in barrel export) |
| `packages/web/src/lib/realtime-types.ts` | Local copy of realtime types (safe for client-side) |
| `packages/web/src/app/api/events/route.ts` | SSE endpoint (Redis Sub → EventSource) |
| `packages/web/src/hooks/use-realtime.ts` | SSE client hook with reconnection |
| `packages/web/src/components/realtime-provider.tsx` | Realtime React context provider |
| `packages/web/src/components/live-feed.tsx` | Live mention feed (subscribes to mention:analyzed) |
| `packages/web/src/hooks/use-live-kpi.ts` | Live KPI delta counters |
| `packages/web/src/hooks/use-notification-sound.ts` | CRITICAL mention alert sound |
| `packages/web/src/components/skeletons.tsx` | Reusable skeleton loading components |
| `packages/web/src/hooks/use-keyboard-shortcuts.ts` | Keyboard shortcuts (single key + sequences) |
| `packages/web/src/components/keyboard-shortcuts-dialog.tsx` | Shortcuts help dialog (?) |
| `packages/web/src/components/command-palette.tsx` | Command palette Cmd+K (cmdk) |
| `packages/web/src/server/routers/search.ts` | Global search API (clients, mentions, social) |
| `deploy/remote-deploy.sh` | Production deployment script |

## Social Media Features

- **Plataformas activas**: Instagram, TikTok, YouTube (Twitter oculto del UI pero soportado para datos existentes)
- **Paginas**: `/dashboard/social-mentions` (lista global con paginacion infinita, bulk select/delete/export), `/dashboard/social-mentions/[id]` (detalle con delete individual)
- **Backend mutations**: `deleteSocialMention` (individual), `deleteSocialMentions` (bulk hasta 100)
- **Componentes compartidos**: `platform-icons.tsx` (SVG icons), `social-mention-row.tsx` (fila con checkbox)

## Action Pipeline (Sprint 13 + 14)

- **Páginas**: `/dashboard/crisis` (lista), `/dashboard/crisis/[id]` (detalle con timeline/notas), `/dashboard/responses` (workflow de comunicados), `/dashboard/alert-rules` (CRUD reglas de alerta)
- **Modelos**: ResponseDraft (workflow DRAFT→PUBLISHED), CrisisNote, ActionItem, AlertRule (6 tipos)
- **Workers**: `alert-rules-worker.ts` (evalúa 6 tipos de reglas cada 30 min), `insights-worker.ts` (crea ActionItems)
- **Alert Rules**: NEGATIVE_SPIKE, VOLUME_SURGE, NO_MENTIONS, SOV_DROP, COMPETITOR_SPIKE, SENTIMENT_SHIFT
- **Crisis**: Auto-detección en `crisis-detector.ts`, UI de gestión con notas y asignación
- **Respuestas**: Generación con Gemini desde menciones y menciones sociales, workflow de aprobación (solo ADMIN/SUPERVISOR aprueban)
- **Social Mentions Detail**: Botón "Generar comunicado" crea ResponseDraft vinculado, sección de borradores vinculados
- **Intelligence**: Timeline de insights con paginación infinita, cards expandibles, action items vinculados, sección "Temas Principales"
- **Sidebar**: Badge de crisis activas, items "Crisis", "Respuestas" y "Reglas de Alerta"

## Campaign Tracking (Sprint 16)

- **Modelos**: Campaign (con CampaignStatus enum + crisisAlertId linkage), CampaignMention, CampaignSocialMention, CampaignNote
- **Router**: `campaigns.ts` (13 endpoints: list, getById, create, update, delete, addNote, addMentions, removeMention, addSocialMentions, removeSocialMention, autoLinkMentions, getStats, getMentions/getSocialMentions)
- **Paginas**: `/dashboard/campaigns` (lista con filtros cliente/status, modal crear/editar), `/dashboard/campaigns/[id]` (detalle con stats, comparativa pre-campaña, menciones vinculadas, notas timeline)
- **Auto-vincular**: Vincula automaticamente menciones del cliente dentro del rango de fechas de la campana
- **Comparativa pre-campana**: Calcula metricas del mismo periodo antes del inicio vs durante la campana (delta %)
- **Crisis linkage**: Campana puede vincularse opcionalmente a un CrisisAlert para medir respuesta a crisis
- **Sidebar**: Item "Campanas" con icono Target

## AI Media Brief (Sprint 15)

- **Modelo**: `DailyBrief` (clientId, date, content JSON, stats JSON) con unique constraint clientId+date
- **AI Function**: `generateDailyBrief()` en `ai.ts` — genera highlights, comparativa vs ayer, watchList, temas emergentes, acciones
- **Digest Worker**: Integrado en `digest.ts` — recopila datos adicionales (menciones ayer, SOV, crisis, action items, temas emergentes), genera brief, persiste en DB, agrega seccion al Telegram
- **Router**: `briefs.ts` (list con cursor pagination, getById, getLatest)
- **Pagina**: `/dashboard/briefs` — card destacada del ultimo brief + timeline colapsable con infinite scroll
- **Intelligence**: Seccion "Ultimo Brief" con highlights + watchList + link a `/dashboard/briefs`
- **Sidebar**: Item "Media Brief" con icono FileText entre Intelligence y Crisis

## Telegram Notification System

- **3 niveles de destinatarios**: Cliente (TelegramRecipient), Organización (OrgTelegramRecipient), SuperAdmin (User.telegramUserId)
- **10 tipos de notificación**: MENTION_ALERT, CRISIS_ALERT, EMERGING_TOPIC, DAILY_DIGEST, ALERT_RULE, CRISIS_STATUS, RESPONSE_DRAFT, BRIEF_READY, CAMPAIGN_REPORT, WEEKLY_REPORT
- **Resolución centralizada**: `packages/workers/src/notifications/recipients.ts` — `getAllRecipientsForClient()` consolida 3 niveles, deduplica, filtra por preferencias
- **Cola genérica**: `NOTIFY_TELEGRAM` para disparar notificaciones desde cualquier parte del sistema
- **Preferencias**: Campo `preferences` JSON en OrgTelegramRecipient y `telegramNotifPrefs` JSON en User — null = todo ON
- **Constantes compartidas**: `packages/shared/src/telegram-notification-types.ts`
- **UI Settings**: Sección Telegram para SuperAdmin con campo Telegram ID + 10 toggles
- **UI Agencia**: Sección "Destinatarios Telegram por defecto" con CRUD + toggles por recipient
- **Bot**: Comando `/vincular_org <nombre_org>` para vincular grupo/chat a toda una organización
- **Router endpoints**: 4 en organizations.ts (listOrgTelegramRecipients, addOrgTelegramRecipient, updateOrgRecipientPreferences, removeOrgTelegramRecipient), 3 en settings.ts (getTelegramPrefs, updateTelegramPrefs, updateTelegramId)
- **Filtro 30 días**: Notificaciones omiten menciones con publishedAt > 30 días y social mentions con postedAt > 30 días para evitar spam de artículos antiguos recopilados recientemente

## Executive Dashboard + Exportable Reports (Sprint 17)

- **Modelos nuevos**: SharedReport (publicId, type, data JSON, expiresAt), ReportType enum (CAMPAIGN, BRIEF, CLIENT_SUMMARY) — 35 modelos, 22 enums total
- **Router executive.ts** (5 endpoints, superAdminProcedure): globalKPIs (con deltas %), orgCards (resumen por org), clientHealthScores (0-100 con 6 componentes ponderados), inactivityAlerts (clientes sin actividad), activityHeatmap (7x24 grid)
- **Router reports.ts** (5 endpoints): generateCampaignPDF, generateBriefPDF, generateClientPDF (retornan base64 data URL), createSharedLink (crea URL publica con expiracion 7d), getSharedReport (publicProcedure sin auth)
- **Pagina** `/dashboard/executive`: KPI cards con deltas, selector periodo (7d/14d/30d), org cards grid, health score ranking table, activity heatmap (CSS grid), inactivity alerts
- **Componentes**: `executive/org-card.tsx`, `executive/health-score-table.tsx`, `executive/activity-heatmap.tsx`, `export-button.tsx` (dropdown PDF + share link)
- **Pagina publica** `/shared/[id]`: Renderiza reporte compartido sin auth, handles expired/not_found
- **PDF generators**: `packages/web/src/lib/pdf/` (campaign-pdf, brief-pdf, client-pdf, pdf-utils) con PDFKit
- **ExportButton integrado en**: campaigns/[id], briefs, clients/[id]
- **Sidebar**: Item "Ejecutivo" con icono Crown (superAdminOnly), 20 routers total
- **Health Score formula**: Volume 20%, Sentiment 25%, SOV 15%, CrisisFree 20%, ResponseRate 10%, Engagement 10%

## Collector Fixes & Infrastructure Hardening (Post-Sprint 17)

- **GDELT batching**: Keywords se dividen en batches de 8 (límite no documentado de GDELT ~10-15 terms). Rate limit 6s entre batches. Deduplicación por URL.
- **NewsData free plan fix**: Eliminado parámetro `timeframe` (requiere plan de pago, causaba 422). Sin timeframe retorna últimas 48h por defecto.
- **Redis persistence**: Habilitada persistencia AOF (`appendonly yes`) + RDB snapshots (`save 60 100`, `save 300 1`) en `docker-compose.prod.yml`. Previene pérdida de scheduler keys en restart.
- **BullMQ scheduler auto-refresh**: Schedulers se re-registran cada 30 minutos via `upsertJobScheduler` (idempotente). Si Redis pierde keys, se recrean sin reiniciar workers.
- **publishedAt migration**: Campo `publishedAt` en Mention para lógica temporal (evita crisis falsas por artículos viejos). `SocialMention` usa `postedAt`. Queries raw SQL usan `COALESCE(m."publishedAt", m."createdAt")`.
- **30-day notification filter**: Notificaciones Telegram solo se envían para artículos/posts de los últimos 30 días.
- **Client delete cascade**: Endpoint `clients.delete` ahora maneja 20+ modelos con FK dependencies en orden correcto.
- **Executive heatmap**: Muestra fechas reales (ej: "Lun 10/02") en lugar de solo día de la semana.
- **RSS feeds NL**: 4 feeds verificados agregados para cobertura de Nuevo León.

## publishedAt Migration (Post-Sprint 17)

- **Campo nuevo**: `publishedAt DateTime?` en modelo Mention (denormalizado desde Article.publishedAt)
- **Queries temporales**: Todos los queries temporales ahora usan `publishedAt` (Mention) y `postedAt` (SocialMention) en lugar de `createdAt`
- **Backward compatibility**: Raw SQL usa `COALESCE("publishedAt", "createdAt")` para menciones sin publishedAt
- **21 archivos modificados**: schema, collectors, workers (crisis-detector, alert-rules, insights, digest), web routers (dashboard, intelligence, social, executive, campaigns, briefs, reports, clients)
- **Motivación**: Previene falsas alertas de crisis cuando artículos antiguos se recopilan con createdAt reciente
- **Telegram 30-day filter**: Notificaciones omiten menciones/posts con más de 30 días de antigüedad (basado en publishedAt/postedAt)
- **Backfill**: Script SQL para poblar publishedAt desde Article.publishedAt en menciones existentes (ver Commands)

## Commands

```bash
# Development
pnpm dev                       # Start all packages in dev mode

# Build
pnpm build                     # Build all packages

# Database
pnpm exec prisma generate     # Generate Prisma client
pnpm exec prisma db push      # Push schema to database

# Deploy to production
bash deploy/remote-deploy.sh  # Deploy to DigitalOcean droplet
FORCE_DEPLOY=1 bash deploy/remote-deploy.sh  # Force rebuild

# Check production logs
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml logs -f"

# Verify collectors are running
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "docker logs mediabot-workers --tail=30 2>&1 | grep -E 'GDELT|RSS|NewsData|Google|Scheduler'"

# Backfill publishedAt (after schema migration)
ssh root@159.65.97.78 "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres psql -U mediabot -c 'UPDATE \"Mention\" m SET \"publishedAt\" = a.\"publishedAt\" FROM \"Article\" a WHERE m.\"articleId\" = a.id AND m.\"publishedAt\" IS NULL'"
```

## Testing

### E2E Test Scripts

| Script | Purpose |
|--------|---------|
| `tests/e2e/test_mediabot_full.py` | Full regression - navigates ALL pages, discovers elements |
| `tests/e2e/test_sprint14.py` | Sprint 14 features: alert rules, intelligence timeline, social detail, responses, crisis |
| `tests/e2e/test_sprint14_social.py` | Social mention detail with super admin account |
| `tests/e2e/test_sprint15.py` | Sprint 15 features: briefs page, sidebar item, intelligence brief section |
| `tests/e2e/test_sprint16.py` | Sprint 16 features: campaigns page, create campaign, campaign detail, auto-link |
| `tests/e2e/test_sprint17.py` | Sprint 17 features: executive dashboard, KPIs, health scores, export buttons, shared page (19/20 pass) |
| `tests/e2e/test_telegram_notifs.py` | Telegram notifications: settings prefs, agency recipients, toggles (28 tests) |

**Usage**:
```bash
python3 tests/e2e/test_mediabot_full.py        # Full regression
python3 tests/e2e/test_sprint14.py              # Sprint 14 validation
python3 tests/e2e/test_sprint14_social.py       # Social mention detail
```

**Configuration** (edit in script):
- `BASE_URL`: Target server (default: http://159.65.97.78:3000)
- `EMAIL/PASSWORD`: Login credentials
- `SCREENSHOT_DIR`: Where to save screenshots

**Output**:
- Screenshots saved to `screenshots/` subdirectories
- Console summary of all pages and elements found

**Use these scripts after deployments to verify the UI is working correctly.**

## Production Environment

- **Server**: 159.65.97.78 (DigitalOcean)
- **Dashboard**: http://159.65.97.78:3000
- **Super Admin**: admin@example.com / 6lB5/A1NOVFOkOWG (ve todas las organizaciones)
- **Admin Crisalida**: admin@crisalida.com / Cris4lid402 (organización Crisalida)

## Database Access (Production)

```bash
# List tables
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres psql -U mediabot -c '\\dt'"

# Run query
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres psql -U mediabot -c 'SELECT COUNT(*) FROM \"Mention\"'"
```

## Real-time Dashboard + UX Improvements (Sprint 18)

### Arquitectura Real-time: Workers → Redis Pub/Sub → SSE → Browser
- **Publisher** (`packages/shared/src/realtime-publisher.ts`): `publishRealtimeEvent(channel, data)` — fire-and-forget via Redis Pub/Sub
- **4 canales**: `mediabot:mention:new`, `mediabot:mention:analyzed`, `mediabot:social:new`, `mediabot:crisis:new`
- **SSE endpoint** (`/api/events`): Suscribe a Redis, filtra por orgId (SuperAdmin ve todo), envía SSE con keepalive 30s
- **Client hook** (`use-realtime.ts`): EventSource con reconnect exponential backoff (1s→30s max)
- **Provider** (`realtime-provider.tsx`): Context con buffer de 50 eventos, pub/sub subscribe()
- **IMPORTANTE**: realtime-types.ts tiene copia local en `packages/web/src/lib/` (evitar barrel import de shared → BullMQ)
- **IMPORTANTE**: realtime-publisher.ts NO se exporta desde `packages/shared/src/index.ts` (evitar BullMQ en client)

### Live Features
- **LiveFeed** (`live-feed.tsx`): Feed en vivo con últimas 20 menciones analizadas, animación slide-down, badges sentiment/urgency
- **Live KPI** (`use-live-kpi.ts`): Deltas incrementales sumados a stats del dashboard (menciones +N, social +N)
- **Sonido** (`use-notification-sound.ts`): Alerta audio para menciones CRITICAL, toggle en sidebar, persiste en localStorage

### UX Improvements
- **Skeletons** (`skeletons.tsx`): 6 componentes (SkeletonLine, SkeletonBlock, TableSkeleton, ChartSkeleton, CardGridSkeleton, FilterBarSkeleton)
- **13 páginas actualizadas**: Spinners reemplazados con skeletons en mentions, social-mentions, clients, analytics, crisis, responses, intelligence, campaigns, briefs, executive, alert-rules, sources, tasks
- **Keyboard shortcuts** (`use-keyboard-shortcuts.ts`): `Cmd+K` (palette), `?` (help), `g+d/m/s/c/k/i` (navegación), ignora inputs
- **Command palette** (`command-palette.tsx`): cmdk library, búsqueda global (páginas, clientes, menciones, social), 21 routers con search router
- **Search router** (`search.ts`): Busca en Client.name, Mention.aiSummary, SocialMention.content (case-insensitive, filtrado por org)

### Workers modificados (4 archivos)
- `ingest.ts`: Publica `mention:new` después de crear mención (incluye orgId del client)
- `worker.ts`: Publica `mention:analyzed` después del análisis AI (con sentiment/urgency)
- `social.ts`: Publica `social:new` después de crear social mention (orgId propagado via savePosts)
- `crisis-detector.ts`: Publica `crisis:new` después de crear CrisisAlert (lookup orgId)

## Sprints pendientes (backlog en docs/PLAN.md)
- Post-Sprint 17 fixes: Collector hardening, publishedAt migration, client delete -- COMPLETADO
- Sprint 18: Real-time Dashboard + UX Improvements -- COMPLETADO
