#!/bin/sh
# Runs as user 65535 (non-root) — required by NodeOps.
# No PostgreSQL — uses the external Neon DB via DATABASE_URL.
set -e

echo "[api] Starting Express API on port 4000…"
node /app/api/dist/index.js &

echo "[web] Starting Next.js on port 3000…"
export HOSTNAME=0.0.0.0
export PORT=3000
export NEXT_TELEMETRY_DISABLED=1
node --max-old-space-size=512 /app/web/server.js &

# Exit the container if either process dies
wait -n
echo "[error] A process exited unexpectedly — shutting down."
exit 1
