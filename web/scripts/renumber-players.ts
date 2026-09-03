// Перенумеровать Player.id — сплошным рядом с 1, с «именными» местами в начале.
//
// Зачем: id профиля живёт в адресе (/roster/players/<id>), а исторический автоинкремент начинался
// с 21 и шёл вперемешку. Порядок должен читаться: 1 — Стас, 2 — Sett, 3 — Estacada, дальше все
// остальные подряд в текущем порядке id.
//
//   npx tsx scripts/renumber-players.ts --dry   # показать карту переноса
//   npx tsx scripts/renumber-players.ts         # переписать
//
// Идемпотентно: повторный запуск даёт ту же карту (порядок «остальных» после первого прогона уже
// такой, каким его строит скрипт). Ссылки на игрока правятся все разом:
//   • внешние ключи — MatchStat, RosterSpot, UserAccount (playerId и claimId), ProfileEditRequest,
//     MatchRequest.proposedByPlayerId;
//   • ссылки без FK — PointsEntry (subjectType='player'), PlayerDistinct, QuizResponse;
//   • id внутри JSON — DraftSession.payload (капитаны, пики, локи, участники).
// FK на время переноса выключены: и родитель, и дети переписываются здесь руками, а с включённым
// ON UPDATE CASCADE правка Player.id применилась бы к детям вторым разом поверх нашей.
//
// Перед запуском остановить dev-сервер: база правится в обход Prisma.

import { createClient } from "@libsql/client";

/** Кто где стоит: слаг → номер. Остальные встают следом в текущем порядке id. */
const PINNED: Record<string, number> = { bsk: 1, sett: 2, estacada: 3 };

/** Сдвиг, на который уезжают все id первым проходом: выше любого реального, поэтому не сталкивается. */
const OFFSET = 1_000_000;

/** Где лежат ссылки на игрока: таблица, колонка и условие, если ссылка не единственная в таблице. */
const REFS: { table: string; column: string; where?: string }[] = [
  { table: "MatchStat", column: "playerId" },
  { table: "RosterSpot", column: "playerId" },
  { table: "UserAccount", column: "playerId" },
  { table: "UserAccount", column: "claimId" },
  { table: "ProfileEditRequest", column: "playerId" },
  { table: "MatchRequest", column: "proposedByPlayerId" },
  { table: "QuizResponse", column: "playerId" },
  { table: "PlayerDistinct", column: "aId" },
  { table: "PlayerDistinct", column: "bId" },
  { table: "PointsEntry", column: "subjectId", where: "subjectType = 'player'" },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const db = createClient({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });

  const players = (await db.execute("SELECT id, slug, nickname FROM Player ORDER BY id")).rows as unknown as {
    id: number;
    slug: string;
    nickname: string;
  }[];

  // Сначала именные места, потом все остальные подряд — так карта не зависит от того, сколько раз запускали.
  const map = new Map<number, number>();
  for (const [slug, no] of Object.entries(PINNED)) {
    const p = players.find((x) => x.slug === slug);
    if (!p) throw new Error(`Нет игрока со слагом «${slug}» — карта переноса неполная, ничего не трогаю`);
    map.set(p.id, no);
  }
  let next = Object.keys(PINNED).length + 1;
  for (const p of players) if (!map.has(p.id)) map.set(p.id, next++);

  for (const p of players) console.log(`${p.id} → ${map.get(p.id)}\t${p.nickname}`);
  if (dry) return;

  await db.execute("PRAGMA foreign_keys = OFF");

  // Временная карта в самой базе: 190 строк удобнее гонять подзапросом, чем клеить CASE на всю таблицу.
  await db.execute("DROP TABLE IF EXISTS _player_map");
  await db.execute("CREATE TEMP TABLE _player_map (oldId INTEGER PRIMARY KEY, newId INTEGER NOT NULL)");
  await db.batch(
    [...map].map(([oldId, newId]) => ({
      sql: "INSERT INTO _player_map (oldId, newId) VALUES (?, ?)",
      args: [oldId, newId],
    })),
    "write",
  );

  // Два прохода: сперва все ссылки уезжают за OFFSET, потом садятся на новые номера. Иначе
  // уникальные индексы (UserAccount.playerId, RosterSpot по составу, MatchStat по карте) ловят
  // столкновение на полпути — sqlite проверяет их построчно, а не в конце.
  const targets = [{ table: "Player", column: "id" }, ...REFS];
  for (const { table, column, where } of targets) {
    const cond = where ? ` AND ${where}` : "";
    await db.execute(`UPDATE ${table} SET ${column} = ${column} + ${OFFSET} WHERE ${column} IS NOT NULL${cond}`);
    await db.execute(
      `UPDATE ${table} SET ${column} = (SELECT newId FROM _player_map WHERE oldId = ${table}.${column} - ${OFFSET})
       WHERE ${column} >= ${OFFSET}${cond}`,
    );
  }

  // Драфт держит id игроков внутри JSON — там своих индексов нет, правим значениями.
  const remap = (id: number) => map.get(id) ?? id;
  const sessions = (await db.execute("SELECT id, payload FROM DraftSession")).rows as unknown as {
    id: number;
    payload: string;
  }[];
  for (const s of sessions) {
    const state = JSON.parse(s.payload);
    if (Array.isArray(state.participants)) state.participants = state.participants.map(remap);
    for (const t of state.teams ?? []) {
      if (typeof t.captainId === "number") t.captainId = remap(t.captainId);
      if (Array.isArray(t.picks)) t.picks = t.picks.map(remap);
      if (Array.isArray(t.locked)) t.locked = t.locked.map(remap);
    }
    await db.execute({ sql: "UPDATE DraftSession SET payload = ? WHERE id = ?", args: [JSON.stringify(state), s.id] });
  }

  // Автоинкремент помнит максимум сам по себе — вернём его к новому ряду, иначе следующий игрок
  // получит id из старой сотни и разорвёт нумерацию.
  await db.execute(`UPDATE sqlite_sequence SET seq = ${players.length} WHERE name = 'Player'`);

  await db.execute("DROP TABLE IF EXISTS _player_map");
  const broken = await db.execute("PRAGMA foreign_key_check");
  await db.execute("PRAGMA foreign_keys = ON");

  if (broken.rows.length) {
    console.error("Битые ссылки после переноса:", broken.rows);
    process.exitCode = 1;
    return;
  }
  console.log(`\nГотово: ${players.length} игроков, id 1..${players.length}, висячих ссылок нет.`);
}

main();
