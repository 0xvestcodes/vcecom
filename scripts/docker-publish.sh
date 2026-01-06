#!/bin/bash
set -e

# ============================================================================
# Quick Docker Publish Script
# ============================================================================
# Simple wrapper for docker-build.sh with common defaults

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Check if logged in to GitHub Container Registry
if ! docker info 2>/dev/null | grep -q "Username"; then
  echo "⚠️  Not logged in to Docker registry"
  echo ""
  echo "For GitHub Container Registry, login with:"
  echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
  echo ""
  echo "Or use:"
  echo "  docker login ghcr.io"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Run build script
exec "$SCRIPT_DIR/docker-build.sh" "$@"
