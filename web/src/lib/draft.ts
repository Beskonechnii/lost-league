// Ядро правил шоу-драфта UNDERBEER 2.0 — чистые функции без БД (как qualification.ts),
// поэтому годятся и на клиенте (борд), и на сервере. Всё состояние сериализуется в
// DraftSession.payload одной JSON-строкой.
//
// Правила (согласованы):
//   • Команд ≥ 2, у каждой капитан. Капитан занимает первый слот, в драфте не участвует.
//   • Порядок ходов — змейка (1→N, N→1, …), чтобы последний капитан не собирал объедки.
//   • В свой ход капитан либо берёт 1 игрока из пула, либо крадёт 1 игрока из чужого состава
//     (кража = действие хода, обычного пика в этот ход уже нет).
//   • «Закрепить» и «Украсть» — по разу за весь драфт на команду. Lock защищает своего игрока
//     от кражи и не тратит ход (защитное действие); Steal ход тратит.
//   • Драфт завершён, когда все команды набрали targetSize (капитан в счёт входит).

export const DRAFT_VERSION = 1 as const;

/** Карточка игрока для пула — резолвится из ростера при чтении (draft-data.ts). В payload только id. */
export type PoolPlayer = {
  id: number; // Player.id — по нему пул и резолвится, и складывается в payload (picks/captainId)
  nickname: string;
  realName: string | null;
  photo: string | null;
  mmr: number | null;
  position: number | null; // 1..5 по основному месту; null — замена/тренер/без места
  role: string | null; // ключ роли (roles.ts) — для подписи позиции
  teamColor: string | null; // акцент ростерной команды — для аватарки-заглушки
};

export type DraftTeam = {
  id: string; // локальный id команды драфта (не Team.id)
  name: string;
  color: string; // hex-акцент команды драфта
  captainId: number | null; // PoolPlayer.id капитана; слот 1
  picks: number[]; // PoolPlayer.id в порядке взятия (капитан сюда НЕ входит)
  locked: number[]; // PoolPlayer.id, защищённые «Закрепить»
  usedLock: boolean;
  usedSteal: boolean;
};

export type DraftPhase = "roster" | "config" | "draft" | "done";

export type DraftState = {
  version: typeof DRAFT_VERSION;
  phase: DraftPhase;
  snake: boolean;
  targetSize: number; // размер состава включая капитана
  teams: DraftTeam[];
  order: string[]; // порядок команд по кругам (DraftTeam.id)
  turn: number; // указатель в змейку-развёртку; растёт при пике/краже (см. currentTurn)
  // Участники турнира: отобранные из полного ростера id игроков (фаза roster). Драфт идёт только из них.
  // Старые payload'ы поля не имеют → undefined, трактуется как «пул = весь ростер» (обратная совместимость).
  participants?: number[];
  // Форс-добор после кражи: у кого украли — добирает игрока ВНЕ очереди, потом змейка возобновляется.
  // Старые payload'ы поля не имеют → undefined, трактуется как «нет форс-добора».
  pendingPick?: string | null;
  // Тумблеры правил Mix Cup (ТЗ 33): отсутствие поля (обычный UNDERBEER и старые payload'ы) —
  // действие разрешено, иначе выключатель молча переписал бы историю прошлых драфтов.
  // Значения берутся из настроек события при старте и заморожены на фазе draft/done.
  stealEnabled?: boolean;
  lockEnabled?: boolean;
};

/** Сегмент пула по позиции: керри…хард, затем «без позиции» (замены/тренеры). */
export type PoolSegment = { position: number | null; label: string; players: PoolPlayer[] };

const POSITION_LABELS: Record<number, string> = {
  1: "Керри (поз. 1)",
  2: "Мид (поз. 2)",
  3: "Оффлейн (поз. 3)",
  4: "Софт-саппорт (поз. 4)",
  5: "Хард-саппорт (поз. 5)",
};

/** Пул, разбитый по позициям — чтобы капитану было удобно выбирать. Пустые сегменты отброшены. */
export function segmentPool(players: PoolPlayer[]): PoolSegment[] {
  const order = [1, 2, 3, 4, 5, null] as const;
  return order
    .map((position) => ({
      position,
      label: position === null ? "Без позиции" : POSITION_LABELS[position],
      players: players
        .filter((p) => p.position === position)
        .sort((a, b) => (b.mmr ?? 0) - (a.mmr ?? 0) || a.nickname.localeCompare(b.nickname)),
    }))
    .filter((s) => s.players.length > 0);
}

