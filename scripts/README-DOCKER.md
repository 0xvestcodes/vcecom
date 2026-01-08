# Docker Quick Reference - Backend Only

## Quick Commands

### Build Backend Image

```bash
# Build and push to GHCR
./scripts/docker-build.sh

# Build with custom tag
./scripts/docker-build.sh --tag v1.0.0

# Build only (no push)
./scripts/docker-build.sh --no-push
```

### Publish to GHCR

```bash
# Login first (interactive)
./scripts/docker-login.sh

# Or login manually
docker login ghcr.io
# Use your GitHub username and a PAT with 'write:packages' permission

# Build and push
./scripts/docker-build.sh
```

### Deploy Backend to Production

```bash
# 1. Setup environment
cp .env.production.example .env.production
# Edit .env.production with your values

# 2. Deploy
./scripts/deploy.sh
```

## Image Location

- Backend: `ghcr.io/vestcodes/vcecom-backend:latest`

## Common Tasks

```bash
# View logs
docker-compose -f docker-compose.prod.yaml --env-file .env.production logs -f

# View backend logs
docker-compose -f docker-compose.prod.yaml --env-file .env.production logs -f backend

# Restart backend
docker-compose -f docker-compose.prod.yaml --env-file .env.production restart backend

# Stop all services
docker-compose -f docker-compose.prod.yaml --env-file .env.production down

# Update and redeploy
docker-compose -f docker-compose.prod.yaml --env-file .env.production pull backend
docker-compose -f docker-compose.prod.yaml --env-file .env.production up -d backend
```

## Services Included

- **Backend API** - NestJS backend service
- **PostgreSQL** - Database
- **Redis** - Cache and session storage
- **Meilisearch** - Search engine
- **MinIO** - Object storage
- **Traefik** - Reverse proxy with SSL
- **Zipkin** - Distributed tracing (optional)

For detailed documentation, see [docs/DOCKER.md](../docs/DOCKER.md)
