#!/bin/bash

# Predeploy Script for Database Migrations
# Generates migrations from schema changes and runs them
# Usage: ./predeploy.sh [--skip-generate] [--skip-migrate]

set -e

SKIP_GENERATE=false
SKIP_MIGRATE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-generate)
      SKIP_GENERATE=true
      shift
      ;;
    --skip-migrate)
      SKIP_MIGRATE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-generate] [--skip-migrate]"
      exit 1
      ;;
  esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  log_error "DATABASE_URL environment variable is not set"
  exit 1
fi

# Get the root directory of the monorepo (assuming script is in apps/backend/scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$BACKEND_DIR/../.." && pwd)"
DB_PACKAGE_DIR="$ROOT_DIR/packages/db"

log_info "Starting predeploy database migration process..."
log_info "Root directory: $ROOT_DIR"
log_info "Database package: $DB_PACKAGE_DIR"

# Step 1: Generate migrations (if not skipped)
if [ "$SKIP_GENERATE" = false ]; then
  log_info "Step 1: Generating migrations from schema changes..."
  
  cd "$DB_PACKAGE_DIR"
  
  # Check if drizzle-kit is available
  if ! command -v drizzle-kit &> /dev/null && [ ! -f "node_modules/.bin/drizzle-kit" ]; then
    log_warn "drizzle-kit not found, installing dependencies..."
    pnpm install
  fi
  
  # Generate migrations
  log_info "Running: pnpm db:generate"
  if pnpm db:generate; then
    log_info "Migrations generated successfully"
    
    # Check if new migrations were created
    NEW_MIGRATIONS=$(git status --porcelain drizzle/ 2>/dev/null | grep -E "\.sql$" | wc -l || echo "0")
    if [ "$NEW_MIGRATIONS" -gt 0 ]; then
      log_warn "New migration files detected. Please review and commit them before deploying."
      log_warn "Migration files:"
      git status --porcelain drizzle/ 2>/dev/null | grep -E "\.sql$" || true
    fi
  else
    log_error "Failed to generate migrations"
    exit 1
  fi
else
  log_info "Step 1: Skipping migration generation (--skip-generate flag)"
fi

# Step 2: Run migrations (if not skipped)
if [ "$SKIP_MIGRATE" = false ]; then
  log_info "Step 2: Running database migrations..."
  
  cd "$DB_PACKAGE_DIR"
  
  # Check if migrations folder exists
  if [ ! -d "drizzle" ]; then
    log_error "Migrations folder not found. Run migration generation first."
    exit 1
  fi
  
  # Check if there are any migration SQL files
  SQL_FILES=$(find drizzle -name "*.sql" -type f 2>/dev/null | wc -l || echo "0")
  if [ "$SQL_FILES" -eq 0 ]; then
    log_warn "No migration SQL files found. Database schema may already be up to date."
  else
    log_info "Found $SQL_FILES migration SQL file(s)"
  fi
  
  # Ensure the db package is built (migrate-cli.ts needs to be compiled)
  log_info "Building database package..."
  if ! pnpm build; then
    log_error "Failed to build database package"
    exit 1
  fi
  
  # Run migrations using the migrate-cli (non-interactive)
  log_info "Running: pnpm db:migrate:run"
  if pnpm db:migrate:run; then
    log_info "Migrations applied successfully"
  else
    log_error "Failed to run migrations"
    exit 1
  fi
else
  log_info "Step 2: Skipping migration execution (--skip-migrate flag)"
fi

log_info "Predeploy database migration process completed successfully!"