// ── Фабрики ───────────────────────────────────────────────────────────────────

let seq = 0;
/** Слабый уникальный id команды драфта: draft-состояние живёт коротко и в одном payload. */
export const newTeamId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newDraftState(rules?: { stealEnabled?: boolean; lockEnabled?: boolean }): DraftState {
  return {
    version: DRAFT_VERSION,
    phase: "roster",
    snake: true,
    targetSize: 5,
    teams: [],
    order: [],
    turn: 0,
    participants: [],
    pendingPick: null,
    ...rules,
  };
}

export function newTeam(name: string, color: string): DraftTeam {
  return { id: newTeamId(), name, color, captainId: null, picks: [], usedLock: false, usedSteal: false, locked: [] };
}

// ── Селекторы ───────────────────────────────────────────────────────────────

export const teamById = (state: DraftState, id: string): DraftTeam | undefined =>
  state.teams.find((t) => t.id === id);

/** Все члены команды: капитан первым слотом, затем взятые/украденные игроки. */
export const memberIds = (team: DraftTeam): number[] =>
  [team.captainId, ...team.picks].filter((x): x is number => x != null);

export const isTeamFull = (team: DraftTeam, targetSize: number): boolean =>
  memberIds(team).length >= targetSize;

/** Все занятые id (капитаны + пики) — для затемнения пула. */
export function takenIds(state: DraftState): Set<number> {
  const s = new Set<number>();
  for (const t of state.teams) for (const id of memberIds(t)) s.add(id);
  return s;
}

/**
 * Кто сменил владельца между двумя срезами состояния — обычный пик, форс-добор после кражи или
 * сама кража (для нового владельца это тоже «взяли только что»). Payload истории ходов не хранит
 * (ТЗ 35: формат не меняем) — вид сравнивает два снимка сам: борд — «до» и «после» своего
 * действия, оверлей — соседние тики опроса. `prev` нет (первая отрисовка) — сравнивать не с чем.
 */
export function lastMovedPlayer(prev: DraftState | null, next: DraftState): number | null {
  if (!prev) return null;
  const owners = (s: DraftState) => {
    const m = new Map<number, string>();
    for (const t of s.teams) for (const pid of memberIds(t)) m.set(pid, t.id);
    return m;
  };
  const before = owners(prev);
  for (const [pid, teamId] of owners(next)) {
    if (before.get(pid) !== teamId) return pid;
  }
  return null;
}

/** Индекс команды в змейка-развёртке для позиции pos (0-based круг). */
function walkTeamIndex(pos: number, n: number, snake: boolean): number {
  if (!snake) return pos % n;
  const cycle = ((pos % (2 * n)) + 2 * n) % (2 * n);
  return cycle < n ? cycle : 2 * n - 1 - cycle;
}

/**
 * Чей сейчас ход. Сначала — форс-добор пострадавшей от кражи (вне очереди), потом змейка:
 * идём от state.turn и пропускаем уже укомплектованные команды (команда могла добрать состав
 * кражей раньше очереди). `comp` = это тот самый добор после кражи, не обычный ход змейки.
 * null — драфт не идёт или всё собрано.
 */
export function currentTurn(state: DraftState): { teamId: string; pos: number; comp: boolean } | null {
  if (state.phase !== "draft") return null;
  const n = state.order.length;
  if (n === 0) return null;
  const full = (id: string) => {
    const t = teamById(state, id);
    return !t || isTeamFull(t, state.targetSize);
  };
  // Пострадавшая от кражи добирает первой, вне змейки (если ей ещё есть куда — а место точно есть,
  // она только что потеряла игрока). pos держим текущим: добор змейку не двигает.
  if (state.pendingPick && !full(state.pendingPick)) {
    return { teamId: state.pendingPick, pos: state.turn, comp: true };
  }
  if (state.order.every(full)) return null;
  let pos = state.turn;
  for (let guard = 0; guard <= n * 1000; guard++, pos++) {
    const id = state.order[walkTeamIndex(pos, n, state.snake)];
    if (!full(id)) return { teamId: id, pos, comp: false };
  }
  return null; // недостижимо, пока есть хоть одна незаполненная команда
}

