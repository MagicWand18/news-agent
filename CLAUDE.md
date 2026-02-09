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
│   ├── web/          # Next.js frontend + tRPC API (17 dashboard pages)
│   ├── workers/      # Background jobs (5 collectors, analysis, notifications, social)
│   ├── bot/          # Telegram bot (Grammy)
│   └── shared/       # Shared code (prisma, config, types, ai-client)
├── prisma/           # Database schema (20 models)
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
| `packages/workers/src/queues.ts` | Job queues and cron schedules (19+ colas) |
| `packages/workers/src/collectors/social.ts` | Social media collector (EnsembleData) |
| `deploy/remote-deploy.sh` | Production deployment script |

## Commands

```bash
# Development
npm run dev                    # Start all packages in dev mode

# Build
npm run build                  # Build all packages

# Database
npx prisma generate           # Generate Prisma client
npx prisma db push            # Push schema to database

# Deploy to production
bash deploy/remote-deploy.sh  # Deploy to DigitalOcean droplet
FORCE_DEPLOY=1 bash deploy/remote-deploy.sh  # Force rebuild

# Check production logs
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml logs -f"
```

## Testing

### E2E Test Script

**Location**: `tests/e2e/test_mediabot_full.py`

A comprehensive Playwright test that:
- Logs into the application
- Navigates through ALL menu pages
- Takes screenshots of each page
- Discovers and reports all buttons, links, and inputs
- Tests client detail and mention detail pages

**Usage**:
```bash
python3 tests/e2e/test_mediabot_full.py
```

**Configuration** (edit in script):
- `BASE_URL`: Target server (default: http://159.65.97.78:3000)
- `EMAIL/PASSWORD`: Login credentials
- `SCREENSHOT_DIR`: Where to save screenshots

**Output**:
- Screenshots saved to `screenshots/e2e/`
- Console summary of all pages and elements found

**Use this script after deployments to verify the UI is working correctly.**

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
