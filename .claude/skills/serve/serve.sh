#!/usr/bin/env bash
# Публикация LOST наружу одной командой: прод-контейнер + Cloudflare quick tunnel.
#
# Печатает публичный https-адрес. Быстрый туннель бесплатный и без домена, но адрес
# случайный и меняется при каждом перезапуске cloudflared — это норма для этого варианта.
# Постоянный сервер требует включённого Mac, живого контейнера и процесса cloudflared.
set -euo pipefail

PORT=3001  # хостовый порт контейнера; 3000 занят dev-сервером
CF="$HOME/.local/bin/cloudflared"

# web/ вычисляем от места скрипта: .claude/skills/serve/serve.sh → ../../../web
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SKILL_DIR/../../../web" && pwd)"
RUN_DIR="$WEB_DIR/.cache"          # в .gitignore — сюда pid/лог/адрес туннеля
LOG="$RUN_DIR/tunnel.log"
PIDFILE="$RUN_DIR/tunnel.pid"
mkdir -p "$RUN_DIR"

# 1. cloudflared — поставить официальный бинарник, если его ещё нет
if [ ! -x "$CF" ]; then
  echo "→ ставлю cloudflared в $CF"
  mkdir -p "$(dirname "$CF")"
  case "$(uname -m)" in
    arm64)  f=cloudflared-darwin-arm64.tgz ;;
    x86_64) f=cloudflared-darwin-amd64.tgz ;;
    *) echo "неизвестная архитектура $(uname -m)"; exit 1 ;;
  esac
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/$f" "https://github.com/cloudflare/cloudflared/releases/latest/download/$f"
  tar xzf "$tmp/$f" -C "$tmp"
  mv "$tmp/cloudflared" "$CF"
  chmod +x "$CF"
  rm -rf "$tmp"
fi

# 2. контейнер — всегда пересобрать из текущего кода и поднять.
# Пересборка обязательна: иначе туннель отдаёт старый образ, а свежие коммиты
# в него не попадают (образ — снимок кода на момент прошлой сборки, не рабочая папка).
cd "$WEB_DIR"
echo "→ пересобираю контейнер (docker compose up -d --build)"
docker compose up -d --build
for _ in $(seq 1 20); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/health" 2>/dev/null && break
  sleep 2
done
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/health" 2>/dev/null \
  || { echo "контейнер не отвечает на /api/health — смотри docker compose logs web"; exit 1; }
echo "✓ контейнер живой на :$PORT"

# 3. туннель — снять старый, поднять новый
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
fi
pkill -f "cloudflared tunnel --url http://localhost:$PORT" 2>/dev/null || true
: > "$LOG"
nohup "$CF" tunnel --url "http://localhost:$PORT" --no-autoupdate >"$LOG" 2>&1 &
echo $! > "$PIDFILE"
disown 2>/dev/null || true

# 4. вытащить публичный адрес из лога
URL=""
for _ in $(seq 1 20); do
  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "не удалось получить адрес; последние строки лога ($LOG):"
  tail -5 "$LOG"
  exit 1
fi
echo "$URL" > "$RUN_DIR/tunnel.url"
echo ""
echo "🌐 $URL"
echo "   (остановить: .claude/skills/serve/stop.sh — контейнер продолжит работать)"
