#!/bin/bash
set -e

PGDATA=/var/lib/postgresql/data

# ── Init cluster on very first boot ──────────────────────────────────────────
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[db] Initialising PostgreSQL cluster…"
  su-exec postgres initdb -D "$PGDATA" --encoding=UTF8 --locale=C -A md5 \
    --username=postgres --pwfile=<(echo "postgres")
fi

# ── Start PostgreSQL ──────────────────────────────────────────────────────────
echo "[db] Starting PostgreSQL…"
su-exec postgres pg_ctl start -D "$PGDATA" \
  -o "-c listen_addresses='127.0.0.1'" \
  -w -t 30

# ── Create role / database (idempotent) ──────────────────────────────────────
echo "[db] Ensuring role 'agentlaunch' and database 'agentlaunch' exist…"
su-exec postgres createuser --no-superuser --no-createdb --no-createrole \
  agentlaunch 2>/dev/null || true
su-exec postgres psql -c \
  "ALTER ROLE agentlaunch WITH LOGIN PASSWORD 'agentlaunch';" 2>/dev/null || true
su-exec postgres createdb --owner=agentlaunch agentlaunch 2>/dev/null || true
echo "[db] PostgreSQL ready."

# ── Environment defaults ──────────────────────────────────────────────────────
export DATABASE_URL="${DATABASE_URL:-postgres://agentlaunch:agentlaunch@127.0.0.1:5432/agentlaunch}"
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-4000}"
export BNB_RPC_URL="${BNB_RPC_URL:-https://bsc-testnet-dataseed.bnbchain.org}"

# ── Start API ─────────────────────────────────────────────────────────────────
echo "[api] Starting Express API on port $PORT…"
node /app/api/dist/index.js &

# ── Start Web ─────────────────────────────────────────────────────────────────
echo "[web] Starting Next.js on port 3000…"
export HOSTNAME=0.0.0.0
export PORT=3000
export NEXT_TELEMETRY_DISABLED=1
node --max-old-space-size=512 /app/web/server.js &

# ── Wait — exit if either process crashes ────────────────────────────────────
wait
