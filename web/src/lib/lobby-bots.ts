import "server-only";
import { prisma } from "./prisma";
import { STAND_SEATS, seedStand } from "./lobby-stand";
import { autoHero, movesDone } from "./lobby-turn";
import { assignsOf, currentTeam, teamPicksOf, type TeamIdx } from "./fearless";
import { SIDE_COACHES, SIDE_PLAYERS, captainOf, sidePlayers, type LobbyRoom } from "./lobby-room";
import type { Intent } from "./lobby";

// Боты стенда (ТЗ 42ж): прогон встречи требует двенадцати человек, а проверить путь надо одному и
// сейчас. Кнопка «Заполнить стенд» сажает нажавшего капитаном стороны A, остальные места занимают
// аккаунты стенда 42а — и дальше сторона, у которой капитан бот, ходит сама.
//
// Бот — это НЕ второй драфт-движок: он присылает те же намерения, что живой капитан, через тот же
// `applyIntent`. Поэтому «боту можно то, чего нельзя человеку» здесь невозможно по устройству: все
// проверки прав и состояния остаются одни на всех, а бот — просто быстрый участник.
//
// Признак бота — почта стенда (`stand-*@lost.test`), нового поля у аккаунта нет: стенд это записи
// прогона, а не вид пользователя.

/** Ход бота: от чьего имени и что именно он шлёт. Исполняет его планировщик в `lobby.ts`. */
export type BotMove = { accountId: number; intent: Intent };

/**
 * Посадить стенд в комнату (ТЗ 42ж §2). Аккаунты заводятся тут же, если их в базе нет: база
 * контейнера живёт на томе и стенда может не содержать, а запустить там скрипт некому.
 *
 * Повторное нажатие ничего не ломает: занятые места считаются, и второй раз садиться уже некуда.
 * Возвращает текст отказа или null.
 */
export async function fillStand(
  lobbyId: number,
  viewer: { accountId: number; playerId: number | null },
): Promise<string | null> {
  const rows = await seedStand();
  const byEmail = new Map(rows.map((r) => [r.email, r]));
  const members = await prisma.lobbyMember.findMany({
    where: { lobbyId },
    select: { accountId: true, side: true, role: true, captain: true },
  });

  type Seat = { accountId: number; playerId: number | null; side: TeamIdx; role: "player" | "coach"; captain: boolean };
  // Нажавший — капитан стороны A: стенд заводится ради того, чтобы играть против него.
  const plan: Seat[] = [{ accountId: viewer.accountId, playerId: viewer.playerId, side: 0, role: "player", captain: true }];

  /** Сколько мест этого вида уже занято: и теми, кто в комнате, и теми, кого сажаем сейчас. */
  const taken = (side: TeamIdx, role: "player" | "coach") =>
    members.filter((m) => m.side === side && m.role === role && !plan.some((p) => p.accountId === m.accountId)).length +
    plan.filter((p) => p.side === side && p.role === role).length;

  // Капитан стороны B уже живой — бот её не занимает и, стало быть, за неё не ходит (ТЗ 42ж §3).
  const humanCapB = members.some((m) => m.side === 1 && m.role === "player" && m.captain);

  for (const seat of STAND_SEATS) {
    const row = byEmail.get(seat.email);
    if (!row || row.accountId === viewer.accountId) continue;
    // Тренер стороне A не нужен: её ведёт живой капитан, а лишний бот только занимает лунку.
    if (seat.side === 0 && seat.coach) continue;
    const role = seat.coach ? "coach" : "player";
    if (taken(seat.side, role) >= (seat.coach ? SIDE_COACHES : SIDE_PLAYERS)) continue;
    plan.push({
      accountId: row.accountId,
      playerId: row.playerId,
      side: seat.side,
      role,
      captain: seat.side === 1 && role === "player" && !humanCapB && !plan.some((p) => p.side === 1 && p.captain),
    });
  }

  await prisma.$transaction(async (tx) => {
    // Капитанство стороны A переезжает к нажавшему: двух капитанов у стороны не бывает даже на
    // миллисекунду — по капитану сервер решает, чей ход и кто жмёт «Готов».
    await tx.lobbyMember.updateMany({ where: { lobbyId, side: 0, captain: true }, data: { captain: false, ready: false } });
    for (const p of plan) {
      const data = { side: p.side, role: p.role, captain: p.captain, ready: false, playerId: p.playerId, joinedAt: new Date() };
      await tx.lobbyMember.upsert({
        where: { lobbyId_accountId: { lobbyId, accountId: p.accountId } },
        update: data,
        create: { lobbyId, accountId: p.accountId, ...data },
      });
    }
  });

  return null;
}

/**
 * Что бот сделал бы сейчас — ОДНО действие на вызов. Ходить дальше его заставит следующий снимок:
 * так цепочка сама останавливается там, где ботам делать нечего, и не требует отдельного счётчика.
 */
export function nextBotMove(room: LobbyRoom, isBot: (accountId: number) => boolean): BotMove | null {
  if (room.status === "gather") {
    for (const side of [0, 1] as TeamIdx[]) {
      const cap = captainOf(room, side);
      if (!cap || !isBot(cap.accountId) || cap.ready) continue;
      if (sidePlayers(room, side).length < SIDE_PLAYERS) continue;
      return { accountId: cap.accountId, intent: { kind: "ready", value: true } };
    }
    return null;
  }

  if (room.status === "coin" && room.coin) {
    const first = room.coin.block === null; // первым блок выбирает победитель броска
    const turn = (first ? room.coin.winner : 1 - room.coin.winner) as TeamIdx;
    const cap = captainOf(room, turn);
    if (!cap || !isBot(cap.accountId)) return null;
    // Свободный блок бот берёт себе: выбирать «в пользу соперника» он не умеет и не должен.
    const block = first || room.coin.block === "order" ? "side" : "order";
    return { accountId: cap.accountId, intent: { kind: "coin", block, value: turn } };
  }

  if (room.status !== "draft" || !room.state) return null;
  const state = room.state;

  const team = currentTeam(state);
  if (team !== null) {
    const cap = captainOf(room, team);
    if (!cap || !isBot(cap.accountId)) return null;
    // Тот же случайный выбор из доступных, что и у автохода по истечении времени: отдельного
    // «искусственного интеллекта драфта» ТЗ не просит, а предсказуемый бот читался бы подсказкой.
    const heroId = autoHero(state);
    return heroId === null ? null : { accountId: cap.accountId, intent: { kind: "pick", heroId, at: movesDone(state) } };
  }

  // Стадия назначения: боты разбирают своих героев сами — в том числе на стороне человека
  // (ТЗ 42ж §3), иначе карта не закроется, пока живой игрок не нажмёт девять раз за них.
  const assigns = assignsOf(state, state.current);
  const busy = new Set(assigns.map((a) => a.heroId));
  const done = new Set(assigns.map((a) => a.memberId));
  for (const m of room.members) {
    if (m.role !== "player" || m.side === null || done.has(m.id) || !isBot(m.accountId)) continue;
    const free = teamPicksOf(state, state.current, m.side).find((h) => !busy.has(h));
    if (free !== undefined) return { accountId: m.accountId, intent: { kind: "assign", heroId: free, memberId: null } };
  }
  return null;
}
