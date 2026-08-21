#!/usr/bin/env bash
#
# Aniq ERP — PostgreSQL backup script.
#
# Daily dump with rotation:
#   - kunlik: oxirgi 7 ta
#   - haftalik (yakshanba): oxirgi 4 ta
#   - oylik (oy boshi): oxirgi 12 ta
#
# Usage (cron):
#   0 3 * * * /opt/aniq-erp/infra/scripts/backup.sh
#
# Environment:
#   BACKUP_DIR        — backup root (default /var/backups/aniq-erp)
#   POSTGRES_CONTAINER— docker container name (default erp-postgres)
#   POSTGRES_DB       — DB name (default erp)
#   POSTGRES_USER     — DB user (default erp)
#   S3_BUCKET         — optional S3 bucket for offsite copy (uses aws cli)
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/aniq-erp}"
PG_CONTAINER="${POSTGRES_CONTAINER:-erp-postgres}"
PG_DB="${POSTGRES_DB:-erp}"
PG_USER="${POSTGRES_USER:-erp}"

DATE=$(date -u +%Y-%m-%d)
WEEKDAY=$(date -u +%u)   # 1..7 (Mon=1, Sun=7)
DAY_OF_MONTH=$(date -u +%d)

DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
MONTHLY_DIR="$BACKUP_DIR/monthly"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"

DUMP_FILE="$DAILY_DIR/${PG_DB}-${DATE}.sql.gz"

echo "[$(date -u +%FT%TZ)] Starting backup → $DUMP_FILE"
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" \
    --no-owner --no-acl --clean --if-exists \
    | gzip -9 > "$DUMP_FILE"

SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "[$(date -u +%FT%TZ)] Daily backup OK ($SIZE)"

# --- Promotion ---
if [ "$WEEKDAY" = "7" ]; then
    cp "$DUMP_FILE" "$WEEKLY_DIR/${PG_DB}-${DATE}.sql.gz"
    echo "  → promoted to weekly"
fi
if [ "$DAY_OF_MONTH" = "01" ]; then
    cp "$DUMP_FILE" "$MONTHLY_DIR/${PG_DB}-${DATE}.sql.gz"
    echo "  → promoted to monthly"
fi

# --- Rotation ---
find "$DAILY_DIR"   -name "*.sql.gz" -mtime +7  -delete
find "$WEEKLY_DIR"  -name "*.sql.gz" -mtime +28 -delete
find "$MONTHLY_DIR" -name "*.sql.gz" -mtime +365 -delete

# --- Optional S3 upload ---
if [ -n "${S3_BUCKET:-}" ]; then
    aws s3 cp "$DUMP_FILE" "s3://$S3_BUCKET/aniq-erp/daily/" --storage-class STANDARD_IA
    if [ "$DAY_OF_MONTH" = "01" ]; then
        aws s3 cp "$DUMP_FILE" "s3://$S3_BUCKET/aniq-erp/monthly/" \
            --storage-class GLACIER
    fi
    echo "  → uploaded to S3"
fi

echo "[$(date -u +%FT%TZ)] Backup complete"
