import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { can, currentAccount, isActiveAccount, type Account } from "./account";
import { withPlayerUploads } from "./uploads";
import { teamAccent } from "./profiles";
import { pushTo } from "./presence";
import { tellAccount } from "./system-chat";
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
  SIDE_COACHES,
  SIDE_PLAYERS,
  captainOf,
  isStaff,
  sidePlayers,
  sideReady,
  type LobbyBoard,
  type LobbyCaptain,
  type LobbyMemberView,
  type LobbyRole,
  type LobbySide,
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

/** Кто открывает комнату: аккаунт, признак админа лиги (право `tools`) и признак игрока лиги —
 *  по второму решается, видит ли он список открытых комнат и пускают ли его по паролю. */
export type LobbyViewer = { accountId: number; playerId: number | null; admin: boolean; league: boolean };

export async function currentViewer(): Promise<LobbyViewer | null> {
  const account = await currentAccount();
  if (!account) return null;
  return {
    accountId: account.id,
    playerId: account.player?.id ?? null,
    admin: await can("tools"),
    league: isLeaguePlayer(account),
  };
}

/** Игрок лиги — одобренный аккаунт с профилем. Он видит список комнат и входит в них по паролю. */
const isLeaguePlayer = (account: Account | null): boolean => !!account?.player && isActiveAccount(account);

/** Заводит комнату ТОЛЬКО админ с правом `tools` (ТЗ 42б): комната с паролем — инструмент
 *  организатора встречи, а не кнопка игрока. */
export async function canCreateLobby(): Promise<boolean> {
  return can("tools");
}

const ROLES: LobbyRole[] = ["player", "coach", "caster", "admin"];
const asRole = (raw: string): LobbyRole => (ROLES.includes(raw as LobbyRole) ? (raw as LobbyRole) : "player");
const asSide = (raw: number | null): TeamIdx | null => (raw === 0 || raw === 1 ? raw : null);

/** Стороны комнаты: имя из самого лобби, цвет — из имени (`teamAccent` считает его по строке,
 *  пока кожа 42е не даст свой). Карточки команды ростера здесь больше нет: привязка к `Team`
 *  отменена решением 24.09.2026. */
const sidesOf = (row: { sideAName: string; sideBName: string }): [LobbySide, LobbySide] => [
  { name: row.sideAName, color: teamAccent({ name: row.sideAName }) },
  { name: row.sideBName, color: teamAccent({ name: row.sideBName }) },
];

