# Multi-stage Dockerfile for Next.js Admin App with Turborepo and pnpm
# Based on Next.js standalone output mode for optimal production builds

# ============================================================================
# Stage 1: Base - Setup pnpm and turbo
# ============================================================================
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    pnpm install turbo --global

# ============================================================================
# Stage 2: Builder - Prune workspace to get only admin dependencies
# ============================================================================
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /usr/src/app

# Install Git (optional - for build-info generation)
RUN apk add --no-cache git

# Copy package files for dependency resolution
COPY package.json pnpm-lock.yaml* ./
COPY . .

# Prune workspace to only include admin and its dependencies
RUN turbo prune --scope=@vestcodes/vcecom-admin --docker

# ============================================================================
# Stage 3: Installer - Install dependencies and build
# ============================================================================
FROM base AS installer
WORKDIR /usr/src/app

# Install Git for build-info generation
RUN apk add --no-cache git

# Configure Node.js memory limits
ARG NODE_MEMORY_LIMIT=2048
ENV NODE_OPTIONS="--max-old-space-size=${NODE_MEMORY_LIMIT}"
ENV NEXT_TELEMETRY_DISABLED=1

# Copy workspace configuration files
COPY .gitignore .gitignore
COPY --from=builder /usr/src/app/.git ./.git
COPY --from=builder /usr/src/app/out/json/ .
COPY --from=builder /usr/src/app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /usr/src/app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /usr/src/app/out/full/ .

# Remove prepare script before installing to avoid husky dependency issue
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); delete pkg.scripts.prepare; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy turbo.json for build orchestration
COPY turbo.json turbo.json

# Build the database package first (required dependency)
RUN echo "Building database package..." && \
    turbo run build --filter=@vcecom/db... && \
    echo "Database package built successfully"

# Build the admin application with standalone output
RUN echo "Starting admin build..." && \
    cd apps/admin && \
    pnpm build && \
    echo "Admin build completed successfully"

# ============================================================================
# Stage 4: Runner - Production runtime image
# ============================================================================
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install openssl for Node.js crypto operations
RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install pnpm in runner stage
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root package.json and workspace files
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/package.json ./package.json
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy workspace packages needed for runtime
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/packages/db/package.json ./packages/db/package.json
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/packages/db/dist ./packages/db/dist
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/packages/typescript-config ./packages/typescript-config
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/apps/admin/package.json ./apps/admin/package.json

# Copy CMS blocks packages if they exist
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/packages/cms-blocks/package.json ./packages/cms-blocks/package.json 2>/dev/null || true
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/packages/cms-blocks/dist ./packages/cms-blocks/dist 2>/dev/null || true
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/packages/cms-blocks-admin/package.json ./packages/cms-blocks-admin/package.json 2>/dev/null || true
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/packages/cms-blocks-admin/dist ./packages/cms-blocks-admin/dist 2>/dev/null || true

# Remove prepare script from package.json
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); delete pkg.scripts.prepare; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"

# Install only production dependencies
RUN pnpm install --no-frozen-lockfile --prod && \
    chown -R nextjs:nodejs /usr/src/app

# Copy Next.js standalone build output
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/apps/admin/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=installer --chown=nextjs:nodejs /usr/src/app/apps/admin/public ./apps/admin/public

# Switch to non-root user for security
USER nextjs

# Set working directory to admin app standalone directory
WORKDIR /usr/src/app/apps/admin

# Expose the default port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application using Next.js standalone server
CMD ["node", "server.js"]
