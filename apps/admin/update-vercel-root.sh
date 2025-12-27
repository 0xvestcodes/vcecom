#!/bin/bash
# Script to update Vercel project root directory to apps/admin

echo "Updating Vercel project root directory..."

# Get project ID
PROJECT_ID=$(cat .vercel/project.json | jq -r '.projectId')
ORG_ID=$(cat .vercel/project.json | jq -r '.orgId')

echo "Project ID: $PROJECT_ID"
echo "Org ID: $ORG_ID"

# Get Vercel token from CLI config
TOKEN=$(cat ~/.vercel/auth.json 2>/dev/null | jq -r '.token' || echo "")

if [ -z "$TOKEN" ]; then
  echo "Error: Vercel token not found. Please run 'vercel login' first."
  exit 1
fi

# Update project settings via API
echo "Updating root directory to 'apps/admin'..."

curl -X PATCH \
  "https://api.vercel.com/v10/projects/$PROJECT_ID?teamId=$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rootDirectory": "apps/admin"
  }' | jq '.'

echo ""
echo "✅ Root directory updated! You can now deploy with: vercel --prod"