/** Снимок комнаты — один на всех: «моё ли это» клиент считает сам по своему accountId. */
export async function readRoom(id: number): Promise<LobbyRoom | null> {
  const row = await prisma.lobby.findUnique({
    where: { id },
    include: { members: { include: { player: true }, orderBy: { id: "asc" } } },
  });
  if (!row) return null;

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
    sides: sidesOf(row),
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
            at: row.coinAt?.getTime() ?? null,
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

/**
 * Секреты комнаты — ключ ОБС-вида и пароль двери. Не в снимке `readRoom`: снимок один на всех и
 * уходит всем участникам, а эти две строки полагаются не всем. Ключ видит тот, кто им пользуется
 * (админ комнаты и ОБС), пароль — только админ комнаты: он его диктует и меняет.
 */
export async function roomSecrets(
  room: LobbyRoom,
  viewer: LobbyViewer,
): Promise<{ obsKey: string | null; password: string | null }> {
  const me = room.members.find((m) => m.accountId === viewer.accountId) ?? null;
  const isRoomAdmin = viewer.admin || room.ownerAccountId === viewer.accountId;
  const maySeeKey = isRoomAdmin || me?.role === "admin" || me?.role === "caster";
  if (!maySeeKey && !isRoomAdmin) return { obsKey: null, password: null };
  const row = await prisma.lobby.findUnique({ where: { id: room.id }, select: { obsKey: true, password: true } });
  return {
    obsKey: maySeeKey ? (row?.obsKey ?? null) : null,
    password: isRoomAdmin ? (row?.password ?? null) : null,
  };
}

/**
 * Борд по ключу ОБС-вида. Отдельная функция, а не срез `readRoom`, ровно потому, что состав
 * комнаты сюда попасть НЕ должен: по этому адресу нет входа, и всё, что вернёт эта функция,
 * доступно каждому, кому показали ключ. Здесь — картинка драфта и ничего больше.
 */
export async function readBoard(key: string): Promise<{ id: number; board: LobbyBoard } | null> {
  const row = await prisma.lobby.findUnique({
    where: { obsKey: key },
    include: { members: { where: { captain: true }, include: { player: true } } },
  });
  if (!row) return null;

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
      sides: sidesOf(row),
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

export type CreateLobbyInput = {
  title: string;
  password: string;
  sideAName: string;
  sideBName: string;
  mainSec: number;
  reserveSec: number;
  bestOf: number;
  seriesId: number | null;
};

export type CreateResult = { ok: true; id: number } | { ok: false; error: string };

/**
 * Создание комнаты (ТЗ 42б): название, пароль и имена сторон. Составов здесь нет — люди заходят
 * сами по паролю или по приглашению уже ИЗ комнаты: до входа неизвестно, кто вообще придёт, а
 * список приглашённых в форме заставлял админа собирать встречу до встречи.
 */
export async function createLobby(input: CreateLobbyInput): Promise<CreateResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: "Нужно войти" };
  if (!(await canCreateLobby())) return { ok: false, error: "Комнату заводит админ лиги" };
  if (!input.password.trim()) return { ok: false, error: "Задайте пароль комнаты" };

  const lobby = await prisma.lobby.create({
    data: {
      title: input.title,
      password: input.password,
      sideAName: input.sideAName,
      sideBName: input.sideBName,
      obsKey: newObsKey(),
      mainSec: input.mainSec,
      reserveSec: input.reserveSec,
      bestOf: input.bestOf,
      seriesId: input.seriesId,
      ownerAccountId: account.id,
      // Создатель всегда в комнате — иначе завёл бы её и не смог войти.
      members: {
        create: [{ accountId: account.id, playerId: account.player?.id ?? null, side: null, role: "admin" }],
      },
    },
    select: { id: true },
  });

  return { ok: true, id: lobby.id };
}

