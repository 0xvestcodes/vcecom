#!/bin/bash

# Database Backup Script for Supabase Storage
# Creates a PostgreSQL database backup and uploads it to Supabase Storage
# Runs every 15 minutes via cron or scheduled task
# Usage: ./backup-database.sh [backup-name]

set -e

# Configuration
BACKUP_NAME="${1:-backup-$(date +%Y%m%d-%H%M%S)}"
RETENTION_DAYS="${DB_BACKUP_RETENTION_DAYS:-30}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"
BUCKET="${SUPABASE_BACKUP_BUCKET:-database-backups}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Get database connection details from environment
if [ -z "$DATABASE_URL" ]; then
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Error: DATABASE_URL environment variable is not set"
  exit 1
fi

# Get Supabase Storage configuration
if [ -z "$SUPABASE_URL" ]; then
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Error: SUPABASE_URL environment variable is not set"
  exit 1
fi

if [ -z "$SUPABASE_STORAGE_KEY" ] && [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Error: SUPABASE_STORAGE_KEY or SUPABASE_ANON_KEY environment variable is not set"
  exit 1
fi

# Use storage key if available, otherwise fall back to anon key
SUPABASE_KEY="${SUPABASE_STORAGE_KEY:-$SUPABASE_ANON_KEY}"

# Create backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME.sql.gz"

echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Starting database backup: $BACKUP_NAME"
echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Backup file: $BACKUP_FILE"

# Create PostgreSQL dump
echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Creating database dump..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Error: Failed to create database dump"
  exit 1
fi

# Get backup file size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Backup created successfully: $BACKUP_SIZE"

# Upload to Supabase Storage using Storage API
echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Uploading backup to Supabase Storage..."

# Supabase Storage API endpoint
# Format: https://<project-ref>.supabase.co/storage/v1/object/<bucket>/<path>
S3_KEY="database-backups/$BACKUP_NAME.sql.gz"
UPLOAD_URL="${SUPABASE_URL}/storage/v1/object/${BUCKET}/${S3_KEY}"

# Upload using curl via Supabase Storage API
HTTP_CODE=$(curl -X POST "$UPLOAD_URL" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/gzip" \
  -H "x-upsert: true" \
  --data-binary "@$BACKUP_FILE" \
  -w "%{http_code}" \
  -s -o /dev/null)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Backup uploaded successfully to Supabase Storage: ${BUCKET}/${S3_KEY} (HTTP $HTTP_CODE)"
else
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Error: Failed to upload backup to Supabase Storage (HTTP $HTTP_CODE)"
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] URL: $UPLOAD_URL"
  exit 1
fi

# Clean up old local backups (older than retention period)
echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Cleaning up old local backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Backup completed successfully: $BACKUP_NAME"
