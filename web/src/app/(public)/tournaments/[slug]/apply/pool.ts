import "server-only";

import { prisma } from "@/lib/prisma";
import { listPlayers } from "@/lib/roster-data";
import { playerAccountId, teamAccent } from "@/lib/profiles";
import { isCoreRole } from "@/lib/roster-spots";
import { roleOrder } from "@/lib/roles";
import { withTeamUploads, withPlayerUploads } from "@/lib/uploads";
import { placeByRole } from "./slots";

// Пул игроков для сборки состава на сайте и занятые места. Только чтение и только для этого экрана,
// поэтому модуль лежит рядом со страницей, а не в `src/lib`.
//
// Пул — игроки лиги с `account_id` (в поле или выведенным из ссылки на профиль): без него человека
// не опознать в архиве матчей, и в составе от него нет толку. Человека вне пула добавить нельзя —
// он сначала регистрируется в боте и появляется здесь (BOT-PLAN.md, Э5).

export type PoolEntry = {
  id: number;
  nickname: string;
  realName: string | null;
  photo: string | null;
  mmr: number | null;
  /** Акцент ростерной команды — под аватарку-заглушку. */
  color: string | null;
  /** Где он сейчас в лиге: команда и роль. Нужно, чтобы капитан узнал человека среди тёзок. */
  teamName: string | null;
  role: string | null;
  /** Ключ привязки к прежней заявке: по нему строка состава находит игрока пула (см. page.tsx). */
  accountId: string;
};

/** Игрок в карточке готового состава — со всем, что рисует продуманная плитка. */
export type ReadyTeamPlayer = {
  id: number;
  nickname: string;
  realName: string | null;
  photo: string | null;
  role: string | null;
  mmr: number | null;
  isCaptain: boolean;
  /** В пуле лиги (есть account_id)? Если нет — в состав заявки не подставится, покажем блёкло. */
  inPool: boolean;
};

/**
 * Готовый состав капитана: команда целиком — лого, акцент, состав — плюс уже разложенные слоты доски.
 * Карточка даёт заявить команду как есть (продуманное отображение, а не строка с именем), а `slots`
 * заполняют доску для правок. Форма `slots`/`captainId` совпадает с `initial` доски (apply-board.tsx).
 */
export type ReadyTeam = {
  teamId: number;
  name: string;
  tag: string;
  logo: string | null;
  color: string | null;
  /** Весь состав команды в порядке ролей — включая тех, кого нет в пуле (их покажем, но не подставим). */
  players: ReadyTeamPlayer[];
  slots: Record<string, number | null>;
  captainId: number | null;
  /** Сколько человек из состава команды не попало в пул (нет account_id) — предупредим капитана. */
  lost: number;
};

/**
 * Команды, где вошедший игрок — капитан: их составы, готовые к заявке. Состав берём того же сезона,
 * где стоит капитанское место (`divisionId`): роспись сезонная, смешивать сезоны нельзя — плюс
 * бездивизионные строки. В пул попадают только игроки с account_id, поэтому остальных в состав заявки
 * не подставляем (`inPool: false`), но в карточке показываем и честно считаем в `lost`. Архивные
 * команды не предлагаем.
 */
