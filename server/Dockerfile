# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build tools required for native addons (argon2, etc.)
RUN apk add --no-cache python3 make g++

# Install ALL dependencies (scripts must run so argon2.node gets compiled)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile TypeScript → dist/
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove dev dependencies — npm prune keeps the already-compiled .node binaries
# (npm ci --omit=dev would reinstall from scratch and skip scripts, losing argon2.node)
RUN npm prune --omit=dev

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Runtime libs for native addons on Alpine
RUN apk add --no-cache libstdc++

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy compiled output and production node_modules from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json

USER appuser

EXPOSE 4000

# Cloud Run sends PORT env var — node process must listen on it
CMD ["node", "dist/server.js"]
