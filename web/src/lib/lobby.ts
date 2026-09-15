import "server-only";
import { prisma } from "./prisma";
import { can, currentAccount, isActiveAccount, type Account } from "./account";
import { withPlayerUploads, withTeamUploads } from "./uploads";
import { teamAccent } from "./profiles";
import { pushTo } from "./presence";
import { tellPlayer } from "./system-chat";
import { localHeroes } from "./dota-constants";
import { buildPool, newFearless, tossCoin, FEARLESS_VERSION, type FearlessState, type TeamIdx } from "./fearless";
import {
  captainOf,
  sidePlayers,
  sideReady,
  type LobbyMemberView,
  type LobbyRole,
  type LobbyRoom,
  type LobbyStatus,
} from "./lobby-room";

// Комната встречи: всё, что про неё знает сервер. Клиент шлёт НАМЕРЕНИЕ («готов», «стать
// капитаном»), а не новое состояние — в отличие от админского борда, где на том конце доверенный
// оператор и PATCH принимает готовый payload целиком. Здесь на том конце участник, и «кто капитан»
// решает не его вкладка.
//
// Состояние комнаты (кто зашёл, кто капитан, кто готов, итог монетки) лежит СТРОКАМИ, а не внутри
// payload драфта: по ним сервер отвечает на «пускать ли в комнату» и — с 22б — «его ли это ход»,
// а ответ внутри JSON проверять на сервере дорого, а на клиенте нельзя.

/** Кто открывает комнату: аккаунт плюс признак админа лиги (право `tools`). */
export type LobbyViewer = { accountId: number; playerId: number | null; admin: boolean };

export async function currentViewer(): Promise<LobbyViewer | null> {
  const account = await currentAccount();
  if (!account) return null;
  return { accountId: account.id, playerId: account.player?.id ?? null, admin: await can("tools") };
}

/** Игрок лиги — одобренный аккаунт с профилем. Он и админ с `tools` могут заводить лобби. */
const isLeaguePlayer = (account: Account | null): boolean => !!account?.player && isActiveAccount(account);

export async function canCreateLobby(): Promise<boolean> {
  return isLeaguePlayer(await currentAccount()) || (await can("tools"));
}

const ROLES: LobbyRole[] = ["player", "coach", "caster", "admin"];
const asRole = (raw: string): LobbyRole => (ROLES.includes(raw as LobbyRole) ? (raw as LobbyRole) : "player");
const asSide = (raw: number | null): TeamIdx | null => (raw === 0 || raw === 1 ? raw : null);

/** Снимок комнаты — один на всех: «моё ли это» клиент считает сам по своему accountId. */
export async function readRoom(id: number): Promise<LobbyRoom | null> {
  const row = await prisma.lobby.findUnique({
    where: { id },
    include: {
      sideA: true,
      sideB: true,
      members: { include: { player: true }, orderBy: { id: "asc" } },
    },
  });
  if (!row) return null;

  const side = async (t: typeof row.sideA) => {
    const withLogo = await withTeamUploads(t);
    return { teamId: t.id, name: t.name, color: teamAccent(t), logo: withLogo.logo };
  };

  const members: LobbyMemberView[] = await Promise.all(
    row.members.map(async (m) => {
      const player = m.player ? await withPlayerUploads(m.player) : null;
      return {
        id: m.id,
        accountId: m.accountId,
        playerId: player?.id ?? null,
        // Участник без профиля в ростере — это админ комнаты: в составе его нет, и подписать
        // его ником оттуда нельзя.
        nickname: player?.nickname ?? "Админ комнаты",
        photo: player?.photo ?? null,
        side: asSide(m.side),
        role: asRole(m.role),
        captain: m.captain,
        ready: m.ready,
        joined: m.joinedAt !== null,
      };
    }),
  );

  let state: FearlessState | null = null;
  try {
    const parsed = JSON.parse(row.payload) as FearlessState;
    if (parsed?.version === FEARLESS_VERSION) state = parsed;
  } catch {
    state = null; // пусто до монетки — это норма, а не поломка
  }

  return {
    id: row.id,
    title: row.title,
    status: row.status as LobbyStatus,
    sides: [await side(row.sideA), await side(row.sideB)],
    mainSec: row.mainSec,
    reserveSec: row.reserveSec,
    bestOf: row.bestOf,
    seriesId: row.seriesId,
    ownerAccountId: row.ownerAccountId,
    coin:
      row.coinWinner === null
        ? null
        : {
            winner: row.coinWinner as TeamIdx,
            block: (row.coinBlock as "side" | "order" | null) ?? null,
            firstPick: asSide(row.firstPick),
            radiant: asSide(row.radiant),
          },
    members,
    state,
  };
}

