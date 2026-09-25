// Стенд для прогона лобби (ТЗ 42а): двенадцать тестовых аккаунтов с профилями игроков — по пять
// игроков и одному тренеру на две стороны. Прогон встречи требует двенадцати человек, а заводить
// их руками через анкету и апрув — полчаса кликов на каждый заход.
//
//   npx tsx scripts/seed-lobby-stand.ts            # завести / дозаполнить
//   npx tsx scripts/seed-lobby-stand.ts --remove   # снести стенд
//
// Идемпотентно: ключ аккаунта — почта, профиля — слаг, повторный запуск только дозаполняет и
// печатает ту же таблицу. Боевых ростеров скрипт не касается: он пишет ровно те двенадцать слагов,
// что перечислены ниже, и ничего больше.
//
// ВАЖНО: `prisma/dev.db` коммитится (CLAUDE.md §«Телефон ↔ компьютер») — стенд уезжает в репозиторий
// вместе с ней. Это осознанно: следующая сессия должна получить те же двенадцать адресов, а не
// заводить их заново. Наружу база не выкладывается, а войти под стендом можно только при `DEV_AS=1`.

import { prisma } from "../src/lib/prisma";
import { ROLES } from "../src/lib/roles";

const SIDES = [
  { key: "a", title: "Стенд A" },
  { key: "b", title: "Стенд B" },
] as const;

// Пять позиций плюс тренер — ровно состав стороны лобби (лимит 5 + 1, ТЗ 42в).
const SEATS = [
  { suffix: "1", role: "carry" },
  { suffix: "2", role: "mid" },
  { suffix: "3", role: "offlane" },
  { suffix: "4", role: "soft-support" },
  { suffix: "5", role: "hard-support" },
  { suffix: "coach", role: "coach" },
] as const;

const roleShort = (key: string) => ROLES.find((r) => r.key === key)?.short ?? key;

type Seat = { slug: string; email: string; nickname: string; role: string };

const seats: Seat[] = SIDES.flatMap((side) =>
  SEATS.map((seat) => ({
    slug: `stand-${side.key}${seat.suffix}`,
    email: `stand-${side.key}${seat.suffix}@lost.test`,
    nickname: `${side.title} · ${roleShort(seat.role)}`,
    role: seat.role,
  })),
);

async function remove() {
  // Сначала аккаунты, потом профили: связь `UserAccount.player` гасится SetNull, и обратный
  // порядок оставил бы двенадцать осиротевших входов.
  const accounts = await prisma.userAccount.deleteMany({ where: { email: { in: seats.map((s) => s.email) } } });
  const players = await prisma.player.deleteMany({ where: { slug: { in: seats.map((s) => s.slug) } } });
  console.log(`Снесено: аккаунтов ${accounts.count}, профилей ${players.count}`);
}

async function seed() {
  const rows: { nickname: string; accountId: number }[] = [];

  for (const seat of seats) {
    // Аккаунт сразу одобренный (`status: "active"`): в список комнат и в состав пускают только
    // одобренного игрока лиги (`lobby.ts:isLeaguePlayer`), а проходить стендом воронку регистрации
    // незачем — она проверяется своим ТЗ. Профиль при этом `verified: false` — доступ в лобби это
    // не трогает, зато двенадцать «Стендов» не всплывают в поиске, на публичных карточках и в
    // sitemap (`roster-data.ts`, `search.ts`, `app/sitemap.ts` фильтруют по этому флагу).
    const profile = { nickname: seat.nickname, mainRoles: seat.role, verified: false };
    const player = await prisma.player.upsert({
      where: { slug: seat.slug },
      create: { slug: seat.slug, ...profile },
      update: profile,
    });

    const account = { name: seat.nickname, status: "active", playerId: player.id };
    const acc = await prisma.userAccount.upsert({
      where: { email: seat.email },
      create: { email: seat.email, ...account },
      update: account,
    });

    rows.push({ nickname: seat.nickname, accountId: acc.id });
  }

  const width = Math.max(...rows.map((r) => r.nickname.length));
  console.log(`Стенд готов: ${rows.length} аккаунтов. Вход — при DEV_AS=1 в web/.env:\n`);
  for (const r of rows) {
    console.log(`  ${r.nickname.padEnd(width)}  id ${String(r.accountId).padStart(4)}  http://localhost:3000/dev/as/${r.accountId}`);
  }
}

async function main() {
  if (process.argv.includes("--remove")) return remove();
  return seed();
}

main().finally(() => prisma.$disconnect());
