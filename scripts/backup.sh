#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
backup="streamcards-$(date +%Y%m%d-%H%M%S)-${RANDOM}.tar.gz"
docker compose stop streamcards
trap 'docker compose start streamcards' EXIT
docker compose run --rm --no-deps --user 0 -v "$PWD/backups:/backup" --entrypoint tar streamcards -czf "/backup/$backup" -C /app/data .
echo "Back-up: backups/$backup"
