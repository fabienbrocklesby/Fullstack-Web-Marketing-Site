#!/bin/bash
# Backup Strapi file uploads
# Runs separately from database backups

set -e

BACKUP_DIR="./backups/uploads"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
UPLOAD_DIR="./backend/public/uploads"
RETENTION_DAYS=30

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
echo "Starting uploads backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if uploads directory exists and has content
if [ ! -d "$UPLOAD_DIR" ] || [ -z "$(ls -A $UPLOAD_DIR)" ]; then
    echo "⚠️  No uploads to backup (directory empty or missing)"
    exit 0
fi

# Create compressed archive
BACKUP_FILE="$BACKUP_DIR/uploads_backup_$TIMESTAMP.tar.gz"
if tar -czf "$BACKUP_FILE" -C "./backend/public" "uploads"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Uploads backup created: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "✗ Uploads backup FAILED!"
    exit 1
fi

# Remove old backups
DELETED=$(find "$BACKUP_DIR" -name "uploads_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "✓ Removed $DELETED upload backup(s) older than $RETENTION_DAYS days"
fi

echo "✓ Uploads backup completed successfully"
echo ""

# Optional: Upload to S3/Backblaze
# aws s3 cp "$BACKUP_FILE" "s3://lightlane-backups/uploads/"
# b2 upload-file lightlane-backups "uploads/$(basename $BACKUP_FILE)" "$BACKUP_FILE"
