#!/bin/bash

# Script to generate Traefik basic auth password hash
# Usage: ./scripts/generate-traefik-auth.sh <username> <password>

if [ $# -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    echo "Example: $0 admin mySecurePassword"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

# Check if htpasswd is available
if command -v htpasswd &> /dev/null; then
    HASH=$(htpasswd -nbB $USERNAME $PASSWORD | cut -d: -f2)
    echo "Add this to docker-compose.yaml Traefik labels:"
    echo "traefik.http.middlewares.auth.basicauth.users=$USERNAME:\$$HASH"
else
    echo "htpasswd not found. Install apache2-utils:"
    echo "  Ubuntu/Debian: sudo apt-get install apache2-utils"
    echo "  macOS: brew install httpd"
    echo ""
    echo "Or use Docker to generate:"
    echo "docker run --rm httpd:2.4-alpine htpasswd -nbB $USERNAME $PASSWORD"
fi

