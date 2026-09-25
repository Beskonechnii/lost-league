// Форма комнаты встречи — общая для сервера (он её собирает) и клиента (он её рисует).
//
// Отдельным файлом по той же причине, что `chat-events.ts` отделён от `presence.ts`: сама логика
// лобби помечена `server-only` (БД и куки), а тип снимка обязан быть один на оба конца провода —
// снимок едет и ответом API, и событием живого канала.

import type { FearlessState, TeamIdx } from "./fearless";

/** Роль в комнате. Игрок ходит и считается в готовность стороны; остальные — смотрят. */
export type LobbyRole = "player" | "coach" | "caster" | "admin";

export const ROLE_LABEL: Record<LobbyRole, string> = {
  player: "игрок",
  coach: "тренер",
  caster: "ОБС",
  admin: "админ комнаты",
};

/** Администрация комнаты: смотрит, переносит людей, но места в составе не занимает и лимита не
 *  имеет. Отличать её от «ещё не определился» обязательно — иначе админ комнаты стоит в очереди
 *  ожидающих, а вошедший по паролю считается администрацией (ТЗ 42в §1). */
export const isStaff = (role: LobbyRole): boolean => role === "admin" || role === "caster";

/** Пятёрка — и нижняя граница готовности, и верхний предел состава: сторона играет ровно впятером.
 *  Тренер шестой и один: он не ходит и в готовность не считается (ТЗ 42в §3). */
export const SIDE_PLAYERS = 5;
export const SIDE_COACHES = 1;

export type LobbyStatus = "gather" | "coin" | "draft" | "done";

/** Сторона комнаты: имя свободным текстом (его пишет админ) и цвет. Лого и карточки команды здесь
 *  больше нет — с 42б лобби не привязано к `Team` ростера, оформление даёт кожа. */
export type LobbySide = { name: string; color: string };

export type LobbyMemberView = {
  id: number;
  accountId: number;
  playerId: number | null;
  nickname: string;
  photo: string | null;
  /** 0 = сторона A, 1 = сторона B, null — вне сторон (админ комнаты, ОБС). */
  side: TeamIdx | null;
  role: LobbyRole;
  captain: boolean;
  ready: boolean;
  /** Открывал ли он комнату хоть раз. Приглашённый, но не заходивший — ещё не в комнате. */
  joined: boolean;
};

export type LobbyRoom = {
  id: number;
  title: string;
  status: LobbyStatus;
  sides: [LobbySide, LobbySide];
  mainSec: number;
  reserveSec: number;
  bestOf: number;
  seriesId: number | null;
  ownerAccountId: number;
  /** Итог монетки. `block` — что выбрал победитель; второй блок достаётся сопернику. `at` — когда
   *  сервер бросил монетку: по нему все вкладки играют анимацию В ОДНУ секунду, а опоздавшая
   *  показывает готовый результат без вращения (DESIGN-4). Часы те же, что у `turn`. */
  coin: {
    winner: TeamIdx;
    at: number | null;
    block: "side" | "order" | null;
    firstPick: TeamIdx | null;
    radiant: TeamIdx | null;
  } | null;
  members: LobbyMemberView[];
  /** Состояние драфта — появляется после монетки. В 22а борд показывается только на просмотр. */
  state: FearlessState | null;
  /** Часы хода с сервера (22б). Вкладка их только показывает. */
  turn: LobbyTurn;
};

/**
 * Часы хода в снимке. `startedAt` и `now` — эпоха в миллисекундах ПО ЧАСАМ СЕРВЕРА: вкладка
 * снимает по ним разницу со своими часами один раз на снимок, иначе экран с убежавшими
 * системными часами врал бы на минуты. `startedAt = null` — ход не идёт (карта задрафчена).
 */
