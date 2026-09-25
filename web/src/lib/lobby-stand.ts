import { prisma } from "./prisma";
import { ROLES } from "./roles";

// Стенд лобби (ТЗ 42а + 42ж): двенадцать тестовых аккаунтов — по пять игроков и тренеру на две
// стороны. До 42ж всё это жило в `scripts/seed-lobby-stand.ts`, но кнопка «Заполнить стенд»
// заводит те же аккаунты ПРЯМО ИЗ ПРИЛОЖЕНИЯ: база контейнера живёт на томе (DEPLOY-MANUAL §9) и
// стенда может не содержать вовсе, а запустить там tsx-скрипт в момент прогона некому. Поэтому
// логика здесь, а скрипт стал тонкой обёрткой, которая её зовёт и печатает таблицу.
//
// Замок — переменная `LOBBY_STAND`, а не `NODE_ENV`: ребята тестируют платформу через туннель, то
// есть на ПРОД-сборке, и стенд обязан работать именно там. Зато без флага его нет совсем, и
// вдобавок он требует права `tools` (проверяется в `lobby.ts`).
//
// Пометки `server-only` здесь нет намеренно: файл тянет и tsx-скрипт `scripts/seed-lobby-stand.ts`,
// а `server-only` в обычном node-процессе не резолвится вовсе.

/** Стенд включён. Флаг читается в рантайме — на проде он тоже действует (ТЗ 42ж §4). */
export const standOn = (): boolean => (process.env.LOBBY_STAND ?? "").trim() === "1";

const SIDES = [
  { key: "a", title: "Стенд A", side: 0 as const },
  { key: "b", title: "Стенд B", side: 1 as const },
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

export type StandSeat = {
  slug: string;
  email: string;
  nickname: string;
  role: string;
  /** За какую сторону этот бот садится кнопкой «Заполнить стенд». */
  side: 0 | 1;
  coach: boolean;
};

export const STAND_SEATS: StandSeat[] = SIDES.flatMap((s) =>
  SEATS.map((seat) => ({
    slug: `stand-${s.key}${seat.suffix}`,
    email: `stand-${s.key}${seat.suffix}@lost.test`,
    nickname: `${s.title} · ${roleShort(seat.role)}`,
    role: seat.role,
    side: s.side,
    coach: seat.role === "coach",
  })),
);

export type StandRow = { email: string; nickname: string; accountId: number; playerId: number };

/**
 * Завести (или дозаполнить) стенд. Идемпотентно: ключ аккаунта — почта, профиля — слаг, повторный
 * вызов ничего не дублирует. Боевых ростеров не касается — пишет ровно двенадцать слагов выше.
 */
export async function seedStand(): Promise<StandRow[]> {
  const rows: StandRow[] = [];

  for (const seat of STAND_SEATS) {
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

    rows.push({ email: seat.email, nickname: seat.nickname, accountId: acc.id, playerId: player.id });
  }

  return rows;
}

/** Снести стенд. Сначала аккаунты, потом профили: связь `UserAccount.player` гасится SetNull, и
 *  обратный порядок оставил бы двенадцать осиротевших входов. */
export async function removeStand(): Promise<{ accounts: number; players: number }> {
  const emails = STAND_SEATS.map((s) => s.email);
  const slugs = STAND_SEATS.map((s) => s.slug);
  const accounts = await prisma.userAccount.deleteMany({ where: { email: { in: emails } } });
  const players = await prisma.player.deleteMany({ where: { slug: { in: slugs } } });
  return { accounts: accounts.count, players: players.count };
}

/**
 * Аккаунты стенда, которые сейчас есть в базе. Признак бота — ПОЧТА (ТЗ 42ж §3), нового поля у
 * аккаунта не заводим: стенд — это временные записи прогона, а не вид пользователя.
 */
export async function standAccounts(): Promise<Map<number, StandSeat>> {
  const rows = await prisma.userAccount.findMany({
    where: { email: { in: STAND_SEATS.map((s) => s.email) } },
    select: { id: true, email: true },
  });
  const byEmail = new Map(STAND_SEATS.map((s) => [s.email, s]));
  // Почта у аккаунта необязательна (вход бывает и телеграмом) — без неё это заведомо не стенд.
  return new Map(rows.flatMap((r) => {
    const seat = r.email === null ? undefined : byEmail.get(r.email);
    return seat ? [[r.id, seat] as const] : [];
  }));
}