export type Intent =
  /** Вход по паролю: единственное намерение, которое шлёт ещё НЕ участник комнаты. */
  | { kind: "enter"; password: string }
  /** Настройки двери: название, пароль и имена сторон. Правит админ комнаты. */
  | { kind: "settings"; title: string; password: string; sideAName: string; sideBName: string }
  /** Позвать человека в комнату личным сообщением — второй путь внутрь, мимо пароля. */
  | { kind: "invite"; playerId: number }
  | { kind: "join" }
  /** «Встаю за сторону» — выбор места самим человеком: сторона и роль (игрок · тренер).
   *  `side: null` — обратно в «Неопределившиеся». */
  | { kind: "sit"; side: TeamIdx | null; role: LobbyRole }
  /** Тот же перенос, но чужой: админ комнаты двигает любого — включая снятие в «Неопределившиеся». */
  | { kind: "seat"; memberId: number; side: TeamIdx | null; role: LobbyRole }
  /** Покинуть комнату (решение 25.09.2026): членство удаляется, вернуться — по паролю заново. */
  | { kind: "leave" }
  | { kind: "captain" }
  | { kind: "resign" }
  /** Капитан стороны глазами админа комнаты: `memberId` — назначить этого, `null` — просто снять. */
  | { kind: "unseat"; side: TeamIdx; memberId: number | null }
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

  // Вход по паролю — ДО проверки членства: его шлёт ровно тот, кого в комнате ещё нет.
  if (intent.kind === "enter") {
    const failed = await enterByPassword(room, viewer, intent.password);
    if (failed) return { ok: false, error: failed };
    const entered = await broadcast(id);
    return entered ? { ok: true, room: entered } : { ok: false, error: "Лобби не найдено" };
  }

  if (!mayEnter(room, viewer)) return { ok: false, error: "Лобби не найдено" };

  const me = room.members.find((m) => m.accountId === viewer.accountId) ?? null;
  // Админ комнаты — не игрок (решение 3): он смотрит и может снять капитана, но не становится им
  // и не подтверждает готовность за сторону.
  const isRoomAdmin = viewer.admin || room.ownerAccountId === viewer.accountId;

  switch (intent.kind) {
    case "settings": {
      if (!isRoomAdmin) return { ok: false, error: "Настройки комнаты меняет её админ" };
      const names = intent.sideAName !== room.sides[0].name || intent.sideBName !== room.sides[1].name;
      // Имена сторон после старта драфта не меняются: они уже уехали в эфир и в состояние драфта.
      // Название и пароль меняются всегда — пароль это дверь, а не часть картинки встречи.
      if (names && room.status !== "gather") return { ok: false, error: "Имена сторон меняются до начала драфта" };
      if (!intent.password.trim()) return { ok: false, error: "Пароль не может быть пустым" };
      await prisma.lobby.update({
        where: { id },
        data: {
          title: intent.title,
          password: intent.password,
          ...(names ? { sideAName: intent.sideAName, sideBName: intent.sideBName } : {}),
        },
      });
      // Смена пароля никого не выбрасывает: внутри держит `LobbyMember`, а пароль — только дверь.
      break;
    }

    case "invite": {
      if (!isRoomAdmin) return { ok: false, error: "Приглашает админ комнаты" };
      const invited = await invitePlayer(room, intent.playerId);
      if (invited) return { ok: false, error: invited };
      break;
    }

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

    case "sit": {
      if (!me) return { ok: false, error: "Вас нет в этой комнате" };
      // Администрацией человек себя не назначает (решение 24.09.2026): право `tools` — или его
      // ставит туда админ комнаты намерением `seat`.
      if (isStaff(intent.role) && !viewer.admin) return { ok: false, error: "В администрацию ставит админ комнаты" };
      const no = seatRefusal(room, me, intent.side, intent.role);
      if (no) return { ok: false, error: no };
      await seatMember(me, intent.side, intent.role);
      break;
    }

    case "seat": {
      if (!isRoomAdmin) return { ok: false, error: "Людей переносит админ комнаты" };
      const target = room.members.find((m) => m.id === intent.memberId);
      if (!target) return { ok: false, error: "Такого участника в комнате нет" };
      const no = seatRefusal(room, target, intent.side, intent.role);
      if (no) return { ok: false, error: no };
      await seatMember(target, intent.side, intent.role);
      break;
    }

    case "leave": {
      if (!me) return { ok: false, error: "Вас нет в этой комнате" };
      // После старта драфта выхода нет: сторона не разваливается посреди ходов, а капитан,
      // который «вышел», оставил бы комнату без ходящего вовсе.
      if (room.status !== "gather") return { ok: false, error: "Комнату покидают до начала драфта" };
      await prisma.lobbyMember.delete({ where: { id: me.id } });
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
      await prisma.lobbyMember.update({ where: { id: me.id }, data: { captain: false, ready: false } });
      break;
    }

    case "unseat": {
      if (!isRoomAdmin) return { ok: false, error: "Капитана назначает админ комнаты" };
      if (room.status !== "gather") return { ok: false, error: "Драфт уже начался" };
      const cap = captainOf(room, intent.side);
      const next = intent.memberId === null ? null : (room.members.find((m) => m.id === intent.memberId) ?? null);
      if (intent.memberId !== null && (next?.side !== intent.side || next.role !== "player"))
        return { ok: false, error: "Капитаном становится игрок этой стороны" };
      if (!cap && !next) return { ok: false, error: "Капитан не выбран" };
      // Снятие и назначение одной транзакцией: «два капитана у стороны» не должно существовать
      // даже на миллисекунду — по капитану сервер решает, чей ход и кто жмёт «Готов».
      await prisma.$transaction(async (tx) => {
        if (cap) await tx.lobbyMember.update({ where: { id: cap.id }, data: { captain: false, ready: false } });
        if (next) await tx.lobbyMember.update({ where: { id: next.id }, data: { captain: true, ready: false } });
      });
      break;
    }

    case "ready": {
      // Готовность стороны жмёт КАПИТАН (ТЗ 42в §5), а не каждый из пятерых: собирать пять
      // нажатий на каждую карту серии — работа, которой встреча не требует.
      if (!me?.captain || me.side === null) return { ok: false, error: "Готовность подтверждает капитан стороны" };
      if (room.status !== "gather") return { ok: false, error: "Сбор уже закончен" };
      if (intent.value && sidePlayers(room, me.side).length < SIDE_PLAYERS)
        return { ok: false, error: `В составе меньше ${SIDE_PLAYERS} игроков` };
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
    // Отметку броска пишем вместе с исходом: от неё все вкладки отсчитывают анимацию монетки,
    // и без неё каждая играла бы её в свой момент (DESIGN-4).
    await prisma.lobby.update({ where: { id }, data: { status: "coin", coinWinner: tossCoin(), coinAt: new Date() } });
  }

  // Ещё раз часы: ход мог закрыть карту, а переход на следующую — открыть новый ход. Отметку
  // начала хода и будильник заводит `settle`, а рассылку делает общий `broadcast` ниже.
  await settle(id);

  const room2 = await broadcast(id);
  return room2 ? { ok: true, room: room2 } : { ok: false, error: "Лобби не найдено" };
}

