import "server-only";
import { prisma } from "./prisma";
import { localHeroes } from "./dota-constants";
import {
  applyPick,
  currentStep,
  currentTeam,
  isSelectable,
  FEARLESS_VERSION,
  type FearlessState,
  type TeamIdx,
} from "./fearless";

// Ход драфта в комнате: чьи секунды идут, когда они кончились и что тогда происходит (ТЗ 22б).
//
// Время считает СЕРВЕР, а не вкладка. На админском борде часы живут в браузере оператора — там это
// уместно, потому что оператор и есть тот, кто ходит. В лобби ходят двое с разных устройств, и
// «время вышло» обязано наступить одинаково для обоих, даже когда обе вкладки закрыты: отсюда
// отметка начала хода и остаток банка в БД (Lobby.turnStartedAt / reserveA / reserveB).
//
// Состояние драфта читается и пишется ИМЕННО ЗДЕСЬ, рядом с проверкой «его ли ход»: проверка и
// запись обязаны смотреть на одну и ту же версию payload. Запись идёт `updateMany` с payload в
// условии — это сравнение-и-запись одним оператором СУБД: два нажатия подряд и «капитан нажал в ту
// же миллисекунду, что сработал автоход» дают ровно один ход, второй получает отказ.

/** Строка лобби в объёме, который нужен часам. */
const TURN_SELECT = {
  id: true,
  status: true,
  payload: true,
  mainSec: true,
  turnStartedAt: true,
  reserveA: true,
  reserveB: true,
  autoFrom: true,
} as const;

type TurnRow = { payload: string; mainSec: number; turnStartedAt: Date | null; reserveA: number; reserveB: number };

export function parseState(payload: string): FearlessState | null {
  try {
    const parsed = JSON.parse(payload) as FearlessState;
    return parsed?.version === FEARLESS_VERSION ? parsed : null;
  } catch {
    return null; // пусто до монетки — это норма, а не поломка
  }
}

/** Сколько ходов уже сделано на текущей карте. Этим числом адресуется ход (см. `commitPick`). */
export const movesDone = (state: FearlessState): number => state.games[state.current]?.moves.length ?? 0;

/**
 * Случайный герой из доступных на этот момент — правило автохода (решение ТЗ 22б §6).
 * Детерминированное правило («первый по id») отвергнуто: один и тот же герой уходил бы в автопик
 * каждый раз и читался бы как подсказка, а не как штраф за просроченное время.
 */
export function autoHero(state: FearlessState): number | null {
  // Пул серии пуст только у состояний без ограничения пула (обратная совместимость движка) —
  // тогда выбирать не из чего, кроме всего справочника.
  const candidates = state.pool.length ? state.pool : localHeroes().map((h) => h.id);
  const avail = candidates.filter((id) => isSelectable(state, id));
  return avail.length ? avail[Math.floor(Math.random() * avail.length)] : null;
}

/** Срок текущего хода в мс эпохи: основное время плюс ВЕСЬ банк ходящей стороны. */
function deadlineOf(row: TurnRow, state: FearlessState, startedAt: number): number | null {
  const team = currentTeam(state);
  if (team === null) return null;
  const bank = team === 0 ? row.reserveA : row.reserveB;
  return startedAt + (row.mainSec + bank) * 1000;
}

/** Срок текущего хода по тому, что лежит в базе прямо сейчас — без пересчёта и без записи. */
async function peekDeadline(id: number): Promise<number | null> {
  const row = await prisma.lobby.findUnique({ where: { id }, select: TURN_SELECT });
  const state = row && row.status === "draft" ? parseState(row.payload) : null;
  if (!row || !state || !row.turnStartedAt) return null;
  return deadlineOf(row, state, row.turnStartedAt.getTime());
}

export type SettleResult = { changed: boolean; deadline: number | null };

/**
 * Довести часы комнаты до «сейчас»: если срок хода истёк — сделать автоход, и так столько раз,
 * сколько ходов уместилось в простой. Пропущенное время не прощается: сервер мог лежать, вкладки
 * могли быть закрыты — на очередь это не влияет.
 *
 * Возвращает срок следующего хода, чтобы вызывающий взвёл на него будильник.
 */
