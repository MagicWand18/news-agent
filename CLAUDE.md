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
│   ├── web/          # Next.js frontend + tRPC API (16 dashboard pages, 16 routers)
│   ├── workers/      # Background jobs (5 collectors, 20+ workers, 24 colas)
│   ├── bot/          # Telegram bot (Grammy)
│   └── shared/       # Shared code (prisma, config, types, ai-client)
├── prisma/           # Database schema (26 models, 19 enums)
├── deploy/           # Deployment scripts
├── docs/             # Documentation (architecture, plan, guides)
└── tests/            # Test files
    └── e2e/          # End-to-end tests (Playwright)
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database models |
| `packages/web/src/server/routers/` | tRPC API endpoints |
| `packages/web/src/app/dashboard/` | Dashboard pages |
| `packages/web/src/components/platform-icons.tsx` | Iconos SVG compartidos de plataformas sociales |
| `packages/web/src/components/social-mention-row.tsx` | Componente de fila de mencion social (con checkbox para bulk select) |
| `packages/workers/src/queues.ts` | Job queues and cron schedules (24 colas) |
| `packages/workers/src/collectors/social.ts` | Social media collector (EnsembleData) |
| `packages/web/src/server/routers/social.ts` | Social media monitoring API (18 endpoints, incl. generateResponse) |
| `packages/web/src/server/routers/crisis.ts` | Crisis management API (6 endpoints) |
| `packages/web/src/server/routers/responses.ts` | Response draft workflow API (6 endpoints) |
| `packages/web/src/server/routers/alertRules.ts` | Alert rules CRUD API (6 endpoints) |
| `packages/web/src/server/routers/organizations.ts` | Multi-tenant organization management |
| `packages/workers/src/workers/alert-rules-worker.ts` | Alert rule evaluation - 6 types (cron */30) |
| `packages/workers/src/analysis/crisis-detector.ts` | Auto crisis detection on negative spikes |
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
```

## Testing

### E2E Test Scripts

| Script | Purpose |
|--------|---------|
| `tests/e2e/test_mediabot_full.py` | Full regression - navigates ALL pages, discovers elements |
| `tests/e2e/test_sprint14.py` | Sprint 14 features: alert rules, intelligence timeline, social detail, responses, crisis |
| `tests/e2e/test_sprint14_social.py` | Social mention detail with super admin account |

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
