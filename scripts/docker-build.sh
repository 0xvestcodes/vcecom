#!/bin/bash
set -e

# ============================================================================
# Docker Build and Publish Script for Backend
# ============================================================================
# Usage:
#   ./scripts/docker-build.sh [OPTIONS]
#
# Options:
#   --tag TAG          Custom tag (default: latest)
#   --no-push          Build only, don't push to registry
#   --registry REG     Registry URL (default: ghcr.io)
#   --org ORG          Organization/username (default: vestcodes)
#   --platform PLAT    Platform (default: linux/amd64,linux/arm64)
#   --help             Show this help message

# Default values
TAG="latest"
PUSH=true
REGISTRY="ghcr.io"
ORG="vestcodes"
PLATFORMS="linux/amd64,linux/arm64"
CUSTOM_TAG=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)
      CUSTOM_TAG="$2"
      shift 2
      ;;
    --no-push)
      PUSH=false
      shift
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --org)
      ORG="$2"
      shift 2
      ;;
    --platform)
      PLATFORMS="$2"
      shift 2
      ;;
    --help)
      cat << EOF
Docker Build and Publish Script for Backend

Usage: $0 [OPTIONS]

Options:
  --tag TAG          Custom tag (default: latest)
  --no-push          Build only, don't push to registry
  --registry REG     Registry URL (default: ghcr.io)
  --org ORG          Organization/username (default: vestcodes)
  --platform PLAT    Platform (default: linux/amd64,linux/arm64)
  --help             Show this help message

Examples:
  # Build and push backend with latest tag
  $0

  # Build with custom tag
  $0 --tag v1.0.0

  # Build only (no push)
  $0 --no-push

  # Build for specific platform
  $0 --platform linux/amd64
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Determine tag
if [ -n "$CUSTOM_TAG" ]; then
  TAG="$CUSTOM_TAG"
elif [ -n "$GITHUB_REF_NAME" ]; then
  # If running in GitHub Actions, use branch/tag name
  TAG="$GITHUB_REF_NAME"
fi

IMAGE_NAME="vcecom-backend"
FULL_IMAGE_NAME="$REGISTRY/$ORG/$IMAGE_NAME:$TAG"

echo ""
echo "=========================================="
echo "🐳 Building Backend"
echo "=========================================="
echo "Registry:  $REGISTRY"
echo "Image:     $ORG/$IMAGE_NAME"
echo "Tag:       $TAG"
echo "Platforms: $PLATFORMS"
echo "Push:      $PUSH"
echo "Full name: $FULL_IMAGE_NAME"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running"
  exit 1
fi

# Check GHCR authentication if pushing
if [ "$PUSH" = true ]; then
  echo ""
  echo "🔐 Checking GHCR authentication..."
  
  # Try to check if we're logged in to GHCR
  if ! docker pull "$REGISTRY/$ORG/vcecom-backend:latest" > /dev/null 2>&1 && \
     ! docker info 2>/dev/null | grep -q "Username"; then
    echo ""
    echo "⚠️  Warning: Not authenticated to GHCR"
    echo ""
    echo "To authenticate, use one of these methods:"
    echo ""
    echo "1. Using GitHub Personal Access Token (PAT):"
    echo "   echo \$GITHUB_TOKEN | docker login $REGISTRY -u YOUR_USERNAME --password-stdin"
    echo ""
    echo "2. Interactive login:"
    echo "   docker login $REGISTRY"
    echo "   (Use your GitHub username and a PAT with 'write:packages' permission)"
    echo ""
    echo "3. Create a PAT at: https://github.com/settings/tokens"
    echo "   Required scopes: 'write:packages', 'read:packages'"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Build cancelled. Please authenticate first."
      exit 1
    fi
  else
    echo "✅ Authenticated to GHCR"
  fi
fi

# Setup buildx if not exists
if ! docker buildx ls | grep -q "vcecom-builder"; then
  echo "📦 Creating buildx builder..."
  docker buildx create --name vcecom-builder --use
else
  echo "📦 Using existing buildx builder..."
  docker buildx use vcecom-builder
fi

# Build the image
echo ""
echo "🔨 Building Docker image..."
BUILD_ARGS=""
if [ "$PUSH" = true ]; then
  BUILD_ARGS="--push"
fi

docker buildx build \
  --platform "$PLATFORMS" \
  --file "./apps/backend/Dockerfile" \
  --tag "$FULL_IMAGE_NAME" \
  $BUILD_ARGS \
  --cache-from type=registry,ref="$FULL_IMAGE_NAME" \
  --cache-to type=inline \
  --progress=plain \
  .

if [ "$PUSH" = true ]; then
  echo ""
  echo "✅ Image pushed successfully!"
  echo ""
  echo "Pull with:"
  echo "  docker pull $FULL_IMAGE_NAME"
else
  echo ""
  echo "✅ Image built successfully!"
  echo ""
  echo "To push manually:"
  echo "  docker push $FULL_IMAGE_NAME"
fi

echo ""
echo "=========================================="
echo "🎉 Build completed!"
echo "=========================================="