/**
 * Пускает в комнату МЕМБЕРСТВО, а не право `tools`: «Разбор матчей» — право оператора, участник
 * лобби им не обладает и не должен. Админ с `tools` входит всегда — он админ комнаты, но не игрок.
 * Постороннему страница отвечает 404, а не 403: лобби закрытое, его не должно быть видно вовсе.
 */
export const mayEnter = (room: LobbyRoom, viewer: LobbyViewer | null): boolean =>
  !!viewer && (viewer.admin || room.members.some((m) => m.accountId === viewer.accountId));

/** Снимок — всем, кто в комнате. Своё событие живого канала, третьего механизма не заводим. */
async function broadcast(id: number): Promise<LobbyRoom | null> {
  const room = await readRoom(id);
  if (!room) return null;
  for (const m of room.members) pushTo(m.accountId, { type: "lobby", room });
  return room;
}

export type LobbyInvite = { playerId: number; side: TeamIdx | null; role: LobbyRole };

export type CreateLobbyInput = {
  title: string;
  sideATeamId: number;
  sideBTeamId: number;
  mainSec: number;
  reserveSec: number;
  bestOf: number;
  seriesId: number | null;
  invites: LobbyInvite[];
};

export type CreateResult = { ok: true; id: number } | { ok: false; error: string };

export async function createLobby(input: CreateLobbyInput): Promise<CreateResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: "Нужно войти" };
  if (!(await canCreateLobby())) return { ok: false, error: "Лобби заводят игроки лиги и админы" };
  if (input.sideATeamId === input.sideBTeamId) return { ok: false, error: "Стороны должны быть разными" };

  const teams = await prisma.team.findMany({
    where: { id: { in: [input.sideATeamId, input.sideBTeamId] } },
    select: { id: true },
  });
  if (teams.length !== 2) return { ok: false, error: "Команда не найдена" };

  // Приглашённые адресуются игроком, а в комнату пускается аккаунт: без привязанного аккаунта
  // человеку некуда прислать приглашение и нечем войти (решение 12 — регистрация обязательна).
  const accounts = await prisma.userAccount.findMany({
    where: { playerId: { in: input.invites.map((i) => i.playerId) }, status: "active" },
    select: { id: true, playerId: true },
  });
  const accountByPlayer = new Map(accounts.map((a) => [a.playerId!, a.id]));

  const seen = new Set<number>();
  type Row = { accountId: number; playerId: number | null; side: TeamIdx | null; role: LobbyRole };
  const members: Row[] = input.invites.flatMap((i) => {
    const accountId = accountByPlayer.get(i.playerId);
    if (!accountId || seen.has(accountId)) return [];
    seen.add(accountId);
    return [{ accountId, playerId: i.playerId, side: i.side, role: i.role }];
  });
  // Создатель всегда в комнате — иначе завёл бы её и не смог войти. Если он уже в списке
  // приглашённых своей стороной, второй строкой не дублируем.
  if (!seen.has(account.id)) {
    members.push({ accountId: account.id, playerId: account.player?.id ?? null, side: null, role: "admin" });
  }

  const lobby = await prisma.lobby.create({
    data: {
      title: input.title,
      sideATeamId: input.sideATeamId,
      sideBTeamId: input.sideBTeamId,
      mainSec: input.mainSec,
      reserveSec: input.reserveSec,
      bestOf: input.bestOf,
      seriesId: input.seriesId,
      ownerAccountId: account.id,
      members: { create: members },
    },
    select: { id: true },
  });

  // Приглашение — существующим каналом: системное сообщение от «Spirit CTRL» с кнопкой. Своего
  // механизма уведомлений не заводим; состояние кнопки читается из самого лобби (chat-actions.ts).
  for (const i of input.invites) {
    if (!accountByPlayer.has(i.playerId)) continue;
    await tellPlayer(i.playerId, `Вас зовут в лобби «${input.title}». Комната открыта — заходите.`, {
      kind: "lobby-invite",
      payload: { lobbyId: lobby.id },
    });
  }

  return { ok: true, id: lobby.id };
}