export const currentTeam = (state: DraftState): DraftTeam | undefined => {
  const t = currentTurn(state);
  return t ? teamById(state, t.teamId) : undefined;
};

// ── Предикаты для UI (кнопки гейтятся ими, редьюсеры — тотальны на валидном входе) ──

export function canPick(state: DraftState, playerId: number): boolean {
  const t = currentTurn(state);
  if (!t) return false;
  return !takenIds(state).has(playerId);
}

export function canLock(state: DraftState, teamId: string, playerId: number): boolean {
  if (state.lockEnabled === false) return false; // выключено тумблером события (Mix Cup) — единственное место проверки
  const cur = currentTurn(state);
  if (!cur || cur.comp || cur.teamId !== teamId) return false; // закреплять можно только в свой обычный ход
  const team = teamById(state, teamId);
  if (!team || team.usedLock) return false;
  return memberIds(team).includes(playerId) && !team.locked.includes(playerId);
}

/** Можно ли текущей команде украсть игрока playerId из команды fromTeamId. */
export function canSteal(state: DraftState, fromTeamId: string, playerId: number): boolean {
  if (state.stealEnabled === false) return false; // выключено тумблером события (Mix Cup) — единственное место проверки
  const cur = currentTurn(state);
  if (!cur || cur.comp) return false; // во время форс-добора красть нельзя — цепной кражи не устраиваем
  const me = teamById(state, cur.teamId);
  const from = teamById(state, fromTeamId);
  if (!me || !from || me.id === from.id || me.usedSteal) return false;
  if (isTeamFull(me, state.targetSize)) return false;
  // капитана и закреплённых красть нельзя; красть можно только взятого игрока
  return from.picks.includes(playerId) && !from.locked.includes(playerId);
}

// ── Редьюсеры (возвращают новое состояние; на невалидном входе бросают) ──────────

const mapTeam = (state: DraftState, id: string, fn: (t: DraftTeam) => DraftTeam): DraftTeam[] =>
  state.teams.map((t) => (t.id === id ? fn(t) : t));

/** Взять игрока из пула в текущую команду. Обычный ход двигает змейку; форс-добор — нет. */
export function pickPlayer(state: DraftState, playerId: number): DraftState {
  const cur = currentTurn(state);
  if (!cur) throw new Error("Сейчас не ход капитана");
  if (!canPick(state, playerId)) throw new Error("Игрок уже занят");
  const teams = mapTeam(state, cur.teamId, (t) => ({ ...t, picks: [...t.picks, playerId] }));
  if (cur.comp) {
    // форс-добор после кражи закрыт: снимаем пометку и возобновляем змейку с того места, где стояли
    const next = { ...state, teams, pendingPick: null };
    return currentTurn(next) ? next : { ...next, phase: "done" as const };
  }
  return finishTurn({ ...state, teams }, cur.pos);
}

/** Закрепить своего игрока (защита от кражи). Ход не тратится. */
export function lockPlayer(state: DraftState, teamId: string, playerId: number): DraftState {
  if (!canLock(state, teamId, playerId)) throw new Error("Нельзя закрепить этого игрока");
  const teams = mapTeam(state, teamId, (t) => ({ ...t, locked: [...t.locked, playerId], usedLock: true }));
  return { ...state, teams };
}

/**
 * Украсть игрока из чужого состава в текущую команду. Кража = действие хода (обычного пика нет),
 * поэтому змейку двигаем за вором. Но сначала — по-честному — пострадавшая команда добирает игрока
 * вне очереди (`pendingPick`), и только потом змейка возобновляется с продвинутого указателя.
 */
