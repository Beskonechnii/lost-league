#!/usr/bin/env bash
# Снять публичный туннель LOST. Контейнер не трогаем — сайт остаётся на localhost:3001.
set -euo pipefail

PORT=3001  # хостовый порт контейнера; 3000 занят dev-сервером
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SKILL_DIR/../../../web" && pwd)"
RUN_DIR="$WEB_DIR/.cache"
PIDFILE="$RUN_DIR/tunnel.pid"

if [ -f "$PIDFILE" ]; then
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
fi
pkill -f "cloudflared tunnel --url http://localhost:$PORT" 2>/dev/null || true
rm -f "$PIDFILE" "$RUN_DIR/tunnel.url"
echo "✓ туннель снят (контейнер работает; чтобы погасить и его — docker compose down в web/)"