// ── состав сторон (ТЗ 42в) ────────────────────────────────────────────────────
//
// Лимит держит СЕРВЕР, а не погашенная кнопка: отказ приходит текстом и называет причину.
// Погашенная кнопка объясняет «почему нельзя» только тому, кто и так видит весь состав, а
// вкладка шестого игрока могла узнать о пятом секунду назад.

/** Можно ли поставить человека на это место. Возвращает текст отказа или null. */
function seatRefusal(room: LobbyRoom, member: LobbyMemberView, side: TeamIdx | null, role: LobbyRole): string | null {
  if (room.status !== "gather") return "Состав меняется до начала драфта";
  // Администрация стоит вне сторон и лимита не имеет: она не играет, а ведёт комнату.
  if (isStaff(role)) return side === null ? null : "Администрация стоит вне сторон";
  if (side === null) return null;

  const limit = role === "coach" ? SIDE_COACHES : SIDE_PLAYERS;
  const taken = room.members.filter((m) => m.side === side && m.role === role && m.id !== member.id).length;
  if (taken < limit) return null;
  const name = room.sides[side].name;
  return role === "coach" ? `У стороны «${name}» уже есть тренер` : `В составе «${name}» уже ${SIDE_PLAYERS} игроков`;
}

/** Переставить человека. Капитанство и готовность принадлежат МЕСТУ, а не человеку: уходя со
 *  стороны (или из игроков в тренеры), он складывает и то и другое. */
async function seatMember(member: LobbyMemberView, side: TeamIdx | null, role: LobbyRole): Promise<void> {
  await prisma.lobbyMember.update({
    where: { id: member.id },
    data: { side, role, captain: member.captain && side === member.side && role === "player", ready: false },
  });
}

// ── дверь комнаты (ТЗ 42б) ────────────────────────────────────────────────────
//
// Пароль лежит открытым текстом, и это осознанно (решение 24.09.2026): это код доступа на вечер,
// который админ диктует голосом, а не секрет аккаунта. Зато открытый пароль обязан быть защищён
// от ПЕРЕБОРА — иначе комната открывается скриптом за минуту. Счётчик неудач держим в памяти
// процесса, как будильники ходов: нода одна (DEPLOY.md), а переживать перезапуск ему незачем —
// после рестарта начинает заново и перебор.

const FAIL_MAX = 5;
const FAIL_PAUSE_MS = 60_000;

type Tries = { fails: number; until: number };
const gTries = globalThis as unknown as { lostLobbyTries?: Map<number, Tries> };
const tries: Map<number, Tries> = (gTries.lostLobbyTries ??= new Map());

