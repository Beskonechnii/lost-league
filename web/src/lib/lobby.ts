import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { can, currentAccount, isActiveAccount, type Account } from "./account";
import { withPlayerUploads, withTeamUploads } from "./uploads";
import { teamAccent } from "./profiles";
import { pushTo } from "./presence";
import { tellPlayer } from "./system-chat";
import { localHeroes } from "./dota-constants";
import {
  buildPool,
  canNextGame,
  currentTeam,
  newFearless,
  nextGame,
  tossCoin,
  type FearlessState,
  type TeamIdx,
} from "./fearless";
import { commitPick, parseState, settleTurn } from "./lobby-turn";
import {
  captainOf,
  sidePlayers,
  sideReady,
  type LobbyBoard,
  type LobbyCaptain,
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

  const state: FearlessState | null = parseState(row.payload);

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
    turn: {
      startedAt: row.turnStartedAt?.getTime() ?? null,
      now: Date.now(),
      reserve: [row.reserveA, row.reserveB],
      autoFrom: row.autoFrom,
    },
  };
}

/**
 * Ключ ОБС-вида: 128 бит из криптографического источника. Не id и не хеш чего-либо предсказуемого —
 * по этому адресу борд отдаётся БЕЗ входа (у браузерного источника OBS нет куки), и единственное,
 * что закрывает чужую встречу, — неугадываемость самой строки.
 */
const newObsKey = (): string => randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");

/** Ключ ОБС-вида комнаты — только тому, кто им пользуется: админу комнаты и участнику с ролью ОБС.
 *  Не в снимке `readRoom`: снимок один на всех и уходит всем участникам, а ключ — не всем. */
export async function obsKeyOf(room: LobbyRoom, viewer: LobbyViewer): Promise<string | null> {
  const me = room.members.find((m) => m.accountId === viewer.accountId) ?? null;
  const maySee = viewer.admin || room.ownerAccountId === viewer.accountId || me?.role === "admin" || me?.role === "caster";
  if (!maySee) return null;
  const row = await prisma.lobby.findUnique({ where: { id: room.id }, select: { obsKey: true } });
  return row?.obsKey ?? null;
}

/**
 * Борд по ключу ОБС-вида. Отдельная функция, а не срез `readRoom`, ровно потому, что состав
 * комнаты сюда попасть НЕ должен: по этому адресу нет входа, и всё, что вернёт эта функция,
 * доступно каждому, кому показали ключ. Здесь — картинка драфта и ничего больше.
 */
