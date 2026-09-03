#!/usr/bin/env bash
# Гасит локальные dev-серверы LOST: процессы `next dev` / `next-server` этого репозитория
# и всех, кто слушает порты 3000–3010. Базу не трогает — sqlite пишет на диск сразу,
# потерять при этом нечего.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
killed=0

# 1. Процессы next из этого репозитория (по строке запуска).
for pid in $(pgrep -f "$ROOT/web/node_modules/.bin/next dev" 2>/dev/null) $(pgrep -f "next-server" 2>/dev/null); do
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  case "$cwd" in
    "$ROOT"*) kill "$pid" 2>/dev/null && { echo "остановлен next (pid $pid)"; killed=$((killed+1)); } ;;
  esac
done

# 2. Всё, что осталось висеть на портах 3000–3010.
for port in $(seq 3000 3010); do
  for pid in $(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    kill "$pid" 2>/dev/null && { echo "освобождён порт $port (pid $pid)"; killed=$((killed+1)); }
  done
done

sleep 1
# Кто не ушёл по-хорошему — добиваем.
for port in $(seq 3000 3010); do
  for pid in $(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    kill -9 "$pid" 2>/dev/null && echo "принудительно снят pid $pid (порт $port)"
  done
done

[ "$killed" -eq 0 ] && echo "нечего гасить — dev-серверов не найдено"
echo "готово"
