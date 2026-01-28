#!/bin/bash
# ===========================================
# MediaBot - Remote Deploy Script
# Run from your local machine after pushing to GitHub
# Usage: bash deploy/remote-deploy.sh
# ===========================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────
DROPLET_IP="${DROPLET_IP:-159.65.97.78}"
DROPLET_USER="${DROPLET_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/newsaibot-telegram-ssh}"
APP_DIR="/opt/mediabot"
REPO_URL="https://github.com/MagicWand18/news-agent.git"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -i ${SSH_KEY}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.production"
FORCE_DEPLOY="${FORCE_DEPLOY:-0}"
# ──────────────────────────────────────────────────────────

echo "=== MediaBot - Remote Deploy ==="
echo "→ Target: ${DROPLET_USER}@${DROPLET_IP}"
echo ""

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "ERROR: SSH key not found: $SSH_KEY"
    exit 1
fi

# Check SSH connectivity
echo "→ Testing SSH connection..."
if ! ssh $SSH_OPTS "${DROPLET_USER}@${DROPLET_IP}" "echo ok" >/dev/null 2>&1; then
    echo "ERROR: Cannot connect to ${DROPLET_USER}@${DROPLET_IP}"
    echo "  - Verify the IP is correct"
    echo "  - Verify your SSH key: $SSH_KEY"
    exit 1
fi
echo "→ Connected."
echo ""

# Upload .env.production to the Droplet as .env
if [ -f "$ENV_FILE" ]; then
    echo "→ Uploading .env.production to server..."
    ssh $SSH_OPTS "${DROPLET_USER}@${DROPLET_IP}" "mkdir -p ${APP_DIR}"
    scp $SSH_OPTS "$ENV_FILE" "${DROPLET_USER}@${DROPLET_IP}:${APP_DIR}/.env"
    echo "→ .env uploaded."
else
    echo "ERROR: .env.production not found at $ENV_FILE"
    exit 1
fi
echo ""

# Execute deploy on the Droplet
echo "→ Starting deploy on server..."
echo ""

ssh $SSH_OPTS "${DROPLET_USER}@${DROPLET_IP}" bash -s "$FORCE_DEPLOY" "$REPO_URL" <<'REMOTE_SCRIPT'
set -euo pipefail

FORCE_DEPLOY="${1:-0}"
REPO_URL="${2}"
APP_DIR="/opt/mediabot"

# ═══════════════════════════════════════════════════════════════
# Helper: Cleanup containers
# ═══════════════════════════════════════════════════════════════
cleanup_containers() {
    echo "  Cleaning up containers..."
    cd "$APP_DIR"
    docker compose -f docker-compose.prod.yml down --remove-orphans --timeout 30 2>/dev/null || true
    for c in mediabot-postgres mediabot-redis mediabot-web mediabot-workers mediabot-bot; do
        docker stop "$c" 2>/dev/null || true
        docker rm -f "$c" 2>/dev/null || true
    done
    docker container prune -f 2>/dev/null || true
    docker network prune -f 2>/dev/null || true
    sleep 2
}

# ═══════════════════════════════════════════════════════════════
# Helper: Start with retry
# ═══════════════════════════════════════════════════════════════
start_containers_with_retry() {
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        echo "  Attempt $attempt of $max_attempts..."
        cleanup_containers

        if docker compose -f docker-compose.prod.yml up -d --force-recreate --remove-orphans 2>&1; then
            echo "  Containers started successfully!"
            return 0
        fi

        echo "  Attempt $attempt failed, retrying..."
        attempt=$((attempt + 1))
        sleep 5
    done

    echo "ERROR: Failed to start containers after $max_attempts attempts"
    return 1
}

# ── [1/7] Install prerequisites ──────────────────────
echo "── [1/7] Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "  Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi
if ! docker compose version &> /dev/null; then
    echo "  Installing Docker Compose plugin..."
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin
fi
if ! command -v git &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq git
fi
echo "  Prerequisites OK."
echo ""

