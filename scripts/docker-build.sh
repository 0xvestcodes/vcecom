#!/bin/bash
set -e

# ============================================================================
# Docker Build and Publish Script
# ============================================================================
# Usage:
#   ./scripts/docker-build.sh [OPTIONS]
#
# Options:
#   --tag TAG          Custom tag (default: latest)
#   --no-push          Build only, don't push to registry
#   --registry REG     Registry URL (default: ghcr.io)
#   --image IMAGE      Image name (default: vestcodes/vcecom/backend)
#   --platform PLAT    Platform (default: linux/amd64,linux/arm64)
#   --help             Show this help message

# Default values
TAG="latest"
PUSH=true
REGISTRY="ghcr.io"
IMAGE_NAME="vestcodes/vcecom/backend"
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
    --image)
      IMAGE_NAME="$2"
      shift 2
      ;;
    --platform)
      PLATFORMS="$2"
      shift 2
      ;;
    --help)
      cat << EOF
Docker Build and Publish Script

Usage: $0 [OPTIONS]

Options:
  --tag TAG          Custom tag (default: latest)
  --no-push          Build only, don't push to registry
  --registry REG     Registry URL (default: ghcr.io)
  --image IMAGE      Image name (default: vestcodes/vcecom/backend)
  --platform PLAT    Platform (default: linux/amd64,linux/arm64)
  --help             Show this help message

Examples:
  # Build and push with latest tag
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

FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME:$TAG"

echo "=========================================="
echo "🐳 Docker Build and Publish"
echo "=========================================="
echo "Registry:  $REGISTRY"
echo "Image:     $IMAGE_NAME"
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
  --file ./apps/backend/Dockerfile \
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
