#!/bin/bash

# Build script optimized for AWS Lightsail
# This script handles memory constraints and provides better error reporting

set -e

echo "🚀 Starting Docker build on Lightsail..."
echo "📊 Checking system resources..."

# Check available memory
TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
AVAIL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $7}')
echo "   Total Memory: ${TOTAL_MEM}MB"
echo "   Available Memory: ${AVAIL_MEM}MB"

# Check disk space
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')
echo "   Available Disk: ${DISK_AVAIL}"

# Warn if memory is low
if [ "$AVAIL_MEM" -lt 1500 ]; then
    echo "⚠️  WARNING: Low available memory. Build may fail or hang."
    echo "   Consider:"
    echo "   1. Stopping other services"
    echo "   2. Adding swap space (see BUILD_TROUBLESHOOTING.md)"
    echo "   3. Upgrading your Lightsail instance"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Enable BuildKit for better performance
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Set memory limit based on available memory
if [ "$AVAIL_MEM" -gt 3000 ]; then
    export NODE_OPTIONS="--max-old-space-size=3072"
    echo "✅ Using 3GB memory limit"
elif [ "$AVAIL_MEM" -gt 2000 ]; then
    export NODE_OPTIONS="--max-old-space-size=2048"
    echo "✅ Using 2GB memory limit"
else
    export NODE_OPTIONS="--max-old-space-size=1536"
    echo "⚠️  Using 1.5GB memory limit (may be slow)"
fi

# Build with progress output
echo ""
echo "🔨 Building backend Docker image..."
echo "   This may take 5-15 minutes depending on your instance size..."
echo ""

# Build with timeout (30 minutes max)
timeout 1800 docker-compose build --progress=plain backend 2>&1 | tee build.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo "📦 Image ready: ecommerce-backend"
else
    echo ""
    echo "❌ Build failed or timed out"
    echo "📋 Check build.log for details"
    echo ""
    echo "Common solutions:"
    echo "1. Increase instance size (minimum 2GB RAM recommended)"
    echo "2. Add swap space (see BUILD_TROUBLESHOOTING.md)"
    echo "3. Build locally and push to registry"
    echo "4. Check build.log for specific errors"
    exit 1
fi