# ── [2/7] Clone or update repo ──────────────────────
echo "── [2/7] Checking for updates..."
if [ ! -d "$APP_DIR/.git" ]; then
    echo "  First deploy - cloning repository..."
    rm -rf "$APP_DIR/docker-compose.prod.yml" "$APP_DIR/Dockerfile" 2>/dev/null || true
    # Save .env before clone
    cp "$APP_DIR/.env" /tmp/mediabot-env-backup 2>/dev/null || true
    git clone "$REPO_URL" "$APP_DIR"
    # Restore .env after clone
    cp /tmp/mediabot-env-backup "$APP_DIR/.env" 2>/dev/null || true
    rm /tmp/mediabot-env-backup 2>/dev/null || true
    cd "$APP_DIR"
    echo "  Cloned at commit: $(git rev-parse --short HEAD)"
else
    cd "$APP_DIR"
    CURRENT_COMMIT=$(git rev-parse HEAD)
    git fetch origin main
    REMOTE_COMMIT=$(git rev-parse origin/main)

    if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ]; then
        if [ "$FORCE_DEPLOY" = "1" ]; then
            echo "  No code changes, FORCE_DEPLOY set - rebuilding..."
        else
            echo "  Already up to date (${CURRENT_COMMIT:0:7})"
            echo ""
            echo "=== No changes to deploy ==="
            echo "  Use: FORCE_DEPLOY=1 bash deploy/remote-deploy.sh"
            exit 0
        fi
    else
        echo "  Updates: ${CURRENT_COMMIT:0:7} -> ${REMOTE_COMMIT:0:7}"
        git reset --hard origin/main
    fi
fi
echo ""

# ── [3/7] Cleanup ────────────────────────────────────
echo "── [3/7] Cleaning up old containers..."
cleanup_containers
echo "  Done."
echo ""

# ── [4/7] Build images ──────────────────────────────
echo "── [4/7] Building Docker images..."
docker compose -f docker-compose.prod.yml build --pull
echo "  Build complete."
echo ""

# ── [5/7] Start containers ──────────────────────────
echo "── [5/7] Starting containers..."
start_containers_with_retry
echo ""

# ── [6/7] Wait for DB and run migrations ────────────
echo "── [6/7] Running database migrations..."
MAX_WAIT=60
WAITED=0
until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U mediabot 2>/dev/null; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "ERROR: Database not ready after ${MAX_WAIT}s"
        docker compose -f docker-compose.prod.yml logs --tail=20 postgres
        exit 1
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    printf "  Waiting for DB... (%ds)\r" "$WAITED"
done
echo "  Database ready.                "

# Push schema to DB
docker compose -f docker-compose.prod.yml exec -T web npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 || {
    echo "  Warning: prisma db push from web failed, trying from workers..."
    docker compose -f docker-compose.prod.yml exec -T workers npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 || true
}

# Run seed (idempotent)
docker compose -f docker-compose.prod.yml exec -T web npx tsx prisma/seed.ts 2>&1 || {
    echo "  Warning: seed from web failed, trying from workers..."
    docker compose -f docker-compose.prod.yml exec -T workers npx tsx prisma/seed.ts 2>&1 || echo "  Seed skipped."
}
echo ""

# ── [7/7] Health check ──────────────────────────────
echo "── [7/7] Checking health..."
MAX_WAIT=90
WAITED=0
until curl -sf http://localhost:3000 >/dev/null 2>&1; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "WARNING: Web not responding after ${MAX_WAIT}s"
        echo ""
        echo "Last web logs:"
        docker compose -f docker-compose.prod.yml logs --tail=30 web
        break
    fi
    sleep 3
    WAITED=$((WAITED + 3))
    printf "  Waiting for web... (%ds)\r" "$WAITED"
done

if [ $WAITED -lt $MAX_WAIT ]; then
    echo "  Web is healthy!                "
fi
echo ""

echo "── Status:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
REMOTE_SCRIPT

echo ""
echo "=== Deploy Complete ==="
echo "  Dashboard: http://${DROPLET_IP}:3000"
echo "  Login:     admin@mediabot.local / admin123"
echo ""
