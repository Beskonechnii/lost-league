// Стенд для прогона лобби (ТЗ 42а): двенадцать тестовых аккаунтов с профилями игроков — по пять
// игроков и одному тренеру на две стороны. Прогон встречи требует двенадцати человек, а заводить
// их руками через анкету и апрув — полчаса кликов на каждый заход.
//
//   npx tsx scripts/seed-lobby-stand.ts            # завести / дозаполнить
//   npx tsx scripts/seed-lobby-stand.ts --remove   # снести стенд
//
// Сама логика живёт в `src/lib/lobby-stand.ts` (ТЗ 42ж): те же аккаунты заводит кнопка «Заполнить
// стенд» внутри комнаты, и держать два одинаковых сида нельзя. Здесь остаётся печать таблицы.
//
// ВАЖНО: `prisma/dev.db` коммитится (CLAUDE.md §«Телефон ↔ компьютер») — стенд уезжает в репозиторий
// вместе с ней. Это осознанно: следующая сессия должна получить те же двенадцать адресов, а не
// заводить их заново. Наружу база не выкладывается, а войти под стендом можно только при `DEV_AS=1`.

import { prisma } from "../src/lib/prisma";
import { removeStand, seedStand } from "../src/lib/lobby-stand";

async function main() {
  if (process.argv.includes("--remove")) {
    const { accounts, players } = await removeStand();
    console.log(`Снесено: аккаунтов ${accounts}, профилей ${players}`);
    return;
  }

  const rows = await seedStand();
  const width = Math.max(...rows.map((r) => r.nickname.length));
  console.log(`Стенд готов: ${rows.length} аккаунтов. Вход — при DEV_AS=1 в web/.env:\n`);
  for (const r of rows) {
    console.log(`  ${r.nickname.padEnd(width)}  id ${String(r.accountId).padStart(4)}  http://localhost:3000/dev/as/${r.accountId}`);
  }
}

main().finally(() => prisma.$disconnect());
