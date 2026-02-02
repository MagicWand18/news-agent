#!/bin/bash
# ===========================================
# MediaBot - Quick Deploy (GHCR)
# Uses pre-built images from GitHub Container Registry
# Much faster than building on server (~30s vs ~5min)
# Usage: bash deploy/quick-deploy.sh
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
# ──────────────────────────────────────────────────────────

echo "=== MediaBot - Quick Deploy (GHCR) ==="
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
    exit 1
fi
echo "→ Connected."
echo ""

# Upload .env.production
if [ -f "$ENV_FILE" ]; then
    echo "→ Uploading .env.production..."
    ssh $SSH_OPTS "${DROPLET_USER}@${DROPLET_IP}" "mkdir -p ${APP_DIR}"
    scp $SSH_OPTS "$ENV_FILE" "${DROPLET_USER}@${DROPLET_IP}:${APP_DIR}/.env"
else
    echo "ERROR: .env.production not found at $ENV_FILE"
    exit 1
fi
echo ""

# Execute quick deploy on server
echo "→ Starting quick deploy..."
echo ""

ssh $SSH_OPTS "${DROPLET_USER}@${DROPLET_IP}" bash -s "$REPO_URL" <<'REMOTE_SCRIPT'
set -euo pipefail

REPO_URL="${1}"
APP_DIR="/opt/mediabot"

echo "── [1/5] Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
fi
if ! docker compose version &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin
fi
if ! command -v git &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq git
fi
echo "  OK"
echo ""

echo "── [2/5] Updating repo..."
if [ ! -d "$APP_DIR/.git" ]; then
    cp "$APP_DIR/.env" /tmp/mediabot-env-backup 2>/dev/null || true
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
    cp /tmp/mediabot-env-backup "$APP_DIR/.env" 2>/dev/null || true
else
    cd "$APP_DIR"
    git fetch origin main
    git reset --hard origin/main
fi
cd "$APP_DIR"
echo "  Commit: $(git rev-parse --short HEAD)"
echo ""

echo "── [3/5] Pulling images from GHCR..."
docker compose -f docker-compose.ghcr.yml pull
echo "  OK"
echo ""

echo "── [4/5] Restarting containers..."
docker compose -f docker-compose.ghcr.yml down --remove-orphans --timeout 10 2>/dev/null || true
docker compose -f docker-compose.ghcr.yml up -d
echo "  OK"
echo ""

echo "── [5/5] Running migrations..."
# Wait for postgres
MAX_WAIT=30
WAITED=0
until docker compose -f docker-compose.ghcr.yml exec -T postgres pg_isready -U mediabot 2>/dev/null; do
    [ $WAITED -ge $MAX_WAIT ] && { echo "DB timeout"; break; }
    sleep 2
    WAITED=$((WAITED + 2))
done

# Wait for web container
sleep 5

# Apply migrations
docker compose -f docker-compose.ghcr.yml exec -T web npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 || \
docker compose -f docker-compose.ghcr.yml exec -T workers npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 || true

# Seed (optional)
docker compose -f docker-compose.ghcr.yml exec -T web npx tsx prisma/seed.ts 2>&1 || true

echo "  OK"
echo ""

echo "── Status:"
docker compose -f docker-compose.ghcr.yml ps --format "table {{.Name}}\t{{.Status}}"
echo ""
REMOTE_SCRIPT

echo ""
echo "=== Quick Deploy Complete ==="
echo "  Dashboard: http://${DROPLET_IP}:3000"
echo "  Login:     admin@mediabot.local / admin123"
echo ""
