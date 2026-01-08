#!/bin/bash
set -e

# ============================================================================
# Docker Login Helper for GHCR
# ============================================================================
# This script helps you authenticate with GitHub Container Registry
#
# Usage:
#   ./scripts/docker-login.sh [OPTIONS]
#
# Options:
#   --username USER    GitHub username (optional, will prompt if not provided)
#   --token TOKEN      GitHub Personal Access Token (optional, will prompt if not provided)
#   --registry REG     Registry URL (default: ghcr.io)
#   --help             Show this help message

REGISTRY="ghcr.io"
USERNAME=""
TOKEN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --username)
      USERNAME="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --help)
      cat << EOF
Docker Login Helper for GHCR

Usage: $0 [OPTIONS]

Options:
  --username USER    GitHub username (optional, will prompt if not provided)
  --token TOKEN      GitHub Personal Access Token (optional, will prompt if not provided)
  --registry REG     Registry URL (default: ghcr.io)
  --help             Show this help message

Examples:
  # Interactive login
  $0

  # Login with username and token
  $0 --username myuser --token ghp_xxxxxxxxxxxx

  # Login using environment variable
  GITHUB_TOKEN=ghp_xxx $0 --username myuser

Creating a GitHub Personal Access Token:
  1. Go to https://github.com/settings/tokens
  2. Click "Generate new token" -> "Generate new token (classic)"
  3. Give it a name (e.g., "Docker GHCR")
  4. Select scopes: 'write:packages', 'read:packages'
  5. Click "Generate token"
  6. Copy the token (you won't see it again!)

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

echo "=========================================="
echo "🔐 GitHub Container Registry Login"
echo "=========================================="
echo ""

# Get username if not provided
if [ -z "$USERNAME" ]; then
  read -p "GitHub Username: " USERNAME
fi

# Get token if not provided
if [ -z "$TOKEN" ]; then
  # Try environment variable first
  if [ -n "$GITHUB_TOKEN" ]; then
    TOKEN="$GITHUB_TOKEN"
    echo "Using GITHUB_TOKEN from environment"
  else
    echo ""
    echo "GitHub Personal Access Token (PAT)"
    echo "Create one at: https://github.com/settings/tokens"
    echo "Required scopes: 'write:packages', 'read:packages'"
    echo ""
    read -sp "Token: " TOKEN
    echo ""
  fi
fi

# Validate inputs
if [ -z "$USERNAME" ] || [ -z "$TOKEN" ]; then
  echo "❌ Error: Username and token are required"
  exit 1
fi

# Login to GHCR
echo ""
echo "Logging in to $REGISTRY..."
echo "$TOKEN" | docker login "$REGISTRY" -u "$USERNAME" --password-stdin

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Successfully logged in to $REGISTRY as $USERNAME"
  echo ""
  echo "You can now build and push images:"
  echo "  ./scripts/docker-build.sh"
else
  echo ""
  echo "❌ Login failed"
  echo ""
  echo "Common issues:"
  echo "  - Invalid token (check it has 'write:packages' permission)"
  echo "  - Wrong username"
  echo "  - Token expired"
  exit 1
fi