export type Intent =
  | { kind: "join" }
  | { kind: "captain" }
  | { kind: "resign" }
  | { kind: "unseat"; side: TeamIdx }
  | { kind: "ready"; value: boolean }
  | { kind: "coin"; block: "side" | "order"; value: TeamIdx };

export type IntentResult = { ok: true; room: LobbyRoom } | { ok: false; error: string };

/**
 * Намерение участника. Всё, что можно нажать в комнате, проходит здесь — и здесь же проверяется,
 * можно ли это нажать именно ему. Клиент шлёт «хочу», а не «стало так».
 */
export async function applyIntent(id: number, viewer: LobbyViewer, intent: Intent): Promise<IntentResult> {
  const room = await readRoom(id);
  if (!room) return { ok: false, error: "Лобби не найдено" };
  if (!mayEnter(room, viewer)) return { ok: false, error: "Лобби не найдено" };

  const me = room.members.find((m) => m.accountId === viewer.accountId) ?? null;
  // Админ комнаты — не игрок (решение 3): он смотрит и может снять капитана, но не становится им
  // и не подтверждает готовность за сторону.
  const isRoomAdmin = viewer.admin || room.ownerAccountId === viewer.accountId;

  switch (intent.kind) {
    case "join": {
      if (!me) {
        // Админ пришёл в чужую комнату: заводим ему строку «админ комнаты» — иначе он не получал
        // бы событий живого канала и после перезагрузки выглядел бы новым человеком.
        await prisma.lobbyMember.create({
          data: { lobbyId: id, accountId: viewer.accountId, playerId: viewer.playerId, role: "admin", joinedAt: new Date() },
        });
        break;
      }
      if (me.joined) return { ok: true, room }; // уже заходил — второй раз событие не шлём
      await prisma.lobbyMember.update({ where: { id: me.id }, data: { joinedAt: new Date() } });
      break;
    }

    case "captain": {
      if (!me || me.side === null || me.role !== "player") return { ok: false, error: "Капитана выбирают игроки стороны" };
      if (room.status !== "gather") return { ok: false, error: "Сбор уже закончен" };
      // Капитаном становится ПЕРВЫЙ нажавший, перехвата нет. Проверка «у стороны ещё нет капитана»
      // и сама отметка идут одной транзакцией: два одновременных нажатия иначе прошли бы оба, и
      // у стороны стало бы два капитана — гонку за кнопку решает сервер, а не скорость руки.
      const side = me.side;
      const won = await prisma.$transaction(async (tx) => {
        const taken = await tx.lobbyMember.count({ where: { lobbyId: id, side, role: "player", captain: true } });
        if (taken) return false;
        await tx.lobbyMember.update({ where: { id: me.id }, data: { captain: true } });
        return true;
      });
      if (!won) return { ok: false, error: "Капитан уже выбран" };
      break;
    }

    case "resign": {
      if (!me?.captain) return { ok: false, error: "Вы не капитан" };
      if (room.status !== "gather") return { ok: false, error: "Драфт уже начался" };
      await prisma.lobbyMember.update({ where: { id: me.id }, data: { captain: false } });
      break;
    }

    case "unseat": {
      if (!isRoomAdmin) return { ok: false, error: "Снять капитана может админ комнаты" };
      if (room.status !== "gather") return { ok: false, error: "Драфт уже начался" };
      const cap = captainOf(room, intent.side);
      if (!cap) return { ok: false, error: "Капитан не выбран" };
      await prisma.lobbyMember.update({ where: { id: cap.id }, data: { captain: false } });
      break;
    }

    case "ready": {
      if (!me || me.side === null || me.role !== "player") return { ok: false, error: "Готовность подтверждают игроки стороны" };
      if (room.status !== "gather") return { ok: false, error: "Сбор уже закончен" };
      await prisma.lobbyMember.update({ where: { id: me.id }, data: { ready: intent.value } });
      break;
    }

    case "coin": {
      if (room.status !== "coin" || !room.coin) return { ok: false, error: "Монетка ещё не брошена" };
      const decided = await decideCoin(room, viewer, intent);
      if (decided) return { ok: false, error: decided };
      break;
    }
  }

  // Обе стороны собрались — бросаем монетку тут же: это событие комнаты, а не кнопка, которую
  // кто-то должен догадаться нажать.
  const after = await readRoom(id);
  if (after && after.status === "gather" && sideReady(after, 0) && sideReady(after, 1)) {
    await prisma.lobby.update({ where: { id }, data: { status: "coin", coinWinner: tossCoin() } });
  }

  const room2 = await broadcast(id);
  return room2 ? { ok: true, room: room2 } : { ok: false, error: "Лобби не найдено" };
}

