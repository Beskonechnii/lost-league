import { prisma } from "@/lib/prisma";
import { seriesPoints } from "@/lib/qualification";
import { teamTag } from "@/lib/profiles";
import { TP_REASON } from "@/lib/tp";

export type StandingRow = {
  teamId: number;
  name: string;
  /** Всегда заполнен: свой из ростера либо выведенный из названия (см. teamTag). */
  tag: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  /** Из какой группы команда пришла на этап — чтобы в общей таблице было видно происхождение. */
  stageGroup: string | null;
  /** Место в группе из таблицы сезона. При равенстве очков порядок задавал организатор, из цифр он не выводится. */
  place: number | null;
};
export type StandingGroup = { group: string; rows: StandingRow[] };

/**
 * Standings не храним — считаем. Три слагаемых:
 *  • встречи (`Series`) любой стадии — очки по формуле Bo3, поэтому правка счёта в сетке
 *    сразу двигает таблицу лиги: это и есть синхронизация, отдельного копирования данных нет;
 *  • одиночные матчи (`Match`) **без серии** — всё, что завели до архива или мимо него;
 *  • реестр баллов (`PointsEntry`) — ручные начисления за места, касты и прочее.
 *
 * Матчи с `seriesId` намеренно пропускаем: карта серии уже посчитана в самой серии, иначе один
 * Bo3 дал бы четыре сыгранных вместо одного.
 *
 * Считаем по одному дивизиону: у D1 и D2 свои группы A/B, и без фильтра их очки слились бы в один
 * блок. Ключ — `divisionId`: команды берём по участию в турнире (`TournamentEntry`), встречи и итоги —
 * по тому же id. По имени дивизиона фильтровать нельзя — «Division 1» есть в каждом сезоне.
 */
export async function getStandings(divisionId: number): Promise<StandingGroup[]> {
  const [participants, entries, series, matches, points] = await Promise.all([
    prisma.tournamentEntry.findMany({ where: { divisionId }, include: { team: true } }),
    prisma.groupEntry.findMany({ where: { divisionId } }),
    prisma.series.findMany({ where: { divisionId } }),
    prisma.match.findMany({ where: { status: "finished", seriesId: null } }),
    // TP команды сюда не идут: это рейтинг лиги (`team-rating.ts`), а не очки дивизиона — иначе
    // начисление «за 1 место D1» задним числом двигало бы саму таблицу, по которой это место дано.
    prisma.pointsEntry.findMany({ where: { subjectType: "team", reason: { not: TP_REASON } } }),
  ]);

  const groups = new Map<string, StandingRow[]>();
  // Группа команды: из жеребьёвки участия, из таблицы сезона или из первой групповой встречи.
  const drawGroup = new Map(participants.map((p) => [p.teamId, p.group]));
  for (const t of participants.map((p) => p.team)) {
    const mine = series.filter((s) => s.homeId === t.id || s.awayId === t.id);
    let played = mine.length;
    let wins = 0;
    let pts = 0;
    for (const s of mine) {
      const home = s.homeId === t.id;
      const own = home ? s.homeScore : s.awayScore;
      const opp = home ? s.awayScore : s.homeScore;
      if (own > opp) wins++;
      pts += seriesPoints(own, opp);
    }

    const played2 = matches.filter((m) => m.teamAId === t.id || m.teamBId === t.id);
    played += played2.length;
    wins += played2.filter((m) => m.winnerTeamId === t.id).length;
    pts += points.filter((p) => p.subjectId === t.id).reduce((s, p) => s + p.amount, 0);

    const entry = entries.find((e) => e.teamId === t.id);
    const row: StandingRow = {
      teamId: t.id,
      name: t.name,
      tag: teamTag(t),
      played,
      wins,
      losses: played - wins,
      points: pts,
      // Группа команды: из таблицы сезона, иначе — из первой групповой встречи (у плей-офф её нет).
      stageGroup: drawGroup.get(t.id) ?? entry?.group ?? mine.find((s) => s.group)?.group ?? null,
      place: entry?.place ?? null,
    };
    // Делим по группе группового этапа: команды из разных групп между собой не играли,
    // поэтому в одной таблице их очки несопоставимы. Без группы — отдельным блоком.
    const g = row.stageGroup ?? "—";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(row);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, rows]) => ({
      group,
      // Место из таблицы сезона главнее расчёта: при равенстве очков и побед порядок задавал
      // организатор (morbus mentis / Eclipse Gaming — 4-3 и 12 очков у обеих), и по цифрам его не
      // восстановить. Без места — считаем сами.
      rows: rows.sort(
        (a, b) =>
          (a.place !== null && b.place !== null ? a.place - b.place : 0) ||
          b.points - a.points ||
          b.wins - a.wins ||
          a.name.localeCompare(b.name),
      ),
    }));
}
