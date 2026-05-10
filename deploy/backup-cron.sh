#!/bin/bash
# Täglich per cron: 0 2 * * * /opt/trustello/deploy/backup-cron.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/trustello/backups
mkdir -p $BACKUP_DIR

docker compose -f /opt/trustello/deploy/docker-compose.prod.yml exec -T postgres \
  pg_dump -U trustello trustello_prod | gzip > $BACKUP_DIR/trustello_$TIMESTAMP.sql.gz

# Alte Backups löschen (>30 Tage)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
echo "Backup erstellt: trustello_$TIMESTAMP.sql.gz"
