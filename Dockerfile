# ── Stage 1: Base with dependencies ──────────────────
FROM node:20-alpine AS base
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
RUN npm run build -w packages/web

# ── Stage 3: Web runtime ────────────────────────────
FROM node:20-alpine AS web
WORKDIR /app
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/packages/web/.next ./packages/web/.next
COPY --from=web-builder /app/packages/web/public ./packages/web/public
COPY --from=web-builder /app/packages/web/next.config.js ./packages/web/
COPY --from=web-builder /app/packages/web/package.json ./packages/web/
COPY --from=web-builder /app/packages/shared ./packages/shared
COPY --from=web-builder /app/package.json ./
COPY --from=web-builder /app/prisma ./prisma
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "packages/web"]

# ── Stage 4: Workers runtime ────────────────────────
FROM base AS workers
ENV NODE_ENV=production
CMD ["npx", "tsx", "packages/workers/src/index.ts"]

# ── Stage 5: Bot runtime ────────────────────────────
FROM base AS bot
ENV NODE_ENV=production
CMD ["npx", "tsx", "packages/bot/src/index.ts"]
