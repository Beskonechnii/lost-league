// Ядро fearless-драфта — чистые функции без БД (как qualification.ts / draft.ts), годятся на клиенте.
// Fearless = «без повторов по серии»: герой, ВЗЯТЫЙ (pick) в любой прошлой карте серии, больше не
// доступен для взятия до конца серии. Баны — покарточные, каждую карту сбрасываются.
//
// Правила (согласованы):
//   • Пул серии — рандомный: по 9 героев на каждый атрибут (сила/ловкость/интеллект/универсал),
//     фиксируется при создании серии и не меняется. Драфт идёт только из этого пула.
//   • Монетка перед серией: победитель выбирает один блок — сторону (свет/тьма) ИЛИ очередь (FP/SP),
//     проигравший получает другой. Отсюда firstPick (кто пикает первым) и radiant (кто на свету).
//   • Последовательность карты — CM-lite: 5 банов + 5 пиков на команду, вперемешку (20 ходов,
//     см. SEQUENCE — она и есть регламент).
//   • Стороны и первый пик чередуются по картам серии.
//   • Тайминги: основное время хода + банк доп-времени на команду (см. DEFAULT_MAIN_SEC/RESERVE_SEC).

export const FEARLESS_VERSION = 2 as const;

/** Сторона в последовательности: 0 — первый пик/бан на этой карте, 1 — второй. */
export type Seq = 0 | 1;
export type FearlessTeam = { name: string; color: string };

/** Шаг последовательности карты: чья очередь (в терминах Seq) и что делает. */
export type Step = { seq: Seq; action: "ban" | "pick" };

// 5 банов + 5 пиков на сторону (20 ходов), вперемешку. Первая стадия банов — по 3 на команду,
// вторая — по 2. Легко переписать под свой регламент: движок зависит только от этого массива.
// seq 0 — тот, кто ходит первым на карте.
export const SEQUENCE: Step[] = [
  // Стадия 1 — баны по 3 на команду
  { seq: 0, action: "ban" }, { seq: 1, action: "ban" }, { seq: 0, action: "ban" },
  { seq: 1, action: "ban" }, { seq: 0, action: "ban" }, { seq: 1, action: "ban" },
  // Пики стадии 1
  { seq: 0, action: "pick" }, { seq: 1, action: "pick" }, { seq: 1, action: "pick" }, { seq: 0, action: "pick" },
  // Стадия 2 — баны по 2 на команду
  { seq: 0, action: "ban" }, { seq: 1, action: "ban" }, { seq: 0, action: "ban" }, { seq: 1, action: "ban" },
  // Пики стадии 2
  { seq: 1, action: "pick" }, { seq: 0, action: "pick" }, { seq: 0, action: "pick" }, { seq: 1, action: "pick" },
  { seq: 0, action: "pick" }, { seq: 1, action: "pick" },
];

export const DEFAULT_MAIN_SEC = 30; // основное время на ход
export const DEFAULT_RESERVE_SEC = 90; // банк доп-времени на команду на весь драфт
export const POOL_PER_ATTR = 9; // сколько героев каждого атрибута попадает в рандом-пул

/** Индекс команды (0 = команда A, 1 = команда B в порядке выбора). Не путать с Seq. */
export type TeamIdx = 0 | 1;

/** Одно взятие/бан: команда (индекс) + герой + действие. */
export type Move = { team: TeamIdx; heroId: number; action: "ban" | "pick" };

export type GameDraft = { moves: Move[] };

export type FearlessState = {
  version: typeof FEARLESS_VERSION;
  teams: [FearlessTeam, FearlessTeam];
  bestOf: number;
  /** Рандом-пул серии: id героев (по 9 на атрибут). Пусто = пул не ограничен (обратная совместимость). */
  pool: number[];
  /** Итог монетки для карты 1: какая команда пикает первой и какая на свету. Дальше чередуется. */
  firstPick: TeamIdx;
  radiant: TeamIdx;
  mainSec: number;
  reserveSec: number;
  games: GameDraft[];
  current: number;
};

export type CoinResult = { winner: TeamIdx; firstPick: TeamIdx; radiant: TeamIdx };

/** Новый драфт серии. Пул и итог монетки приходят готовыми из UI (рандом и выбор — там). */
export function newFearless(
  teams: [FearlessTeam, FearlessTeam],
  opts: { bestOf?: number; pool?: number[]; firstPick?: TeamIdx; radiant?: TeamIdx; mainSec?: number; reserveSec?: number } = {},
): FearlessState {
  return {
    version: FEARLESS_VERSION,
    teams,
    bestOf: opts.bestOf ?? 3,
    pool: opts.pool ?? [],
    firstPick: opts.firstPick ?? 0,
    radiant: opts.radiant ?? 0,
    mainSec: opts.mainSec ?? DEFAULT_MAIN_SEC,
    reserveSec: opts.reserveSec ?? DEFAULT_RESERVE_SEC,
    games: [{ moves: [] }],
    current: 0,
  };
}

/** Эффективный «первый пик» на карте gameIdx: чередуется по картам от итога монетки. */
export const firstPickOf = (state: FearlessState, gameIdx: number): TeamIdx =>
  (gameIdx % 2 === 0 ? state.firstPick : (1 - state.firstPick)) as TeamIdx;

