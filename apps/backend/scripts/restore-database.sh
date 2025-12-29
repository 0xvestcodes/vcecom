#!/bin/bash

# Database Restore Script
# Restores a PostgreSQL database from a backup file
# Usage: ./restore-database.sh <backup-file> [--confirm]

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Error: Backup file not provided"
  echo "Usage: ./restore-database.sh <backup-file> [--confirm]"
  exit 1
fi

BACKUP_FILE="$1"
CONFIRM_FLAG="$2"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Get database connection details from environment
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  exit 1
fi

DB_URL="$DATABASE_URL"

# Safety check: require confirmation unless --confirm flag is provided
if [ "$CONFIRM_FLAG" != "--confirm" ]; then
  echo "WARNING: This will overwrite the current database!"
  echo "Backup file: $BACKUP_FILE"
  echo "Database: $DB_URL"
  echo ""
  read -p "Type 'yes' to confirm: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 1
  fi
fi

echo "Starting database restore from: $BACKUP_FILE"

# Check if backup file is gzipped
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "Decompressing and restoring database..."
  gunzip -c "$BACKUP_FILE" | psql "$DB_URL"
else
  echo "Restoring database..."
  psql "$DB_URL" < "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
  echo "Database restored successfully from: $BACKUP_FILE"
else
  echo "Error: Failed to restore database"
  exit 1
fi
