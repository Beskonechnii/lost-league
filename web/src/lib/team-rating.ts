// Только сервер: рейтинг команды — её TP за турнир.
//
// Рейтинг это то, что **лига решила засчитать** (решение Стаса 15.09.2026, ТЗ 13, вариант C):
// сумма начислений оператора строками `PointsEntry(subjectType="team", reason="tp")`. Не очки за
// встречи (они сравнимы только внутри дивизиона) и не MMR состава (это анкета, а не достижение).
//
// Поля `Team.rating` нет и не будет: у команды и MMR не хранится, а считается по составу
// (DECISIONS, 23.07.2026). Рейтинг живёт там же — в расчёте, а не в кеше.
//
// Пара к `tp.ts`: тот же реестр, та же формула мест (`rankTotals`), различие — `subjectType`.

import { cache } from "react";
import { prisma } from "./prisma";
import { rankTotals, TP_REASON, type Rating } from "./tp";
import { currentTournament } from "./tournaments";

export type { Rating };

/** Субъект реестра, за которым закреплён рейтинг команды. */
const TEAM = "team";

/** Имена команд — для устойчивого порядка при равных очках. `cache` дедуплицирует внутри запроса. */
const teamNames = cache(async () => {
  const rows = await prisma.team.findMany({ select: { id: true, name: true } });
  return new Map(rows.map((t) => [t.id, t.name]));
});

/** Начисления TP командам за турнир: teamId → сумма. Турнир не задан — за всё время. */
export async function teamTpTotals(tournamentId?: number | null): Promise<Map<number, number>> {
  // Суммируем в памяти, а не groupBy — как `tpByTournament()` у игроков: строк реестра сотни.
  const rows = await prisma.pointsEntry.findMany({
    where: { subjectType: TEAM, reason: TP_REASON, ...(tournamentId ? { tournamentId } : {}) },
    select: { subjectId: true, amount: true },
  });
  const totals = new Map<number, number>();
  for (const r of rows) totals.set(r.subjectId, (totals.get(r.subjectId) ?? 0) + r.amount);
  return totals;
}

/**
 * Рейтинг команд турнира: teamId → очки и место. **Единственный вход витрин** — пул, страница
 * команды и служебный экран ходят сюда, своих формул по месту нет.
 *
 * Команды без начислений в карту не попадают вовсе: «нет строк = нет рейтинга», прочерк и хвост
 * списка, а не ноль на первом месте.
 */
export async function teamRating(tournamentId?: number | null): Promise<Map<number, Rating>> {
  const [totals, names] = await Promise.all([teamTpTotals(tournamentId), teamNames()]);
  return rankTotals(totals, (id) => names.get(id));
}

/**
 * Рейтинг в каждом турнире сразу — для разреза «По турнирам» на витрине пула: в секции турнира
 * стоит цифра за ЭТОТ турнир, а не за текущий. Считается на сервере, чтобы место не разъехалось
 * с серверным порядком списка.
 */
export async function teamRatingByTournament(): Promise<Map<string, Map<number, Rating>>> {
  // Порядок секций разреза задаёт `poolTournaments()`, здесь это просто справочник по слагу.
  const tournaments = await prisma.tournament.findMany({
    where: { status: { not: "draft" } },
    select: { id: true, slug: true },
  });
  const maps = await Promise.all(tournaments.map((t) => teamRating(t.id)));
  return new Map(tournaments.map((t, i) => [t.slug, maps[i]]));
}

/**
 * Начислить команде TP — **сумму, а не итог** (в отличие от панели игроков, где правится итог за
 * турнир). Команде начисляют разово: за место, за заслуги, — и итог это сумма строк; ввод итогом
 * стёр бы «за что».
 *
 * Турнир — текущий: начислений задним числом экран не делает.
 */
export async function awardTeamTp(teamId: number, amount: number, opts: { note?: string | null; by?: string | null } = {}) {
  const tournamentId = (await currentTournament())?.id ?? null;
  return prisma.pointsEntry.create({
    data: {
      subjectType: TEAM,
      subjectId: teamId,
      reason: TP_REASON,
      amount,
      tournamentId,
      note: opts.note?.trim() || null,
      createdBy: opts.by ?? null,
    },
  });
}

/**
 * Отменить начисление — **обратной строкой**, а не удалением и не правкой: реестр отвечает на
 * вопрос «за что и когда», ошибочная строка остаётся в журнале рядом со своей отменой.
 */
export async function revertTeamTp(entryId: number, opts: { by?: string | null } = {}) {
  const entry = await prisma.pointsEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.subjectType !== TEAM || entry.reason !== TP_REASON) throw new Error("Начисление не найдено");
  return prisma.pointsEntry.create({
    data: {
      subjectType: TEAM,
      subjectId: entry.subjectId,
      reason: TP_REASON,
      amount: -entry.amount,
      tournamentId: entry.tournamentId,
      note: `отмена: ${entry.note ?? `начисление #${entry.id}`}`,
      createdBy: opts.by ?? null,
    },
  });
}

/** Строка журнала служебного экрана: что, кому, за что и кто начислил. */
export type TeamTpEntry = {
  id: number;
  teamId: number;
  teamName: string;
  amount: number;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
};

/** Журнал начислений за турнир, свежие сверху. Турнир не задан — за всё время. */
export async function teamTpLedger(tournamentId?: number | null): Promise<TeamTpEntry[]> {
  const [rows, names] = await Promise.all([
    prisma.pointsEntry.findMany({
      where: { subjectType: TEAM, reason: TP_REASON, ...(tournamentId ? { tournamentId } : {}) },
      orderBy: { createdAt: "desc" },
    }),
    teamNames(),
  ]);
  return rows.map((r) => ({
    id: r.id,
    teamId: r.subjectId,
    teamName: names.get(r.subjectId) ?? `команда #${r.subjectId}`,
    amount: r.amount,
    note: r.note,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}