export function stealPlayer(state: DraftState, fromTeamId: string, playerId: number): DraftState {
  const cur = currentTurn(state);
  if (!cur) throw new Error("Сейчас не ход капитана");
  if (!canSteal(state, fromTeamId, playerId)) throw new Error("Нельзя украсть этого игрока");
  const teams = state.teams.map((t) => {
    if (t.id === fromTeamId) return { ...t, picks: t.picks.filter((id) => id !== playerId) };
    if (t.id === cur.teamId) return { ...t, picks: [...t.picks, playerId], usedSteal: true };
    return t;
  });
  // pendingPick — пострадавшая; turn двигаем за вором. currentTurn отдаст сперва форс-добор, затем змейку.
  const next = { ...state, teams, pendingPick: fromTeamId, turn: cur.pos + 1 };
  return currentTurn(next) ? next : { ...next, phase: "done" as const };
}

/** Общий хвост хода: сдвинуть указатель за отходившую команду и закрыть драфт, если всё собрано. */
function finishTurn(state: DraftState, pos: number): DraftState {
  const next = { ...state, turn: pos + 1 };
  return currentTurn(next) ? next : { ...next, phase: "done" };
}

// ── Переход config → draft ─────────────────────────────────────────────────────

/** Что мешает начать драфт (null — можно начинать). */
export function draftBlocker(state: DraftState): string | null {
  if (state.teams.length < 2) return "Нужно минимум две команды";
  if (state.targetSize < 2) return "В составе должно быть хотя бы 2 игрока";
  if (state.teams.some((t) => t.captainId == null)) return "У каждой команды должен быть капитан";
  if (state.teams.some((t) => !t.name.trim())) return "У каждой команды должно быть название";
  // участников должно хватать на все места; старые сессии (participants нет) не блокируем
  if (state.participants) {
    const need = state.teams.length * state.targetSize;
    if (state.participants.length < need)
      return `Участников (${state.participants.length}) меньше, чем мест в командах (${need})`;
  }
  return null;
}

export function startDraft(state: DraftState): DraftState {
  const blocker = draftBlocker(state);
  if (blocker) throw new Error(blocker);
  return { ...state, phase: "draft", order: state.teams.map((t) => t.id), turn: 0, pendingPick: null };
}

// ── Фаза «Участники» (roster → config) ──────────────────────────────────────────

/** Добавить/убрать игрока из участников турнира. Убрали — вычищаем и из команд (капитан/пик/лок). */
export function toggleParticipant(state: DraftState, playerId: number): DraftState {
  const set = new Set(state.participants ?? []);
  if (set.has(playerId)) {
    set.delete(playerId);
    const teams = state.teams.map((t) => ({
      ...t,
      captainId: t.captainId === playerId ? null : t.captainId,
      picks: t.picks.filter((id) => id !== playerId),
      locked: t.locked.filter((id) => id !== playerId),
    }));
    return { ...state, participants: [...set], teams };
  }
  set.add(playerId);
  return { ...state, participants: [...set] };
}

/** Что мешает перейти к командам (null — можно). */
export function participantsBlocker(state: DraftState): string | null {
  if ((state.participants?.length ?? 0) < 2) return "Выберите хотя бы двух игроков";
  return null;
}

export function goToConfig(state: DraftState): DraftState {
  const blocker = participantsBlocker(state);
  if (blocker) throw new Error(blocker);
  return { ...state, phase: "config" };
}

// ── Config-редьюсеры (правят состав команд до старта; борд зовёт их же) ──────────

export function addTeam(state: DraftState, name: string, color: string): DraftState {
  return { ...state, teams: [...state.teams, newTeam(name, color)] };
}

export function removeTeam(state: DraftState, teamId: string): DraftState {
  return { ...state, teams: state.teams.filter((t) => t.id !== teamId) };
}

export function patchTeam(state: DraftState, teamId: string, patch: Partial<DraftTeam>): DraftState {
  return { ...state, teams: mapTeam(state, teamId, (t) => ({ ...t, ...patch })) };
}

/** Назначить капитана. Игрок не может быть капитаном/пиком двух команд — снимаем его отовсюду. */
export function setCaptain(state: DraftState, teamId: string, playerId: number): DraftState {
  const cleared = state.teams.map((t) => ({
    ...t,
    captainId: t.captainId === playerId ? null : t.captainId,
    picks: t.picks.filter((id) => id !== playerId),
    locked: t.locked.filter((id) => id !== playerId),
  }));
  return { ...state, teams: cleared.map((t) => (t.id === teamId ? { ...t, captainId: playerId } : t)) };
}
