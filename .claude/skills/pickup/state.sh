#!/usr/bin/env bash
# Состояние проекта одной командой: ветка, незакоммиченное, последние коммиты, верхняя запись
# журнала и незакрытые ТЗ. Зачем: раньше старт сессии читал WORKLOG + BACKLOG + MVP + MAP
# заново каждый раз — это десятки тысяч токенов на то, что укладывается в один экран.
set -u
cd "$(dirname "$0")/../../.." || exit 1

echo "═══ ВЕТКА ═══"
git fetch origin --prune -q 2>/dev/null
git status -sb | head -1
echo
echo "═══ НЕЗАКОММИЧЕННОЕ ═══"
git status --porcelain | head -20
[ -z "$(git status --porcelain)" ] && echo "чисто"
# dev.db в списке — предупредить отдельно: бинарник не мержится
git status --porcelain | grep -q 'web/prisma/dev.db' && echo "!! тронута база web/prisma/dev.db — не терять, не мержить"
echo
echo "═══ ПОСЛЕДНИЕ КОММИТЫ ═══"
git log --oneline -3
echo
echo "═══ ВЕТКИ claude/* без мержа ═══"
git branch -r --no-merged origin/main 2>/dev/null | grep 'claude/' || echo "нет"
echo
echo "═══ ЖУРНАЛ: верхняя запись ═══"
awk 'NR>1 && /^## / {c++} c==1 {print} c>1 {exit}' WORKLOG.md | head -25
echo
echo "═══ ТЗ НЕ ЗАКРЫТЫ ═══"
for f in docs/tasks/*.md; do
  case "$f" in */_TEMPLATE.md) continue;; esac
  s=$(grep -m1 '^\*\*Статус:\*\*' "$f" | sed 's/^\*\*Статус:\*\* *//')
  case "$s" in done*) continue;; esac
  printf '%-8s %-46s %s\n' "${s%% *}" "$(basename "$f")" "$(echo "${s#* · }" | cut -c1-64)"
done
echo
echo "═══ ТЗ ВСЕГО ═══"
grep -h '^\*\*Статус:\*\*' docs/tasks/*.md | grep -v 'draft | ready' | sed 's/^\*\*Статус:\*\* *//;s/ .*//' | sort | uniq -c
