# ── Stage 1: Base with dependencies ──────────────────
FROM node:20-slim AS base
RUN apt-get update -qq && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot/package.json packages/bot/
COPY packages/workers/package.json packages/workers/
COPY packages/web/package.json packages/web/
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate --schema=prisma/schema.prisma

# ── Stage 2: Build web (Next.js) ────────────────────
FROM base AS web-builder
# Dummy env vars for Next.js build-time page data collection (real values come from .env at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    TELEGRAM_BOT_TOKEN="build-placeholder" \
    ANTHROPIC_API_KEY="build-placeholder" \
    NEXTAUTH_SECRET="build-placeholder" \
    NEXTAUTH_URL="http://localhost:3000"
RUN npm run build -w packages/web

# ── Stage 3: Web runtime ────────────────────────────
FROM node:20-slim AS web
RUN apt-get update -qq && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=web-builder /app/packages/web/.next ./packages/web/.next
COPY --from=web-builder /app/packages/web/next.config.js ./packages/web/
COPY --from=web-builder /app/packages/web/package.json ./packages/web/
COPY --from=web-builder /app/packages/shared ./packages/shared
COPY --from=web-builder /app/package.json ./
COPY --from=web-builder /app/prisma ./prisma
# Copy public dir if it exists (may be empty)
COPY --from=web-builder /app/packages/web/public ./packages/web/public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "packages/web"]

# ── Stage 4: Workers runtime ────────────────────────
FROM base AS workers
RUN apt-get update -qq && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
CMD ["npx", "tsx", "packages/workers/src/index.ts"]

# ── Stage 5: Bot runtime ────────────────────────────
FROM base AS bot
ENV NODE_ENV=production
CMD ["npx", "tsx", "packages/bot/src/index.ts"]
