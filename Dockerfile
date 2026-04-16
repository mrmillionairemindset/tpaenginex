# Multi-stage Dockerfile for TPAEngineX.
#
# Targets:
#   dev   — hot-reloading dev server. Used by docker-compose --profile app.
#   prod  — optimized standalone build for production deployment.

# -----------------------------------------------------------------------------
# Base: shared Node + npm install layer
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app

# Install build deps for native modules (bcrypt, pdfkit, etc.)
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# -----------------------------------------------------------------------------
# Dev target: hot reload
# -----------------------------------------------------------------------------
FROM base AS dev
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Builder: compile production bundle
# -----------------------------------------------------------------------------
FROM base AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The build step needs placeholders for env-validated secrets so it can complete;
# real values must be injected at runtime.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
ENV NEXTAUTH_SECRET=build-time-placeholder
ENV NEXTAUTH_URL=http://localhost:3000
ENV APP_ENCRYPTION_KEY=build-time-placeholder-32-chars-min-regenerate
RUN npm run build

# -----------------------------------------------------------------------------
# Prod target: minimal runtime image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy only what's needed at runtime
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
