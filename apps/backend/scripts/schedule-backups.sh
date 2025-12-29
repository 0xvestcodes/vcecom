#!/bin/bash

# Schedule Database Backups Script
# Sets up a cron job to run database backups every 15 minutes
# Usage: ./schedule-backups.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"
CRON_LOG="/var/log/db-backup-cron.log"

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "Error: Backup script not found at $BACKUP_SCRIPT"
  exit 1
fi

# Make sure backup script is executable
chmod +x "$BACKUP_SCRIPT"

# Create cron job entry (runs every 15 minutes)
CRON_ENTRY="*/15 * * * * $BACKUP_SCRIPT >> $CRON_LOG 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
  echo "Cron job already exists. Removing old entry..."
  crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "Database backup cron job scheduled successfully!"
echo "Backups will run every 15 minutes"
echo "Logs will be written to: $CRON_LOG"
echo ""
echo "To view scheduled jobs: crontab -l"
echo "To remove scheduled jobs: crontab -e"