/** Эффективная светлая сторона на карте: тоже чередуется. */
export const radiantOf = (state: FearlessState, gameIdx: number): TeamIdx =>
  (gameIdx % 2 === 0 ? state.radiant : (1 - state.radiant)) as TeamIdx;

/** Seq (0/1 в последовательности) → индекс команды на карте gameIdx. */
export const teamOfSeq = (state: FearlessState, gameIdx: number, seq: Seq): TeamIdx =>
  (seq === 0 ? firstPickOf(state, gameIdx) : (1 - firstPickOf(state, gameIdx))) as TeamIdx;

/** Текущий шаг карты или null, если драфт карты завершён. */
export function currentStep(state: FearlessState): Step | null {
  const game = state.games[state.current];
  if (!game) return null;
  return SEQUENCE[game.moves.length] ?? null;
}

/** Команда, чей сейчас ход (индекс), или null. */
export function currentTeam(state: FearlessState): TeamIdx | null {
  const step = currentStep(state);
  return step ? teamOfSeq(state, state.current, step.seq) : null;
}

/** Пики карты по индексу — «запись героев прошлых карт» (item 5). */
export function picksOfGame(state: FearlessState, gameIdx: number): Move[] {
  return (state.games[gameIdx]?.moves ?? []).filter((m) => m.action === "pick");
}

/** Герои, ВЗЯТЫЕ в прошлых картах серии — недоступны до конца серии (суть fearless). */
export function fearlessLocked(state: FearlessState): Set<number> {
  const set = new Set<number>();
  state.games.forEach((g, i) => {
    if (i >= state.current) return; // только сыгранные ранее карты
    for (const m of g.moves) if (m.action === "pick") set.add(m.heroId);
  });
  return set;
}

const idsThisGame = (state: FearlessState, action: "ban" | "pick") =>
  new Set((state.games[state.current]?.moves ?? []).filter((m) => m.action === action).map((m) => m.heroId));

export const bansThisGame = (state: FearlessState) => idsThisGame(state, "ban");
export const picksThisGame = (state: FearlessState) => idsThisGame(state, "pick");

/** Можно ли сейчас выбрать этого героя. */
export function isSelectable(state: FearlessState, heroId: number): boolean {
  if (currentStep(state) === null) return false;
  if (state.pool.length && !state.pool.includes(heroId)) return false; // вне рандом-пула
  if (fearlessLocked(state).has(heroId)) return false;
  if (bansThisGame(state).has(heroId)) return false;
  if (picksThisGame(state).has(heroId)) return false;
  return true;
}

/** Применить текущий шаг к герою (иммутабельно). Нелегальный ход — без изменений. */
export function applyPick(state: FearlessState, heroId: number): FearlessState {
  const step = currentStep(state);
  if (!step || !isSelectable(state, heroId)) return state;
  const team = teamOfSeq(state, state.current, step.seq);
  const games = state.games.map((g, i) =>
    i === state.current ? { moves: [...g.moves, { team, heroId, action: step.action }] } : g,
  );
  return { ...state, games };
}

/** Отменить последний ход текущей карты. */
export function undo(state: FearlessState): FearlessState {
  const g = state.games[state.current];
  if (!g || g.moves.length === 0) return state;
  const games = state.games.map((gg, i) => (i === state.current ? { moves: gg.moves.slice(0, -1) } : gg));
  return { ...state, games };
}

export const isGameComplete = (state: FearlessState): boolean => currentStep(state) === null;

export const canNextGame = (state: FearlessState): boolean =>
  isGameComplete(state) && state.games.length < state.bestOf;

export function nextGame(state: FearlessState): FearlessState {
  if (!canNextGame(state)) return state;
  return { ...state, games: [...state.games, { moves: [] }], current: state.games.length };
}

/** Ходы одной команды (индекс) на текущей карте — для колонок борда. */
export function teamMoves(state: FearlessState, team: TeamIdx): { picks: number[]; bans: number[] } {
  const picks: number[] = [];
  const bans: number[] = [];
  for (const m of state.games[state.current]?.moves ?? []) {
    if (m.team !== team) continue;
    (m.action === "pick" ? picks : bans).push(m.heroId);
  }
  return { picks, bans };
}

/**
 * Собрать рандом-пул: по `perAttr` героев каждого атрибута. Принимает список {id, attr},
 * возвращает перемешанную выборку id. Рандом здесь, чтобы движок не зависел от справочника.
 */
export function buildPool(heroes: { id: number; attr: string }[], perAttr = POOL_PER_ATTR): number[] {
  const byAttr = new Map<string, number[]>();
  for (const h of heroes) {
    const arr = byAttr.get(h.attr) ?? [];
    arr.push(h.id);
    byAttr.set(h.attr, arr);
  }
  const pick: number[] = [];
  for (const ids of byAttr.values()) pick.push(...shuffle(ids).slice(0, perAttr));
  return pick;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Бросок монетки: победитель случаен, дальше UI даёт ему выбрать блок. */
export const tossCoin = (): TeamIdx => (Math.random() < 0.5 ? 0 : 1);