/**
 * Выбор блока после монетки. Победитель выбирает ОДИН блок — сторону или очередь, второй достаётся
 * сопернику: его капитан заполняет оставшийся. Когда заполнены оба — собирается состояние драфта.
 */
async function decideCoin(room: LobbyRoom, viewer: LobbyViewer, intent: { block: "side" | "order"; value: TeamIdx }): Promise<string | null> {
  const coin = room.coin!;
  const first = coin.block === null; // первым выбирает победитель броска
  const turn: TeamIdx = first ? coin.winner : ((1 - coin.winner) as TeamIdx);
  const cap = captainOf(room, turn);
  if (!cap || cap.accountId !== viewer.accountId) return "Сейчас выбирает капитан другой стороны";
  if (!first && intent.block === coin.block) return "Этот блок уже разыгран";

  const data: { coinBlock?: string; firstPick?: number; radiant?: number; status?: string; payload?: string } = {};
  if (first) data.coinBlock = intent.block;
  if (intent.block === "side") data.radiant = intent.value;
  else data.firstPick = intent.value;

  const radiant = intent.block === "side" ? intent.value : coin.radiant;
  const firstPick = intent.block === "order" ? intent.value : coin.firstPick;
  if (radiant !== null && firstPick !== null) {
    const heroes = localHeroes().map((h) => ({ id: h.id, attr: h.primary_attr }));
    const state = newFearless(
      [
        { name: room.sides[0].name, color: room.sides[0].color },
        { name: room.sides[1].name, color: room.sides[1].color },
      ],
      { bestOf: room.bestOf, pool: buildPool(heroes), firstPick, radiant, mainSec: room.mainSec, reserveSec: room.reserveSec },
    );
    data.payload = JSON.stringify(state);
    data.status = "draft";
  }

  await prisma.lobby.update({ where: { id: room.id }, data });
  return null;
}

/** Лобби, которые видит этот человек: свои комнаты, а админу с `tools` — все. */
export async function listLobbies(viewer: LobbyViewer) {
  const rows = await prisma.lobby.findMany({
    where: viewer.admin ? undefined : { members: { some: { accountId: viewer.accountId } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { sideA: { select: { name: true } }, sideB: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status as LobbyStatus,
    sides: `${r.sideA.name} — ${r.sideB.name}`,
    updated: r.updatedAt,
  }));
}

export { sidePlayers };
