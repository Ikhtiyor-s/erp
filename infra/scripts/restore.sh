#!/usr/bin/env bash
#
# Aniq ERP — restore from a SQL backup created by backup.sh.
#
# Usage:
#   ./restore.sh /path/to/erp-2026-06-22.sql.gz
#   ./restore.sh                                    # interactive picker
#
# DANGER: This DROPS and re-creates the schema. Take a fresh backup first!
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/aniq-erp}"
PG_CONTAINER="${POSTGRES_CONTAINER:-erp-postgres}"
PG_DB="${POSTGRES_DB:-erp}"
PG_USER="${POSTGRES_USER:-erp}"

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
    echo "Mavjud backuplar (so'nggi 10):"
    ls -1tr "$BACKUP_DIR"/daily/*.sql.gz 2>/dev/null | tail -10 | nl
    read -rp "Faylni tanlang (yo'l): " DUMP
fi

if [ ! -f "$DUMP" ]; then
    echo "Fayl topilmadi: $DUMP" >&2
    exit 1
fi

echo "Tiklanmoqda: $DUMP"
echo "DB: $PG_DB (container: $PG_CONTAINER)"
read -rp "Davom etilsinmi? Eski ma'lumotlar O'CHIRILADI (yes/NO): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Bekor qilindi"
    exit 0
fi

# Take a safety backup first
SAFETY="$BACKUP_DIR/pre-restore-$(date -u +%Y-%m-%dT%H-%M-%SZ).sql.gz"
echo "Avtomatik xavfsizlik backup'i: $SAFETY"
mkdir -p "$BACKUP_DIR"
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" \
    --no-owner --no-acl | gzip -9 > "$SAFETY"

# Restore
gunzip -c "$DUMP" | docker exec -i "$PG_CONTAINER" \
    psql -U "$PG_USER" -d "$PG_DB" --quiet

echo "Restore tugadi. Xavfsizlik backup: $SAFETY"
