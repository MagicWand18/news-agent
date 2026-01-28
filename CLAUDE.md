# MediaBot - Project Documentation for Claude

## Project Overview

MediaBot is a media monitoring platform for PR agencies. It monitors news sources, detects mentions of clients, analyzes sentiment using AI, and sends alerts via Telegram.

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS, Recharts, tRPC
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
│   ├── web/          # Next.js frontend + tRPC API
│   ├── workers/      # Background jobs (collectors, analysis, notifications)
│   ├── bot/          # Telegram bot
│   └── shared/       # Shared code (prisma, config, types)
├── prisma/           # Database schema
├── deploy/           # Deployment scripts
└── tests/            # Test files
    └── e2e/          # End-to-end tests
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database models |
| `packages/web/src/server/routers/` | tRPC API endpoints |
| `packages/web/src/app/dashboard/` | Dashboard pages |
| `packages/web/src/components/filters/` | Reusable filter components |
| `packages/workers/src/queues.ts` | Job queues and cron schedules |
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
- Tests new filter components (Sprint 5)

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
- **Default login**: admin@mediabot.local / admin123

## Database Access (Production)

```bash
# List tables
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres psql -U mediabot -c '\\dt'"

# Run query
ssh -i ~/.ssh/newsaibot-telegram-ssh root@159.65.97.78 \
  "cd /opt/mediabot && docker compose -f docker-compose.prod.yml exec -T postgres psql -U mediabot -c 'SELECT COUNT(*) FROM \"Mention\"'"
```

## Recent Features (Sprint 5)

1. **Timeline de Menciones** (`/dashboard`)
   - Visual timeline style social feed
   - Animated entry with staggered fadeInUp
   - Sentiment-colored left border on cards
   - Source initial avatar

2. **CountUp Animations** (KPI Cards)
   - Animated number counting with easeOutExpo
   - Respects `prefers-reduced-motion`
   - `animate` prop on StatCard component

3. **Global Filter System** (`components/filters/`)
   - `FilterBar` - Container with "Clear all" button
   - `FilterSelect` - Styled select with icon and multi-select support
   - `FilterDateRange` - Date range with presets (Today, 7d, 30d, 90d)
   - `FilterChips` - Removable badges for active filters

4. **Enhanced Page Filters**:
   - `/dashboard/mentions`: urgency, source, date range filters
   - `/dashboard/analytics`: multi-select sentiment/urgency filters
   - `/dashboard/clients`: industry, status (active/inactive) filters

## Previous Features (Sprint 4)

1. **Analytics Dashboard** (`/dashboard/analytics`)
   - Mentions by day chart
   - Sentiment trend by week
   - Urgency distribution pie chart
   - Top sources and keywords bar charts

2. **Weekly PDF Reports** (`packages/workers/src/reports/`)
   - Generates PDF reports with executive summary
   - Sends via Telegram every Sunday 8pm
   - Configurable via `WEEKLY_REPORT_CRON` env var

3. **Competitor Analysis** (`/dashboard/clients/[id]`)
   - Compare client mentions vs competitors
   - Add keywords with type "COMPETITOR" to enable

## Component Library

### Filter Components

```typescript
// Import all filters
import { FilterBar, FilterSelect, FilterDateRange, FilterChips } from "@/components/filters";

// Usage example
<FilterBar activeCount={3} onClear={handleClear}>
  <FilterSelect
    label="Cliente"
    value={clientId}
    options={clientOptions}
    onChange={setClientId}
    placeholder="Todos"
    icon={<Users className="h-4 w-4" />}
  />
  <FilterSelect
    label="Sentimiento"
    value={selectedSentiments}
    options={sentimentOptions}
    onMultiChange={setSelectedSentiments}
    multiple
  />
  <FilterDateRange
    startDate={startDate}
    endDate={endDate}
    onChange={(start, end) => setDates(start, end)}
  />
</FilterBar>
<FilterChips chips={activeChips} onRemove={handleRemove} />
```

### StatCard with Animation

```typescript
<StatCard
  title="Menciones (24h)"
  value={stats.mentions24h}
  icon={<Newspaper className="h-6 w-6" />}
  animate  // Enable CountUp animation
/>
```
