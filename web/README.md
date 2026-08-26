# LOST — приложение

Операционная система лиги [League of Spirit](https://leagueofspirits.ru): отчёты по матчам из OpenDota,
таблица лиги, справочник команд и игроков, генерация графики к матчам.

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · Prisma 7 + SQLite (libsql-адаптер).

Выкладка на сервер — [`../DEPLOY.md`](../DEPLOY.md) (Docker или голый Node; на PHP-хостинг не ставится).

## Первый запуск на новой машине

Единственное, чего нет в репозитории, — `.env`:

```bash
git clone https://github.com/Beskonechnii/lost-league.git && cd lost-league/web
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

`npm install` сам дёргает `prisma generate` (`postinstall`) — без него `src/generated/prisma` нет и сборка падает.
`migrate deploy` докатывает миграции на пришедшую из репозитория `prisma/dev.db`.

**База ездит в репозитории.** Данные лиги вводятся руками в UI и скриптами из таблицы не восстанавливаются,
поэтому `prisma/dev.db` коммитится. Смержить её нельзя: правим на одной машине за раз и пушим,
на второй — сначала `git pull`, потом работа. Разошлись — побеждает одна из версий, вторая переписывается.

## Запуск

```bash
npm run dev
```

Откроется на http://localhost:3000. Проверка связки с БД: `GET /api/health`.

`.env` (в `.gitignore`, в репозиторий не попадает; шаблон — `.env.example`):

| Переменная | Зачем |
|---|---|
| `DATABASE_URL` | путь к SQLite, **относительный** к `web/` — абсолютный `file:`-URL ломает libsql на Windows |
| `OPENAI_API_KEY` | генерация картинок в `/studio/generate`; без неё остальное приложение работает |

Проверки: `npx tsc --noEmit` и `npm run lint`. Тестов в проекте нет.

## Где что

- **[../CLAUDE.md](../CLAUDE.md)** — карта проекта: где что лежит и кто за что отвечает. Начинать отсюда.
- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** — как устроены подсистемы: модель данных, синк, студия, архив.
- **[../DECISIONS.md](../DECISIONS.md)** — журнал решений с датами: почему сделано именно так.
- **[AGENTS.md](./AGENTS.md)** — правила работы внутри этой папки (Next 16, Prisma 7).
