#!/bin/bash
# Verify backups are running and current
# Run this daily to ensure backup health

set -e

echo "=== Backup Health Check - $(date '+%Y-%m-%d %H:%M:%S') ==="
echo ""

# Configuration
MAX_BACKUP_AGE_HOURS=7  # Backups run every 6 hours, allow 1 hour grace
BACKUPS_DIR="./backups"
ALERT_EMAIL=""  # Set your email for alerts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to send alert (customize as needed)
send_alert() {
    local message="$1"
    echo "🚨 ALERT: $message"
    
    # Optional: Send email
    if [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "LightLane Backup Alert" "$ALERT_EMAIL"
    fi
    
    # Optional: Webhook notification (Slack, Discord, etc.)
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"$message\"}" \
    #   YOUR_WEBHOOK_URL
}

# Check if backups directory exists
if [ ! -d "$BACKUPS_DIR" ]; then
    send_alert "Backups directory does not exist!"
    exit 1
fi

# Check database backups
echo "📦 Database Backups:"
DB_BACKUPS=$(find "$BACKUPS_DIR" -name "lightlane_backup_*.sql.gz" -type f 2>/dev/null | wc -l)

if [ "$DB_BACKUPS" -eq 0 ]; then
    echo -e "${RED}✗ No database backups found!${NC}"
    send_alert "No database backups found in $BACKUPS_DIR"
    exit 1
else
    echo -e "${GREEN}✓ Found $DB_BACKUPS database backup(s)${NC}"
fi

# Check latest database backup age
LATEST_DB_BACKUP=$(find "$BACKUPS_DIR" -name "lightlane_backup_*.sql.gz" -type f -print0 2>/dev/null | xargs -0 ls -t | head -1)

if [ -n "$LATEST_DB_BACKUP" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        BACKUP_TIMESTAMP=$(stat -f %m "$LATEST_DB_BACKUP")
    else
        # Linux
        BACKUP_TIMESTAMP=$(stat -c %Y "$LATEST_DB_BACKUP")
    fi
    
    CURRENT_TIMESTAMP=$(date +%s)
    BACKUP_AGE_SECONDS=$((CURRENT_TIMESTAMP - BACKUP_TIMESTAMP))
    BACKUP_AGE_HOURS=$((BACKUP_AGE_SECONDS / 3600))
    BACKUP_AGE_MINUTES=$(((BACKUP_AGE_SECONDS % 3600) / 60))
    
    BACKUP_SIZE=$(du -h "$LATEST_DB_BACKUP" | cut -f1)
    
    echo "  Latest: $(basename $LATEST_DB_BACKUP)"
    echo "  Size: $BACKUP_SIZE"
    echo "  Age: ${BACKUP_AGE_HOURS}h ${BACKUP_AGE_MINUTES}m"
    
    if [ "$BACKUP_AGE_HOURS" -gt "$MAX_BACKUP_AGE_HOURS" ]; then
        echo -e "${RED}✗ Latest backup is too old! (${BACKUP_AGE_HOURS}h > ${MAX_BACKUP_AGE_HOURS}h)${NC}"
        send_alert "Database backup is ${BACKUP_AGE_HOURS}h old (threshold: ${MAX_BACKUP_AGE_HOURS}h)"
    else
        echo -e "${GREEN}✓ Backup is current${NC}"
    fi
    
    # Warn if backup is suspiciously small
    BACKUP_SIZE_BYTES=$(stat -f %z "$LATEST_DB_BACKUP" 2>/dev/null || stat -c %s "$LATEST_DB_BACKUP")
    if [ "$BACKUP_SIZE_BYTES" -lt 1000 ]; then
        echo -e "${YELLOW}⚠️  Warning: Backup size is very small ($BACKUP_SIZE)${NC}"
    fi
else
    echo -e "${RED}✗ Could not find latest database backup${NC}"
fi

echo ""

# Check upload backups (if they exist)
echo "📁 Upload Backups:"
UPLOAD_BACKUPS=$(find "$BACKUPS_DIR/uploads" -name "uploads_backup_*.tar.gz" -type f 2>/dev/null | wc -l)

if [ "$UPLOAD_BACKUPS" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No upload backups found (may not be configured yet)${NC}"
else
    echo -e "${GREEN}✓ Found $UPLOAD_BACKUPS upload backup(s)${NC}"
    
    LATEST_UPLOAD_BACKUP=$(find "$BACKUPS_DIR/uploads" -name "uploads_backup_*.tar.gz" -type f -print0 2>/dev/null | xargs -0 ls -t | head -1)
    if [ -n "$LATEST_UPLOAD_BACKUP" ]; then
        UPLOAD_SIZE=$(du -h "$LATEST_UPLOAD_BACKUP" | cut -f1)
        echo "  Latest: $(basename $LATEST_UPLOAD_BACKUP)"
        echo "  Size: $UPLOAD_SIZE"
    fi
fi

echo ""

# Check backup log
echo "📋 Backup Log:"
if [ -f "$BACKUPS_DIR/backup.log" ]; then
    LAST_LOG_LINES=$(tail -5 "$BACKUPS_DIR/backup.log")
    echo "$LAST_LOG_LINES"
    
    # Check for errors in recent logs
    RECENT_ERRORS=$(tail -50 "$BACKUPS_DIR/backup.log" | grep -i "error\|failed" | wc -l)
    if [ "$RECENT_ERRORS" -gt 0 ]; then
        echo -e "${RED}✗ Found $RECENT_ERRORS error(s) in recent logs${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No backup log found${NC}"
fi

echo ""

# Check disk space
echo "💾 Disk Space:"
BACKUPS_SIZE=$(du -sh "$BACKUPS_DIR" 2>/dev/null | cut -f1)
echo "  Total backup size: $BACKUPS_SIZE"

DISK_USAGE=$(df -h "$BACKUPS_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_AVAILABLE=$(df -h "$BACKUPS_DIR" | awk 'NR==2 {print $4}')

echo "  Disk usage: ${DISK_USAGE}%"
echo "  Available: $DISK_AVAILABLE"

if [ "$DISK_USAGE" -gt 90 ]; then
    echo -e "${RED}✗ Disk space critically low!${NC}"
    send_alert "Disk space at ${DISK_USAGE}% - backups may fail soon!"
elif [ "$DISK_USAGE" -gt 80 ]; then
    echo -e "${YELLOW}⚠️  Disk space getting low${NC}"
else
    echo -e "${GREEN}✓ Disk space OK${NC}"
fi

echo ""

# Check Docker containers (if available)
if command -v docker &> /dev/null; then
    echo "🐳 Docker Services:"
    
    BACKUP_CONTAINER=$(docker ps --filter "name=lightlane-backup" --format "{{.Status}}" 2>/dev/null)
    if [ -n "$BACKUP_CONTAINER" ]; then
        echo -e "${GREEN}✓ Backup container running: $BACKUP_CONTAINER${NC}"
    else
        echo -e "${RED}✗ Backup container not running!${NC}"
        send_alert "Backup container is not running!"
    fi
    
    DB_CONTAINER=$(docker ps --filter "name=lightlane-db" --format "{{.Status}}" 2>/dev/null)
    if [ -n "$DB_CONTAINER" ]; then
        echo -e "${GREEN}✓ Database container running: $DB_CONTAINER${NC}"
    else
        echo -e "${RED}✗ Database container not running!${NC}"
        send_alert "Database container is not running!"
    fi
fi

echo ""
echo "=== Health Check Complete ==="
echo ""

exit 0