/** Вход по паролю. Возвращает текст отказа или null, если человек теперь в комнате. */
async function enterByPassword(room: LobbyRoom, viewer: LobbyViewer, password: string): Promise<string | null> {
  if (room.members.some((m) => m.accountId === viewer.accountId)) return null; // уже внутри
  if (!viewer.league && !viewer.admin) return "Комнаты открыты игрокам лиги с одобренной анкетой";

  const now = Date.now();
  const prev = tries.get(viewer.accountId);
  if (prev && prev.until > now) return `Слишком много попыток. Подождите ${Math.ceil((prev.until - now) / 1000)} с.`;
  // Пауза вышла — счёт начинается заново, иначе одна давняя серия ошибок наказывала бы навсегда.
  const fails = prev && prev.until ? 0 : (prev?.fails ?? 0);

  const row = await prisma.lobby.findUnique({ where: { id: room.id }, select: { password: true } });
  if (!row || !row.password || row.password !== password.trim()) {
    const next = fails + 1;
    tries.set(viewer.accountId, { fails: next, until: next >= FAIL_MAX ? now + FAIL_PAUSE_MS : 0 });
    return "Пароль не подошёл";
  }
  tries.delete(viewer.accountId);

  // Сторону и роль вошедший выбирает сам уже внутри (42в): дверь ставит его «вне сторон».
  await prisma.lobbyMember.upsert({
    where: { lobbyId_accountId: { lobbyId: room.id, accountId: viewer.accountId } },
    update: { joinedAt: new Date() },
    create: {
      lobbyId: room.id,
      accountId: viewer.accountId,
      playerId: viewer.playerId,
      side: null,
      role: "player",
      joinedAt: new Date(),
    },
  });
  return null;
}

/**
 * Приглашение — второй путь внутрь, мимо пароля: админ комнаты заводит человеку членство и шлёт
 * личное сообщение от «Spirit CTRL» с кнопкой. Своего механизма уведомлений не заводим; состояние
 * кнопки читается из самого лобби (`chat-actions.ts`).
 */
async function invitePlayer(room: LobbyRoom, playerId: number): Promise<string | null> {
  // Одобренность анкеты здесь НЕ проверяется, и это весь смысл приглашения: список комнат открыт
  // только игроку лиги, а позвать админ может кого угодно с аккаунтом — в том числе того, чья
  // анкета ещё висит. Без аккаунта звать некуда: приглашение приходит сообщением, а в комнату
  // пускается аккаунт.
  const account = await prisma.userAccount.findFirst({ where: { playerId }, select: { id: true } });
  if (!account) return "У игрока нет аккаунта в лиге — позвать некуда";

  await prisma.lobbyMember.upsert({
    where: { lobbyId_accountId: { lobbyId: room.id, accountId: account.id } },
    update: {},
    create: { lobbyId: room.id, accountId: account.id, playerId, side: null, role: "player" },
  });
  // Пишем АККАУНТУ, а не игроку: `tellPlayer` молчит, если анкета ещё не одобрена, — а это ровно
  // тот человек, ради которого приглашение и заведено.
  await tellAccount(account.id, `Вас зовут в лобби «${room.title}». Комната открыта — заходите.`, {
    kind: "lobby-invite",
    payload: { lobbyId: room.id },
  });
  return null;
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

/**
 * Открытые комнаты — ОДОБРЕННОМУ игроку лиги и админу (ТЗ 42б §5): список и есть дверь, через
 * которую заходят по паролю. Вошедшему без одобренной анкеты списка нет вовсе — его зовут
 * приглашением. Сыгранные комнаты (`done`) не показываем: заходить в них уже незачем.
 */
export async function listLobbies(viewer: LobbyViewer) {
  if (!viewer.league && !viewer.admin) return [];
  const rows = await prisma.lobby.findMany({
    where: { status: { not: "done" } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      sideAName: true,
      sideBName: true,
      updatedAt: true,
      _count: { select: { members: true } },
      members: { where: { accountId: viewer.accountId }, select: { id: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status as LobbyStatus,
    sides: `${r.sideAName} — ${r.sideBName}`,
    people: r._count.members,
    /** Уже внутри — пароль спрашивать не за что, кнопка ведёт прямо в комнату. */
    mine: r.members.length > 0,
    updated: r.updatedAt,
  }));
}

export { sidePlayers };
