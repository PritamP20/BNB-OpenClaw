# syntax=docker/dockerfile:1
# =============================================================================
#  Dockerfile.nodeops — NodeOps Cloud deployment
#  • No PostgreSQL — uses external Neon DB (DATABASE_URL env var)
#  • Runs as user 65535 (non-root) — required by NodeOps
#  • Only port 3000 is exposed (web), API runs on internal port 4000
#  • Browser API calls use /api/* which Next.js proxies to localhost:4000
# =============================================================================

# ─── Stage 1: Build API ───────────────────────────────────────────────────────
FROM node:20-alpine AS api-builder
WORKDIR /repo

COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json                      ./apps/api/
COPY packages/typescript-config/package.json    ./packages/typescript-config/
COPY packages/eslint-config/package.json        ./packages/eslint-config/
RUN npm ci --ignore-scripts

COPY apps/api/                   ./apps/api/
COPY packages/typescript-config/ ./packages/typescript-config/

WORKDIR /repo/apps/api
RUN npx tsc
RUN cp src/db/schema.sql dist/db/schema.sql


# ─── Stage 2: Build Web ───────────────────────────────────────────────────────
FROM node:20-alpine AS web-builder
WORKDIR /repo

COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json                      ./apps/web/
COPY packages/ui/package.json                   ./packages/ui/
COPY packages/typescript-config/package.json    ./packages/typescript-config/
COPY packages/eslint-config/package.json        ./packages/eslint-config/
RUN npm ci --ignore-scripts

# Use /api as the API base — Next.js rewrites /api/* → http://127.0.0.1:4000/*
# so the browser never needs to know the container's hostname.
# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
ENV NEXT_PUBLIC_API_URL=/api \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NEXT_PUBLIC_NFA_MANAGER=0x1e48F8bB9855482A9597cCa80BbE183e1dE9EE40 \
    NEXT_PUBLIC_AGENT_REGISTRY=0x57c3788588bA70FfFabBc00CbC0695D6fCAb940f \
    NEXT_PUBLIC_TOKEN_FACTORY=0x2D4D2807BC5c2CC1290e1ad41C7CCf300d8f9b84 \
    NEXT_PUBLIC_PLU_VAULT=0xba4067Dfe540cb5Fb3994ce1D1D6005C231229dB \
    NEXT_PUBLIC_DAMM_MANAGER=0x66F46B310ecd84630c98F0edb29500f93D5Aa0F8 \
    NEXT_PUBLIC_BUYBACK_BURN=0x403Bd6277aFf30CCFf6C343Ba74Bb7eeDbc43027 \
    NEXT_PUBLIC_REPUTATION_ENGINE=0xa7ddE615DA1B5Ec0E9BE95c60Cdba96109351cF4 \
    NEXT_PUBLIC_INCENTIVE_ENGINE=0x033003a5f31ab3D088665aBb791fac67e5b8c557

COPY apps/web/                   ./apps/web/
COPY packages/ui/                ./packages/ui/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/eslint-config/     ./packages/eslint-config/

WORKDIR /repo/apps/web
RUN npm run build


# ─── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Production deps for API
COPY package.json package-lock.json ./
COPY apps/api/package.json                   ./apps/api/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json     ./packages/eslint-config/
RUN npm ci --omit=dev --ignore-scripts

# Compiled API
COPY --from=api-builder /repo/apps/api/dist ./api/dist

# Next.js standalone web
COPY --from=web-builder /repo/apps/web/.next/standalone/apps/web/ ./web/
COPY --from=web-builder /repo/apps/web/.next/standalone/node_modules ./web/node_modules
COPY --from=web-builder /repo/apps/web/.next/static  ./web/.next/static
COPY --from=web-builder /repo/apps/web/public         ./web/public

# Startup script
COPY start.nodeops.sh /start.sh
RUN chmod +x /start.sh

# ── Environment — override these via NodeOps UI if available ─────────────────
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=512" \
    PORT=4000 \
    BNB_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545 \
    TOKEN_GATE_THRESHOLD=1000000000000000000 \
    SIGNATURE_TTL_SECONDS=300 \
    CREATEOS_API_URL=https://api-createos.nodeops.network/v1 \
    CREATEOS_API_KEY=skp_h9R34n9Rmc8C1AO7I650Dg1040076762_1721226930 \
    DATABASE_URL=postgresql://neondb_owner:npg_9KuUTsE5ogIX@ep-small-star-aihsye7m-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require \
    NFA_MANAGER=0x1e48F8bB9855482A9597cCa80BbE183e1dE9EE40 \
    TOKEN_FACTORY=0x2D4D2807BC5c2CC1290e1ad41C7CCf300d8f9b84 \
    REPUTATION_ENGINE=0xa7ddE615DA1B5Ec0E9BE95c60Cdba96109351cF4

# NodeOps only allows 1 exposed port — web on 3000 (API is internal only)
EXPOSE 3000

# Run as non-root user 65535 — required by NodeOps
RUN chown -R 65535:65535 /app /start.sh
USER 65535

ENTRYPOINT ["/start.sh"]
