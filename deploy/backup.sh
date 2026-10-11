#!/usr/bin/env bash
set -euo pipefail

# Copy the live SQLite file out of the Compose volume.
# Usage: ./deploy/backup.sh [destination-dir]

DEST="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"
CONTAINER="$(docker compose ps -q app)"
if [ -z "$CONTAINER" ]; then
  echo "app container is not running" >&2
  exit 1
fi
docker compose exec -T app node --input-type=module -e "
  import { copyFileSync } from 'node:fs';
  copyFileSync(process.env.DB_PATH || '/app/data/quotelite.sqlite', '/tmp/quotelite.backup.sqlite');
"
docker cp "$CONTAINER:/tmp/quotelite.backup.sqlite" "$DEST/quotelite-$STAMP.sqlite"
echo "wrote $DEST/quotelite-$STAMP.sqlite"
