# Docker Deployment Guide - Backend

This guide covers building, publishing, and deploying the VCEcom backend API using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Building Docker Images](#building-docker-images)
- [Publishing to GHCR](#publishing-to-ghcr)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2 (or docker-compose v1.29+)
- Docker Buildx (included with Docker Desktop)
- GitHub account with access to the repository
- GitHub Personal Access Token (PAT) with `read:packages` and `write:packages` permissions

## Building Docker Images

### Build Backend

Build the backend API:

```bash
./scripts/docker-build.sh
```

### Build Options

```bash
# Build with custom tag
./scripts/docker-build.sh --tag v1.0.0

# Build without pushing (local only)
./scripts/docker-build.sh --no-push

# Build for specific platform
./scripts/docker-build.sh --platform linux/amd64

# Custom registry and organization
./scripts/docker-build.sh --registry ghcr.io --org your-org
```

## Publishing to GHCR

### Manual Publishing

1. **Login to GHCR:**

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Or interactively:

```bash
docker login ghcr.io
```

2. **Build and Push:**

```bash
# Build and push backend
./scripts/docker-build.sh

# Build and push with custom tag
./scripts/docker-build.sh --tag v1.0.0
```

### Automated Publishing via GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/docker-publish.yml`) that automatically builds and publishes images on:

- Push to `main` or `develop` branches
- Tagged releases (e.g., `v1.0.0`)
- Manual workflow dispatch

**Workflow Features:**
- Multi-platform builds (linux/amd64, linux/arm64)
- Automatic tagging based on branch/tag
- GitHub Actions cache for faster builds
- Private GHCR publishing

**Manual Trigger:**

1. Go to Actions → Docker Build and Publish Backend to GHCR
2. Click "Run workflow"
3. Optionally specify a custom tag
4. Run the workflow

### Image Tags

Images are tagged with:
- `latest` - Latest build from default branch
- `main` - Builds from main branch
- `develop` - Builds from develop branch
- `v1.0.0` - Semantic version tags
- `main-abc1234` - Branch name + commit SHA

### Pulling Images

```bash
# Pull latest
docker pull ghcr.io/vestcodes/vcecom-backend:latest

# Pull specific tag
docker pull ghcr.io/vestcodes/vcecom-backend:v1.0.0
```

## Production Deployment

### Quick Start

1. **Create Environment File:**

```bash
cp .env.production.example .env.production
```

2. **Configure Environment Variables:**

Edit `.env.production` and update all `CHANGE_ME` values with your production credentials.

3. **Deploy:**

```bash
./scripts/deploy.sh
```

### Deployment Process

The deployment script (`scripts/deploy.sh`) performs the following steps:

1. ✅ Validates environment variables
2. 🔐 Logs into GHCR (if needed)
3. 📥 Pulls latest Docker images
4. 🛑 Stops existing containers
5. 🚀 Starts services
6. ⏳ Waits for health checks
7. 🗄️ Runs database migrations
8. 📊 Shows service status

### Deployment Options

```bash
# Use custom environment file
./scripts/deploy.sh --env-file .env.staging

# Skip GHCR login (if already logged in)
./scripts/deploy.sh --skip-login

# Skip database migrations
./scripts/deploy.sh --skip-migrate

# Skip health checks
./scripts/deploy.sh --skip-healthcheck
```

### Manual Deployment

If you prefer to deploy manually:

```bash
# Load environment variables
export $(cat .env.production | xargs)

# Pull latest images
docker-compose -f docker-compose.prod.yaml --env-file .env.production pull

# Start services
docker-compose -f docker-compose.prod.yaml --env-file .env.production up -d

# View logs
docker-compose -f docker-compose.prod.yaml --env-file .env.production logs -f

# Stop services
docker-compose -f docker-compose.prod.yaml --env-file .env.production down
```

## Environment Configuration

### Required Environment Variables

See `.env.production.example` for a complete list. Key variables:

**Database:**
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

**Redis:**
- `REDIS_PASSWORD`

**JWT (Required):**
- `JWT_SECRET` (minimum 32 characters)
- `JWT_REFRESH_SECRET` (optional, defaults to JWT_SECRET)

**Payment Gateway:**
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

**Docker Registry:**
- `GHCR_REGISTRY` (default: ghcr.io)
- `GHCR_ORG` (default: vestcodes)
- `IMAGE_TAG` (default: latest)

### Generating Secrets

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate database password
openssl rand -base64 24

# Generate Redis password
openssl rand -base64 24

# Generate Traefik basic auth
htpasswd -nb admin password
```

## Service Management

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yaml --env-file .env.production logs -f

# Specific service
docker-compose -f docker-compose.prod.yaml --env-file .env.production logs -f backend
```

### Restart Services

```bash
# Restart all services
docker-compose -f docker-compose.prod.yaml --env-file .env.production restart

# Restart specific service
docker-compose -f docker-compose.prod.yaml --env-file .env.production restart backend
```

### Update Services

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yaml --env-file .env.production pull

# Recreate containers with new images
docker-compose -f docker-compose.prod.yaml --env-file .env.production up -d
```

### Health Checks

```bash
# Check service health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check specific service
docker inspect vcecom-backend-prod | grep -A 10 Health
```

## Troubleshooting

### Build Issues

**Issue: Build fails with "out of memory"**
- Solution: Increase Docker memory limit or reduce `NODE_MEMORY_LIMIT` build arg

**Issue: Build fails with "turbo prune" errors**
- Solution: Ensure you're running from the repository root and `.git` directory exists

**Issue: Next.js standalone build fails**
- Solution: Ensure `output: "standalone"` is set in `next.config.ts`

### Deployment Issues

**Issue: Cannot pull images from GHCR**
- Solution: Ensure you're logged in: `docker login ghcr.io`
- Check image visibility (private packages require authentication)

**Issue: Services fail health checks**
- Solution: Check logs: `docker-compose logs backend`
- Verify environment variables are set correctly
- Ensure database and Redis are healthy

**Issue: Database migrations fail**
- Solution: Run migrations manually:
  ```bash
  docker exec vcecom-backend-prod sh -c "cd /usr/src/app/apps/backend && pnpm db:migrate"
  ```

**Issue: Traefik SSL certificate issues**
- Solution: Ensure port 80 and 443 are accessible
- Check Let's Encrypt email is valid
- Verify domain DNS points to server

### Common Commands

```bash
# View all containers
docker ps -a

# View container logs
docker logs vcecom-backend-prod

# Execute command in container
docker exec -it vcecom-backend-prod sh

# View resource usage
docker stats

# Clean up unused images
docker image prune -a

# Clean up everything (careful!)
docker system prune -a --volumes
```

## Architecture

### Services

- **Traefik** - Reverse proxy with SSL termination
- **PostgreSQL** - Primary database
- **Redis** - Caching and session storage
- **Meilisearch** - Search engine
- **MinIO** - Object storage (S3-compatible)
- **Backend** - NestJS API server
- **Zipkin** - Distributed tracing (optional)

### Network

All services run on a private Docker network (`vcecom-network`) and communicate internally. Only Traefik exposes ports 80 and 443 to the host.

### Volumes

Persistent data is stored in Docker volumes:
- `postgres_data` - Database files
- `redis_data` - Redis persistence
- `meilisearch_data` - Search index
- `minio_data` - Object storage
- `traefik_letsencrypt` - SSL certificates

## Security Best Practices

1. ✅ Use strong, unique passwords for all services
2. ✅ Rotate secrets regularly
3. ✅ Keep Docker images updated
4. ✅ Use private GHCR repositories
5. ✅ Restrict Traefik dashboard access
6. ✅ Enable firewall rules (only 80, 443 open)
7. ✅ Monitor logs for suspicious activity
8. ✅ Use HTTPS only (Traefik redirects HTTP to HTTPS)
9. ✅ Keep `.env.production` secure (never commit to git)

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review GitHub Issues
- Contact: contact@vestcodes.co
