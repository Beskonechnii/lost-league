import "server-only";

import { prisma } from "@/lib/prisma";
import { listPlayers } from "@/lib/roster-data";
import { playerAccountId, teamAccent } from "@/lib/profiles";
import { isCoreRole } from "@/lib/roster-spots";

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
 * Кто уже занят. Считаем только места в дивизионах **этого** турнира (плюс места вне дивизиона):
 * действующим можно быть в одной команде дивизиона, а в прошлом сезоне тот же человек стоит где
 * угодно и заявке не мешает (`src/lib/roster-spots.ts`).
 *
 * Слаг команды отдаём вместе с местом: если капитан заявляет ту же команду, в которой человек уже
 * стоит, это не конфликт — экран сам исключит её по слагу названия, как это делает
 * `applicationProblems` перед записью.
 */
export async function takenSpots(divisionIds: number[]): Promise<TakenSpot[]> {
  const spots = await prisma.rosterSpot.findMany({
    where: { OR: [{ divisionId: { in: divisionIds } }, { divisionId: null }] },
    include: { team: { select: { slug: true, name: true } } },
  });
  return spots
    .filter((s) => isCoreRole(s.role))
    .map((s) => ({
      playerId: s.playerId,
      divisionId: s.divisionId,
      teamSlug: s.team.slug,
      teamName: s.team.name,
    }));
}