export async function settleTurn(id: number, retry = 0): Promise<SettleResult> {
  const row = await prisma.lobby.findUnique({ where: { id }, select: TURN_SELECT });
  if (!row || row.status !== "draft") return { changed: false, deadline: null };
  let state = parseState(row.payload);
  if (!state) return { changed: false, deadline: null };

  const now = Date.now();
  const reserve: [number, number] = [row.reserveA, row.reserveB];
  let startedAt = row.turnStartedAt?.getTime() ?? null;
  let autoFrom = row.autoFrom;
  let changed = false;

  // Часов ещё нет (драфт только открылся или админ перевёл карту) — ход начинается сейчас.
  if (startedAt === null && currentStep(state) !== null) {
    startedAt = now;
    changed = true;
  }

  // Больше двадцати ходов на карте не бывает (SEQUENCE) — цикл заведомо конечен.
  while (startedAt !== null) {
    const team = currentTeam(state);
    if (team === null) {
      startedAt = null; // карта задрафчена: счётчик хода остановлен
      changed = true;
      break;
    }
    const deadline = startedAt + (row.mainSec + reserve[team]) * 1000;
    if (now < deadline) break;
    const hero = autoHero(state);
    if (hero === null) break; // брать некого — часы дальше не двигаем, это не автоход
    if (autoFrom === null) autoFrom = movesDone(state);
    state = applyPick(state, hero);
    reserve[team] = 0; // банк истёк целиком: переработка не бывает меньше того, что было
    startedAt = deadline; // следующий ход начался ровно там, где кончился прошлый
    changed = true;
  }

  if (!changed) return { changed: false, deadline: deadlineOf(row, state, startedAt ?? now) };

  // Условие по payload — та же защита от гонки, что и у хода капитана: параллельный ход и
  // параллельное истечение пишут одно и то же поле, и выиграть должен ровно один.
  const hit = await prisma.lobby.updateMany({
    where: { id, payload: row.payload },
    data: {
      payload: JSON.stringify(state),
      turnStartedAt: startedAt === null ? null : new Date(startedAt),
      reserveA: reserve[0],
      reserveB: reserve[1],
      autoFrom,
    },
  });
  // Кто-то успел походить, пока мы считали — пересчитываем от его состояния. Пересчёт ограничен:
  // бесконечно проигрывать гонку нельзя, а пропущенное всё равно досчитается следующим обращением.
  if (!hit.count) return retry < 3 ? settleTurn(id, retry + 1) : { changed: true, deadline: await peekDeadline(id) };

  return { changed: true, deadline: startedAt === null ? null : deadlineOf({ ...row, reserveA: reserve[0], reserveB: reserve[1] }, state, startedAt) };
}

export type PickResult = { ok: true } | { ok: false; error: string };

/**
 * Ход капитана. Сюда приходит уже проверенное «он капитан этой стороны этого лобби»; здесь
 * проверяется всё, что зависит от состояния драфта, и здесь же оно пишется.
 *
 * `at` — сколько ходов было сделано на карте в момент нажатия. Номер хода в теле запроса и есть
 * защита от повтора: тот же запрос, отправленный дважды, во второй раз адресует уже сделанный ход.
 */
export async function commitPick(id: number, side: TeamIdx, heroId: number, at: number): Promise<PickResult> {
  const row = await prisma.lobby.findUnique({ where: { id }, select: TURN_SELECT });
  if (!row || row.status !== "draft") return { ok: false, error: "Драфт ещё не начался" };
  const state = parseState(row.payload);
  if (!state) return { ok: false, error: "Драфт ещё не начался" };

  const team = currentTeam(state);
  if (team === null) return { ok: false, error: "Карта задрафчена" };
  if (team !== side) return { ok: false, error: "Сейчас ход соперника" };
  if (at !== movesDone(state)) return { ok: false, error: "Ход уже сделан" };
  if (!isSelectable(state, heroId)) return { ok: false, error: "Этого героя сейчас взять нельзя" };

  const now = Date.now();
  const startedAt = row.turnStartedAt?.getTime() ?? now;
  const reserve: [number, number] = [row.reserveA, row.reserveB];
  // Банк тратится только СВЕРХ основного времени: ход быстрее `mainSec` доп-время не уменьшает.
  const over = Math.max(0, (now - startedAt) / 1000 - row.mainSec);
  reserve[team] = Math.max(0, Math.round(reserve[team] - over));

  const next = applyPick(state, heroId);
  const done = currentStep(next) === null;
  const hit = await prisma.lobby.updateMany({
    where: { id, payload: row.payload },
    data: {
      payload: JSON.stringify(next),
      turnStartedAt: done ? null : new Date(now),
      reserveA: reserve[0],
      reserveB: reserve[1],
      autoFrom: null, // последний ход сделан руками — подпись про автоход гаснет
    },
  });
  return hit.count ? { ok: true } : { ok: false, error: "Ход уже сделан" };
}
