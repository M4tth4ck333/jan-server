# Base image with pnpm
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage
FROM base AS builder
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json ./
COPY .npmrc* ./

# Copy all workspace packages (needed for build dependencies)
COPY apps/platform ./apps/platform

# Install all dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install

# Build arguments
ARG NEXT_PUBLIC_JAN_BASE_URL
ENV NEXT_PUBLIC_JAN_BASE_URL=$NEXT_PUBLIC_JAN_BASE_URL

# Build the platform app
RUN pnpm build:platform

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application and dependencies from builder with ownership
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/.next ./apps/platform/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/node_modules ./apps/platform/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/package.json ./apps/platform/package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/next.config.mjs ./apps/platform/next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/source.config.ts ./apps/platform/source.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/tsconfig.json ./apps/platform/tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/content ./apps/platform/content
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/public ./apps/platform/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/src ./apps/platform/src

# Copy root node_modules for monorepo dependencies
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

WORKDIR /app/apps/platform

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]