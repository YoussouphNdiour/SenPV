#!/bin/bash
set -e

BACKUP_DIR="/backups/senpv"
DATE=$(date +%Y%m%d_%H%M)
mkdir -p "$BACKUP_DIR"

# shellcheck disable=SC1091
source .env

# Backup PostgreSQL
echo "Backup base de données..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup uploads
echo "Backup uploads..."
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /var/lib/docker/volumes/ senpv_uploads

# Keep only last 7 backups
ls -t "$BACKUP_DIR"/db_*.sql.gz | tail -n +8 | xargs -r rm
ls -t "$BACKUP_DIR"/uploads_*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup terminé : $BACKUP_DIR"
