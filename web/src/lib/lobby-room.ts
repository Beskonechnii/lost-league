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

/** Сколько игроков минимум должно подтвердить готовность, чтобы сторона считалась собранной. */
export const SIDE_READY_MIN = 5;

export type LobbyStatus = "gather" | "coin" | "draft" | "done";

export type LobbySide = { teamId: number; name: string; color: string; logo: string | null };

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
  /** Итог монетки. `block` — что выбрал победитель; второй блок достаётся сопернику. */
  coin: { winner: TeamIdx; block: "side" | "order" | null; firstPick: TeamIdx | null; radiant: TeamIdx | null } | null;
  members: LobbyMemberView[];
  /** Состояние драфта — появляется после монетки. В 22а борд показывается только на просмотр. */
  state: FearlessState | null;
};

/** Игроки стороны — те, кто в ней ходит. Тренер и ОБС стоят за той же стороной, но это не места
 *  в составе: зашедший за сторону тренер готовность не блокирует и в пятёрку не считается. */
export const sidePlayers = (room: LobbyRoom, side: TeamIdx): LobbyMemberView[] =>
  room.members.filter((m) => m.side === side && m.role === "player");

export const captainOf = (room: LobbyRoom, side: TeamIdx): LobbyMemberView | null =>
  sidePlayers(room, side).find((m) => m.captain) ?? null;

/**
 * Готова ли сторона: капитан выбран, ВСЕ её игроки нажали «Готов», и их не меньше пятёрки.
 * Пятёрка — нижняя граница (иначе можно начать втроём), верхней нет: кроме основы за стороной
 * могут стоять запасные.
 */
export function sideReady(room: LobbyRoom, side: TeamIdx): boolean {
  const players = sidePlayers(room, side);
  if (players.length < SIDE_READY_MIN) return false;
  if (!players.some((m) => m.captain)) return false;
  return players.every((m) => m.ready);
}

/** Чего стороне не хватает — одной строкой для подписи под кнопками. */
export function sideBlocker(room: LobbyRoom, side: TeamIdx): string | null {
  const players = sidePlayers(room, side);
  if (players.length < SIDE_READY_MIN) return `нужно ещё игроков: ${SIDE_READY_MIN - players.length}`;
  if (!players.some((m) => m.captain)) return "нет капитана";
  const waiting = players.filter((m) => !m.ready).length;
  return waiting ? `не готовы: ${waiting}` : null;
}

/** Мой участник в комнате — по нему решается, что мне вообще можно нажать. */
export const meIn = (room: LobbyRoom, accountId: number | null): LobbyMemberView | null =>
  accountId === null ? null : (room.members.find((m) => m.accountId === accountId) ?? null);
