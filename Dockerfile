# syntax=docker/dockerfile:1
# =============================================================================
#  AgentLaunch — single all-in-one Dockerfile
#  Runs PostgreSQL + API (Express) + Web (Next.js) in one container.
#
#  Build:
#    docker build -t agentlaunch .
#
#  Run:
#    docker run -p 3000:3000 -p 4000:4000 \
#      -e CREATEOS_API_KEY=your_key \
#      agentlaunch
#
#  Optional build-arg (URL the browser uses to reach the API):
#    docker build --build-arg NEXT_PUBLIC_API_URL=http://myserver:4000 -t agentlaunch .
# =============================================================================

# ─── Stage 1: Build API (TypeScript → JS) ────────────────────────────────────
FROM node:20-alpine AS api-builder
WORKDIR /repo

COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json                      ./apps/api/
COPY packages/typescript-config/package.json    ./packages/typescript-config/
COPY packages/eslint-config/package.json        ./packages/eslint-config/
RUN npm ci --ignore-scripts

COPY apps/api/                      ./apps/api/
COPY packages/typescript-config/    ./packages/typescript-config/

WORKDIR /repo/apps/api
RUN npx tsc
# place schema.sql beside compiled output (readFileSync(__dirname+"/schema.sql"))
RUN cp src/db/schema.sql dist/db/schema.sql


# ─── Stage 2: Build Web (Next.js standalone) ─────────────────────────────────
FROM node:20-alpine AS web-builder
WORKDIR /repo

COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json                      ./apps/web/
COPY packages/ui/package.json                   ./packages/ui/
COPY packages/typescript-config/package.json    ./packages/typescript-config/
COPY packages/eslint-config/package.json        ./packages/eslint-config/
RUN npm ci --ignore-scripts

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY apps/web/                   ./apps/web/
COPY packages/ui/                ./packages/ui/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/eslint-config/     ./packages/eslint-config/

WORKDIR /repo/apps/web
RUN npm run build


# ─── Stage 3: Runtime image — Node + PostgreSQL in one container ─────────────
FROM node:20-alpine

# Install PostgreSQL and bash (needed by the startup script)
RUN apk add --no-cache postgresql postgresql-contrib su-exec bash

# PostgreSQL runtime directories
RUN mkdir -p /var/lib/postgresql/data /run/postgresql \
 && chown -R postgres:postgres /var/lib/postgresql /run/postgresql

WORKDIR /app

# ── API ──────────────────────────────────────────────────────────────────────
COPY --from=api-builder /repo/apps/api/dist ./api/dist

# Re-install only production deps for the API
COPY package.json package-lock.json ./
COPY apps/api/package.json                   ./apps/api/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json     ./packages/eslint-config/
RUN npm ci --omit=dev --ignore-scripts

# ── Web (Next.js standalone) ─────────────────────────────────────────────────
# With outputFileTracingRoot = repo root, standalone lands under apps/web/
# Flatten it to /app/web so `node server.js` works from /app/web
COPY --from=web-builder /repo/apps/web/.next/standalone/apps/web/ ./web/
COPY --from=web-builder /repo/apps/web/.next/standalone/node_modules ./web/node_modules
COPY --from=web-builder /repo/apps/web/.next/static  ./web/.next/static
COPY --from=web-builder /repo/apps/web/public         ./web/public

# ── Startup script ────────────────────────────────────────────────────────────
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Default environment (override at `docker run -e`)
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=512" \
    NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL=postgres://agentlaunch:agentlaunch@127.0.0.1:5432/agentlaunch \
    BNB_RPC_URL=https://bsc-testnet-dataseed.bnbchain.org \
    CREATEOS_API_URL=https://api-createos.nodeops.network/v1 \
    CREATEOS_API_KEY="" \
    TOKEN_GATE_THRESHOLD=1000000000000000000 \
    SIGNATURE_TTL_SECONDS=300

# API on 4000, Web on 3000
EXPOSE 4000 3000

ENTRYPOINT ["/start.sh"]