export async function readBoard(key: string): Promise<{ id: number; board: LobbyBoard } | null> {
  const row = await prisma.lobby.findUnique({
    where: { obsKey: key },
    include: {
      sideA: true,
      sideB: true,
      members: { where: { captain: true }, include: { player: true } },
    },
  });
  if (!row) return null;

  const side = async (t: typeof row.sideA) => {
    const withLogo = await withTeamUploads(t);
    return { teamId: t.id, name: t.name, color: teamAccent(t), logo: withLogo.logo };
  };

  const captain = async (idx: TeamIdx): Promise<LobbyCaptain | null> => {
    const m = row.members.find((x) => x.side === idx && x.role === "player");
    if (!m?.player) return null;
    const player = await withPlayerUploads(m.player);
    return { nickname: player.nickname, photo: player.photo };
  };

  return {
    id: row.id,
    board: {
      title: row.title,
      status: row.status as LobbyStatus,
      sides: [await side(row.sideA), await side(row.sideB)],
      bestOf: row.bestOf,
      captains: [await captain(0), await captain(1)],
      state: parseState(row.payload),
      turn: {
        startedAt: row.turnStartedAt?.getTime() ?? null,
        now: Date.now(),
        reserve: [row.reserveA, row.reserveB],
        autoFrom: row.autoFrom,
      },
    },
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

// ── часы хода ─────────────────────────────────────────────────────────────────
//
// Истечение хода обязано наступить от ВРЕМЕНИ, а не от того, что кто-то смотрит на экран: обе
// вкладки капитанов могут быть закрыты. Поэтому на срок хода взводится будильник в процессе, а
// сам срок лежит в БД (Lobby.turnStartedAt) — перезапуск процесса будильники теряет, но не срок:
// `armLobbyTimers()` поднимает их при старте (src/instrumentation.ts), а любое обращение к комнате
// сначала досчитывает пропущенное. То есть даже без будильника драфт не встанет, он лишь
// догоняет позже.
//
// Одна нода — вся картина (DEPLOY.md, как и presence.ts). Станет нод несколько — сюда встанет
// общая очередь, а договор этого файла не поменяется.

const g = globalThis as unknown as { lostLobbyTimers?: Map<number, NodeJS.Timeout> };
const timers: Map<number, NodeJS.Timeout> = (g.lostLobbyTimers ??= new Map());

function arm(id: number, deadline: number | null): void {
  const prev = timers.get(id);
  if (prev) clearTimeout(prev);
  timers.delete(id);
  if (deadline === null) return;
  // +250 мс, чтобы будильник срабатывал строго ПОСЛЕ срока: сработав на миллисекунду раньше,
  // он не увидел бы истечения и молча снял бы сам себя.
  const t = setTimeout(() => {
    timers.delete(id);
    void touchLobby(id).catch(() => {});
  }, Math.max(0, deadline - Date.now()) + 250);
  t.unref?.(); // будильник не должен сам по себе держать процесс живым
  timers.set(id, t);
}

/** Досчитать пропущенное время комнаты и перевзвести будильник. Ничего не рассылает. */
async function settle(id: number): Promise<boolean> {
  const { changed, deadline } = await settleTurn(id);
  arm(id, deadline);
  return changed;
}

/** То же плюс рассылка снимка: так комнату трогают чтение страницы, GET и сам будильник. */
export async function touchLobby(id: number): Promise<void> {
  if (await settle(id)) await broadcast(id);
}

/** Поднять будильники всех идущих драфтов при старте процесса (src/instrumentation.ts). */
export async function armLobbyTimers(): Promise<void> {
  const rows = await prisma.lobby.findMany({ where: { status: "draft" }, select: { id: true } });
  for (const r of rows) await touchLobby(r.id);
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
      obsKey: newObsKey(),
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
  | { kind: "coin"; block: "side" | "order"; value: TeamIdx }
  /** Ход капитана: «хочу этого героя», `at` — номер хода на карте в момент нажатия. */
  | { kind: "pick"; heroId: number; at: number }
  | { kind: "next" };

export type IntentResult = { ok: true; room: LobbyRoom } | { ok: false; error: string };

/**
 * Намерение участника. Всё, что можно нажать в комнате, проходит здесь — и здесь же проверяется,
 * можно ли это нажать именно ему. Клиент шлёт «хочу», а не «стало так».
 */
export async function applyIntent(id: number, viewer: LobbyViewer, intent: Intent): Promise<IntentResult> {
  // Сначала часы, потом чтение: ход мог истечь, пока запрос летел, и решать «его ли ход» надо
  // по состоянию ПОСЛЕ автохода, а не до него.
  await settle(id);
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

    case "pick": {
      // Четыре проверки подряд, отказ по каждой — своей причиной. Право `tools` здесь ни при чём:
      // админ лиги в чужой ход не ходит, ход вносит только капитан своей стороны (решение 3).
      if (room.status !== "draft" || !room.state) return { ok: false, error: "Драфт ещё не начался" };
      if (!me) return { ok: false, error: "Вас нет в этой комнате" };
      if (!me.captain || me.side === null) return { ok: false, error: "Ход вносит капитан стороны" };
      // Сторона лобби и индекс команды в драфте — одно и то же число: состояние собирается из
      // `room.sides` в том же порядке (см. `decideCoin`).
      if (currentTeam(room.state) !== me.side) return { ok: false, error: "Сейчас ход соперника" };
      const picked = await commitPick(id, me.side, intent.heroId, intent.at);
      if (!picked.ok) return { ok: false, error: picked.error };
      break;
    }

    case "next": {
      // Переход на карту — намерение АДМИНА комнаты, а не капитана: момент перехода определяется
      // сыгранной картой, о которой лобби не знает. Капитану такой кнопки не даём.
      if (!isRoomAdmin) return { ok: false, error: "Карту переводит админ комнаты" };
      if (room.status !== "draft" || !room.state) return { ok: false, error: "Драфт ещё не начался" };
      if (!canNextGame(room.state)) return { ok: false, error: "Карта ещё не задрафчена" };
      await startNextGame(id, room);
      break;
    }
  }

  // Обе стороны собрались — бросаем монетку тут же: это событие комнаты, а не кнопка, которую
  // кто-то должен догадаться нажать.
  const after = await readRoom(id);
  if (after && after.status === "gather" && sideReady(after, 0) && sideReady(after, 1)) {
    await prisma.lobby.update({ where: { id }, data: { status: "coin", coinWinner: tossCoin() } });
  }

  // Ещё раз часы: ход мог закрыть карту, а переход на следующую — открыть новый ход. Отметку
  // начала хода и будильник заводит `settle`, а рассылку делает общий `broadcast` ниже.
  await settle(id);

  const room2 = await broadcast(id);
  return room2 ? { ok: true, room: room2 } : { ok: false, error: "Лобби не найдено" };
}

/**
 * Следующая карта серии: новый пул БЕЗ уже взятых героев, обнулённая отметка хода и полные банки
 * обеим сторонам — то же, что делает `doNext` на админском борде, только на сервере.
 */
async function startNextGame(id: number, room: LobbyRoom): Promise<void> {
  // Payload перечитываем строкой: условие гонки сравнивает БАЙТЫ, а пересобранный из объекта
  // JSON совпадает с хранимым лишь по счастливой случайности.
  const row = await prisma.lobby.findUnique({ where: { id }, select: { payload: true } });
  const state = row ? parseState(row.payload) : null;
  if (!row || !state || !canNextGame(state)) return;

  const advanced = nextGame(state);
  const played = new Set<number>();
  for (const game of advanced.games) for (const m of game.moves) if (m.action === "pick") played.add(m.heroId);
  const pool = buildPool(localHeroes().filter((h) => !played.has(h.id)).map((h) => ({ id: h.id, attr: h.primary_attr })));

  await prisma.lobby.updateMany({
    where: { id, payload: row.payload },
    data: {
      payload: JSON.stringify({ ...advanced, pool }),
      turnStartedAt: null, // часы новой карты заведёт `settle` — он же взведёт будильник
      reserveA: room.reserveSec,
      reserveB: room.reserveSec,
      autoFrom: null,
    },
  });
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

  const data: {
    coinBlock?: string;
    firstPick?: number;
    radiant?: number;
    status?: string;
    payload?: string;
    reserveA?: number;
    reserveB?: number;
  } = {};
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
    // Банки выдаются здесь, а не дефолтом колонки: сколько доп-времени у стороны — настройка
    // встречи (`reserveSec`), и знает её лобби, а не схема.
    data.reserveA = room.reserveSec;
    data.reserveB = room.reserveSec;
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
