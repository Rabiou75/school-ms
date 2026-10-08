#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/school-ms/backups}"
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%Y-%m-%d_%H-%M)
FILE="$BACKUP_DIR/school_ms_$STAMP.dump"
COMPOSE="/opt/school-ms/docker/docker-compose.prod.yml"

docker compose -f "$COMPOSE" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-school}" -Fc "${POSTGRES_DB:-school_ms}" > "$FILE"

# Keep 30 days
find "$BACKUP_DIR" -name "school_ms_*.dump" -mtime +30 -delete

# Optional: sync off-site
# aws s3 cp "$FILE" s3://your-bucket/school-ms/

echo "Backup complete: $FILE"
