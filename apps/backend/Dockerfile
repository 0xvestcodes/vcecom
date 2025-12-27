# Multi-stage Dockerfile for NestJS Backend with Turborepo and pnpm
# Based on: https://www.bstefanski.com/blog/turborepo-nestjs-prisma-dockerfile

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
# Stage 2: Builder - Prune workspace to get only backend dependencies
# ============================================================================
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /usr/src/app

# Install Git (optional - for build-info generation, but not required)
# Note: Railway and many CI/CD platforms don't include .git in build context
# The build-info script handles missing git gracefully (uses "unknown" for commit hash)
RUN apk add --no-cache git

# Copy package files for dependency resolution
COPY package.json pnpm-lock.yaml* ./
COPY . .

# Prune workspace to only include backend and its dependencies
RUN turbo prune --scope=@vestcodes/vcecom-backend --docker

# ============================================================================
# Stage 3: Installer - Install dependencies and build
# ============================================================================
FROM base AS installer
WORKDIR /usr/src/app

# Set Node.js memory limits to prevent OOM on resource-constrained systems
# 2048MB should work on 2GB+ instances, increase if you have more RAM
ENV NODE_OPTIONS="--max-old-space-size=2048"
# Don't set NODE_ENV=production here - we need devDependencies for building

# Copy workspace configuration files
COPY .gitignore .gitignore
COPY --from=builder /usr/src/app/out/json/ .
COPY --from=builder /usr/src/app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /usr/src/app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /usr/src/app/out/full/ .

# Remove prepare script before installing to avoid husky dependency issue
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); delete pkg.scripts.prepare; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"

# Install dependencies with frozen lockfile for reproducible builds
# Install all dependencies (including devDependencies) needed for building
RUN pnpm install --frozen-lockfile

# Copy turbo.json for build orchestration
COPY turbo.json turbo.json

# Build the database package first (required dependency)
RUN echo "Building database package..." && \
    turbo run build --filter=@vcecom/db... && \
    echo "Database package built successfully"

# Build the backend application
# Use explicit memory limits and add progress output to debug hanging
RUN echo "Starting backend build..." && \
    NODE_OPTIONS="--max-old-space-size=2048" turbo run build --filter=@vestcodes/vcecom-backend... && \
    echo "Backend build completed successfully"

# ============================================================================
# Stage 4: Runner - Production runtime image
# ============================================================================
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

# Install openssl for Node.js crypto operations
RUN apk add --no-cache openssl && \
    # Create system group and user for security
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Install pnpm in runner stage for dependency management
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root package.json and workspace files for dependency installation
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/package.json ./package.json
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy workspace packages needed for installation
# Copy complete package structure (package.json + dist) so pnpm can properly link workspace packages
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/packages/db/package.json ./packages/db/package.json
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/packages/db/dist ./packages/db/dist
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/packages/typescript-config ./packages/typescript-config
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/apps/backend/package.json ./apps/backend/package.json

# Remove prepare script from package.json to avoid husky dependency issue
# prepare script runs husky which is a devDependency and not needed in production
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); delete pkg.scripts.prepare; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"

# Install only production dependencies
# This will create symlinks in node_modules/@vcecom/db pointing to packages/db
# The db package dist is already copied above, so the symlink will work correctly
RUN pnpm install --frozen-lockfile --prod && \
    chown -R nodejs:nodejs /usr/src/app

# Copy backend built application (after dependencies are installed)
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/apps/backend/dist ./apps/backend/dist

# Copy backend scripts (needed for build-info generation)
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/apps/backend/scripts ./apps/backend/scripts

# Copy Lua scripts for Redis operations (not compiled, need to copy from source)
COPY --from=installer --chown=nodejs:nodejs /usr/src/app/apps/backend/src/modules/redis-store/scripts ./apps/backend/dist/modules/redis-store/scripts

# Create storage directory structure (for file uploads and generated files)
# Storage directory is created at runtime, so we just need the directory structure
RUN mkdir -p /usr/src/app/apps/backend/storage/invoices && \
    chown -R nodejs:nodejs /usr/src/app/apps/backend/storage

# Verify db package structure (non-blocking, just for debugging)
RUN echo "Verifying db package structure..." && \
    test -d /usr/src/app/packages/db/dist && \
    test -f /usr/src/app/packages/db/dist/index.js && \
    echo "✅ DB package dist verified" && \
    ls -la /usr/src/app/node_modules/@vcecom/ 2>/dev/null | head -5 || echo "Note: @vcecom packages will be resolved via workspace"

# Switch to non-root user for security
USER nodejs

# Set working directory to backend app
WORKDIR /usr/src/app/apps/backend

# Expose the default port (can be overridden via PORT env variable)
EXPOSE 3001

# Health check to ensure the container is running
# Uses the database health endpoint as it's the most critical check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/_health/database', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/main.js"]