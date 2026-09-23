<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- Блок выше генерируется тулингом Next.js — не редактировать вручную, правки затрутся. -->

# Работа внутри `web/`

Карта проекта целиком — в [`../CLAUDE.md`](../CLAUDE.md): где что лежит, кто за что отвечает, куда писать доки.
Здесь — только жёсткие правила этой папки.

## Prisma 7

- `new PrismaClient()` без аргумента не компилится — нужен driver-adapter (`@prisma/adapter-libsql`).
  Singleton уже есть: `src/lib/prisma.ts`, новых клиентов не создавать.
- Клиент генерится в `src/generated/prisma` (в `.gitignore`), импорт — `@/generated/prisma/client`.
- `DATABASE_URL` — в `.env`, путь относительный к `web/`: абсолютный `file:`-URL ломает libsql на Windows.
- sqlite не поддерживает enum → строковые поля с комментарием-перечислением в `prisma/schema.prisma`.
- Есть скиллы `prisma-cli`, `prisma-client-api`, `prisma-upgrade-v7` — использовать их, а не гадать по памяти.

## Проверки перед сдачей

```bash
npx tsc --noEmit
```

Линт — `npm run lint`. Тестов в проекте нет, поэтому изменения в UI проверяем в браузере, а не «на глаз».
Дев-сервер (`npm run dev`, порт 3000) часто уже запущен в другом окне — второй в той же папке Next
не поднимет: цепляйся к живому (`preview_start {name:"web-attach"}`). **3000 — только dev, 3001 — только
контейнер `serve`:** на 3001 живёт собранный образ, правок в исходниках он не показывает.
