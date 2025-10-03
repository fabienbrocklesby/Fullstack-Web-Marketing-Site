#!/bin/sh
# Automated PostgreSQL backup script for LightLane
# Runs via cron every 6 hours - configured in docker-compose.yml
# Backups folder is gitignored - won't interfere with git operations

set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/lightlane_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
echo "Starting automated backup..."

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Perform backup with compression
if pg_dump -h postgres -U $PGUSER -d $PGDATABASE | gzip > "${BACKUP_FILE}"; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "✓ Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    echo "✗ Backup FAILED!"
    exit 1
fi

# Remove backups older than retention period
DELETED=$(find "${BACKUP_DIR}" -name "lightlane_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "✓ Removed $DELETED backup(s) older than ${RETENTION_DAYS} days"
fi

echo "✓ Backup completed successfully"
echo ""

# Optional: Upload to S3/Backblaze (uncomment and configure)
# aws s3 cp $BACKUP_FILE s3://your-bucket/backups/ 2>&1 | tee -a $BACKUP_DIR/backup.log

echo "[$(date)] Backup complete"
