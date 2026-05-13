# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and compile TypeScript → dist/
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies so only production deps are carried forward
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy compiled output and production node_modules from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json

# GCP service account key — mount at runtime via secret or bind mount
# docker run -v /host/path/gcp-key.json:/app/gcp-service-account.json ...
# The path must match GCP_KEY_FILE in .env (default: ./gcp-service-account.json)

USER appuser

EXPOSE 4000

# Healthcheck — hits /api/v1/health (or adjust if your health route differs)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
