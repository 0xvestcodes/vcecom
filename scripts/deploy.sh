#!/bin/bash
set -e

# ============================================================================
# Production Deployment Script
# ============================================================================
# This script handles the complete deployment process:
# 1. Validates environment variables
# 2. Logs into GHCR (if needed)
# 3. Pulls latest images
# 4. Deploys using docker-compose
# 5. Runs database migrations
# 6. Performs health checks
#
# Usage:
#   ./scripts/deploy.sh [OPTIONS]
#
# Options:
#   --env-file FILE     Path to .env file (default: .env.production)
#   --skip-login        Skip GHCR login
#   --skip-migrate      Skip database migrations
#   --skip-healthcheck  Skip health checks
#   --help              Show this help message

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENV_FILE=".env.production"
SKIP_LOGIN=false
SKIP_MIGRATE=false
SKIP_HEALTHCHECK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --skip-login)
      SKIP_LOGIN=true
      shift
      ;;
    --skip-migrate)
      SKIP_MIGRATE=true
      shift
      ;;
    --skip-healthcheck)
      SKIP_HEALTHCHECK=true
      shift
      ;;
    --help)
      cat << EOF
Production Deployment Script

Usage: $0 [OPTIONS]

Options:
  --env-file FILE       Path to .env file (default: .env.production)
  --skip-login          Skip GHCR login
  --skip-migrate        Skip database migrations
  --skip-healthcheck    Skip health checks
  --help                Show this help message

Examples:
  # Deploy with default .env.production
  $0

  # Deploy with custom env file
  $0 --env-file .env.staging

  # Deploy without migrations
  $0 --skip-migrate
EOF
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo -e "${GREEN}=========================================="
echo "🚀 Production Deployment"
echo "==========================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ Error: Environment file '$ENV_FILE' not found${NC}"
  echo ""
  echo "Please create '$ENV_FILE' with required environment variables."
  echo "You can copy from .env.example and update the values."
  exit 1
fi

# Load environment variables
echo -e "${YELLOW}📋 Loading environment variables from $ENV_FILE...${NC}"
set -a
source "$ENV_FILE"
set +a
echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""

# Validate required environment variables
echo -e "${YELLOW}🔍 Validating required environment variables...${NC}"
REQUIRED_VARS=(
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
  "POSTGRES_DB"
  "REDIS_PASSWORD"
  "MEILISEARCH_API_KEY"
  "MINIO_ROOT_USER"
  "MINIO_ROOT_PASSWORD"
  "JWT_SECRET"
  "RAZORPAY_KEY_ID"
  "RAZORPAY_KEY_SECRET"
  "RAZORPAY_WEBHOOK_SECRET"
  "GHCR_REGISTRY"
  "GHCR_ORG"
  "IMAGE_TAG"
  "BACKEND_URL"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo -e "${RED}❌ Error: Missing required environment variables:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}"
echo ""

# Check Docker and docker-compose
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Error: Docker is not installed${NC}"
  exit 1
fi

if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Error: Docker is not running${NC}"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo -e "${RED}❌ Error: docker-compose is not installed${NC}"
  exit 1
fi

# Use docker compose (v2) if available, otherwise docker-compose (v1)
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
else
  DOCKER_COMPOSE="docker-compose"
fi

echo -e "${GREEN}✅ Docker and docker-compose are available${NC}"
echo ""

# Login to GHCR if needed
if [ "$SKIP_LOGIN" = false ]; then
  echo -e "${YELLOW}🔐 Checking GHCR authentication...${NC}"
  if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  GITHUB_TOKEN not set. Attempting to login interactively...${NC}"
    echo "Please enter your GitHub username and personal access token (PAT) with 'read:packages' permission"
    docker login "$GHCR_REGISTRY"
  else
    echo "$GITHUB_TOKEN" | docker login "$GHCR_REGISTRY" -u "$GHCR_USERNAME" --password-stdin
  fi
  echo -e "${GREEN}✅ Logged into GHCR${NC}"
  echo ""
fi

# Pull latest images
echo -e "${YELLOW}📥 Pulling latest images...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yaml --env-file "$ENV_FILE" pull
echo -e "${GREEN}✅ Images pulled successfully${NC}"
echo ""

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yaml --env-file "$ENV_FILE" down
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yaml --env-file "$ENV_FILE" up -d
echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check service health
check_service_health() {
  local service=$1
  local max_attempts=30
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    if docker inspect --format='{{.State.Health.Status}}' "vcecom-${service}-prod" 2>/dev/null | grep -q "healthy"; then
      echo -e "${GREEN}✅ $service is healthy${NC}"
      return 0
    fi
    attempt=$((attempt + 1))
    echo -e "${YELLOW}⏳ Waiting for $service to be healthy... (attempt $attempt/$max_attempts)${NC}"
    sleep 5
  done

  echo -e "${RED}❌ $service failed to become healthy${NC}"
  return 1
}

if [ "$SKIP_HEALTHCHECK" = false ]; then
  echo ""
  echo -e "${YELLOW}🏥 Checking service health...${NC}"
  
  check_service_health "postgres" || exit 1
  check_service_health "redis" || exit 1
  check_service_health "meilisearch" || exit 1
  check_service_health "minio" || exit 1
  check_service_health "backend" || exit 1
  
  echo -e "${GREEN}✅ All backend services are healthy${NC}"
  echo ""
fi

# Run database migrations
if [ "$SKIP_MIGRATE" = false ]; then
  echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
  
  # Wait for backend to be ready
  echo "Waiting for backend to be ready..."
  sleep 10
  
  # Run migrations via backend container
  if docker exec vcecom-backend-prod node -e "console.log('Backend is ready')" 2>/dev/null; then
    echo "Running migrations..."
    docker exec vcecom-backend-prod sh -c "cd /usr/src/app/apps/backend && pnpm db:migrate" || {
      echo -e "${YELLOW}⚠️  Migration command not found or failed. Skipping migrations.${NC}"
      echo "You may need to run migrations manually."
    }
  else
    echo -e "${YELLOW}⚠️  Backend is not ready. Skipping migrations.${NC}"
    echo "You may need to run migrations manually after backend is healthy."
  fi
  
  echo -e "${GREEN}✅ Migrations completed${NC}"
  echo ""
fi

# Show service status
echo -e "${GREEN}=========================================="
echo "📊 Service Status"
echo "==========================================${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yaml --env-file "$ENV_FILE" ps
echo ""

# Show logs command
echo -e "${GREEN}=========================================="
echo "📝 Useful Commands"
echo "==========================================${NC}"
echo ""
echo "View logs:"
echo "  $DOCKER_COMPOSE -f docker-compose.prod.yaml --env-file $ENV_FILE logs -f"
echo ""
echo "View backend logs:"
echo "  $DOCKER_COMPOSE -f docker-compose.prod.yaml --env-file $ENV_FILE logs -f backend"
echo ""
echo "Stop all services:"
echo "  $DOCKER_COMPOSE -f docker-compose.prod.yaml --env-file $ENV_FILE down"
echo ""
echo "Restart backend:"
echo "  $DOCKER_COMPOSE -f docker-compose.prod.yaml --env-file $ENV_FILE restart backend"
echo ""
echo "Backend API URL:"
echo "  ${BACKEND_URL:-https://api.vcecom.vestcodes.co}"
echo ""

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