export type LobbyTurn = {
  startedAt: number | null;
  now: number;
  /** Остаток банка по ИНДЕКСУ КОМАНДЫ (0 = сторона A), не по стороне экрана. */
  reserve: [number, number];
  /** С какого хода текущей карты пошли автоходы; null — последний ход сделан руками. */
  autoFrom: number | null;
};

/**
 * Реплика в чате комнаты. Автор — аккаунт, а не ник: подпись берётся из того же списка участников,
 * что рисует комнату (`members`), и второй раз ту же пару «ник + фото» по проводу не гоняем.
 */
export type LobbyLine = { id: number; accountId: number; text: string; createdAt: string };

/**
 * Что уезжает в ОБС-вид (ТЗ 22в §6): ТОЛЬКО картинка драфта. Состава комнаты, чата и кнопок здесь
 * нет намеренно — адрес открывается по ключу без входа, и всё, что попадёт в этот тип, станет
 * доступно каждому, кому ключ показали.
 */
export type LobbyBoard = {
  title: string;
  status: LobbyStatus;
  sides: [LobbySide, LobbySide];
  bestOf: number;
  /** Капитаны сторон — карточкам колонок борда. null, пока сторона его не выбрала. */
  captains: [LobbyCaptain | null, LobbyCaptain | null];
  state: FearlessState | null;
  turn: LobbyTurn;
};

export type LobbyCaptain = { nickname: string; photo: string | null };

/** Администрация комнаты: админ и ОБС. Места в составе не занимают, готовность не блокируют,
 *  но в комнате они есть — и до 22в не были видны ни в одном списке экрана. */
export const staffIn = (room: LobbyRoom): LobbyMemberView[] => room.members.filter((m) => isStaff(m.role));

/** «Неопределившиеся» — вошли в комнату, но ещё не встали за сторону. От администрации отличаются
 *  ролью: у тех «вне сторон» — это их место, а здесь это очередь на выбор (ТЗ 42в §1). */
export const undecided = (room: LobbyRoom): LobbyMemberView[] =>
  room.members.filter((m) => m.side === null && !isStaff(m.role));

/** Игроки стороны — те, кто в ней ходит. Тренер и ОБС стоят за той же стороной, но это не места
 *  в составе: зашедший за сторону тренер готовность не блокирует и в пятёрку не считается. */
export const sidePlayers = (room: LobbyRoom, side: TeamIdx): LobbyMemberView[] =>
  room.members.filter((m) => m.side === side && m.role === "player");

/** Тренеры стороны: за стороной стоят, но не ходят и в пятёрку не считаются. */
export const sideCoaches = (room: LobbyRoom, side: TeamIdx): LobbyMemberView[] =>
  room.members.filter((m) => m.side === side && m.role === "coach");

export const captainOf = (room: LobbyRoom, side: TeamIdx): LobbyMemberView | null =>
  sidePlayers(room, side).find((m) => m.captain) ?? null;

/**
 * Чего стороне не хватает — одной строкой для подписи под кнопкой. С 42в готовность жмёт ОДИН
 * человек, капитан: собирать пять нажатий на каждую карту серии — работа, которой встреча не
 * требует, а ответственность за сторону и так на капитане. Тренер в готовность не входит вовсе —
 * сторона стартует и без него.
 */
export function sideBlocker(room: LobbyRoom, side: TeamIdx): string | null {
  const players = sidePlayers(room, side);
  if (players.length < SIDE_PLAYERS) return `нужно ещё игроков: ${SIDE_PLAYERS - players.length}`;
  const cap = players.find((m) => m.captain);
  if (!cap) return "нет капитана";
  return cap.ready ? null : "ждём капитана";
}

export const sideReady = (room: LobbyRoom, side: TeamIdx): boolean => sideBlocker(room, side) === null;

/** Мой участник в комнате — по нему решается, что мне вообще можно нажать. */
export const meIn = (room: LobbyRoom, accountId: number | null): LobbyMemberView | null =>
  accountId === null ? null : (room.members.find((m) => m.accountId === accountId) ?? null);