export async function captainReadyTeams(playerId: number, pool: PoolEntry[]): Promise<ReadyTeam[]> {
  const captainRows = await prisma.rosterSpot.findMany({
    where: { playerId, isCaptain: true },
    select: { teamId: true, divisionId: true },
    orderBy: { divisionId: "desc" },
  });
  // Одна команда — один состав: если человек капитан в нескольких её сезонах, берём новейший.
  const pick = new Map<number, number | null>();
  for (const s of captainRows) if (!pick.has(s.teamId)) pick.set(s.teamId, s.divisionId);
  if (pick.size === 0) return [];

  const inPool = new Set(pool.map((p) => p.id));
  const teams = await prisma.team.findMany({
    where: { id: { in: [...pick.keys()] }, archivedAt: null },
    include: {
      roster: {
        include: { player: { select: { id: true, slug: true, nickname: true, realName: true, photo: true, mmr: true } } },
      },
    },
  });

  return Promise.all(
    teams.map(async (team) => {
      const divisionId = pick.get(team.id)!;
      const spots = team.roster
        .filter((s) => s.divisionId === divisionId || s.divisionId === null)
        .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

      const img = await withTeamUploads(team);
      const color = teamAccent(team);

      const players: ReadyTeamPlayer[] = await Promise.all(
        spots.map(async (s) => {
          const withPhoto = await withPlayerUploads(s.player);
          return {
            id: s.player.id,
            nickname: s.player.nickname,
            realName: s.player.realName,
            photo: withPhoto.photo,
            role: s.role,
            mmr: s.player.mmr,
            isCaptain: s.player.id === playerId,
            inPool: inPool.has(s.player.id),
          };
        }),
      );

      const rows = players
        .filter((p) => p.inPool)
        .map((p) => ({ id: p.id, role: p.role, isCaptain: p.isCaptain }));
      const { slots, captainId } = placeByRole(rows);

      return {
        teamId: team.id,
        name: team.name,
        tag: team.tag ?? "",
        logo: img.logo,
        color,
        players,
        slots,
        captainId,
        lost: players.filter((p) => !p.inPool).length,
      };
    }),
  );
}

/** Занятое место: игрок — действующий (поз. 1–5) в команде этого дивизиона. */
export type TakenSpot = {
  playerId: number;
  divisionId: number | null;
  teamSlug: string;
  teamName: string;
};

/** Пул: игроки лиги, которых можно поставить в состав. Порядок — по нику (как в `listPlayers`). */
export async function applyPool(): Promise<PoolEntry[]> {
  const players = await listPlayers();
  return players.flatMap((p) => {
    const accountId = playerAccountId(p);
    if (!accountId) return [];
    const team = p.main?.team ?? null;
    return [
      {
        id: p.id,
        nickname: p.nickname,
        realName: p.realName,
        photo: p.photo,
        mmr: p.mmr,
        color: team ? teamAccent(team) : teamAccent({ slug: p.slug, name: p.nickname }),
        teamName: team?.name ?? null,
        role: p.main?.role ?? null,
        accountId,
      },
    ];
  });
}

/**
 * Кто уже занят. Считаем по командам, **заявленным в этот турнир** (`TournamentEntry` в его
 * дивизионе), а не по всем строкам состава в нём: состав сезонный, и строки команды остаются в
 * дивизионе после того, как её из турнира убрали. Без этой сверки прошлогодний состав чужой
 * команды помечал бы пол-лиги занятой в турнире, где эта команда не играет.
 *
 * Слаг команды отдаём вместе с местом: если капитан заявляет ту же команду, в которой человек уже
 * стоит, это не конфликт — экран сам исключит её по слагу названия, как это делает
 * `applicationProblems` перед записью.
 */
export async function takenSpots(divisionIds: number[]): Promise<TakenSpot[]> {
  if (divisionIds.length === 0) return [];

  const entries = await prisma.tournamentEntry.findMany({
    where: { divisionId: { in: divisionIds } },
    select: { teamId: true, divisionId: true },
  });
  if (entries.length === 0) return [];
  const playing = new Set(entries.map((e) => `${e.teamId}:${e.divisionId}`));

  const spots = await prisma.rosterSpot.findMany({
    where: { divisionId: { in: divisionIds }, teamId: { in: entries.map((e) => e.teamId) } },
    include: { team: { select: { slug: true, name: true } } },
  });
  return spots
    .filter((s) => isCoreRole(s.role) && playing.has(`${s.teamId}:${s.divisionId}`))
    .map((s) => ({
      playerId: s.playerId,
      divisionId: s.divisionId,
      teamSlug: s.team.slug,
      teamName: s.team.name,
    }));
}
