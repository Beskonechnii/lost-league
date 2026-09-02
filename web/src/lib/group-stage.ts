// Групповая стадия: снимок результатов из таблицы сезона (вкладка «GS») + сетка личных встреч.
// Живая таблица лиги считается отдельно — в standings.ts; здесь этап, который уже отыгран.

import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import { qualificationOf, seriesPoints } from "@/lib/qualification";
import { resolveUpload } from "@/lib/uploads";

export type GroupRow = {
  teamId: number;
  name: string;
  /** Всегда заполнен: свой из ростера либо выведенный из названия (см. teamTag). */
  tag: string;
  logo: string | null;
  place: number;
  /** Считается из сетки — поэтому правка встречи сразу видна и здесь, и в таблице лиги. */
  played: number;
  wins: number;
  losses: number;
  points: number;
  /** Взятые и отданные карты за все встречи группы — колонка «Карты» в таблице Кита (разница). */
  mapsWon: number;
  mapsLost: number;
  /**
   * Последние встречи, старые слева, новые справа — колонка «Форма» из Кита. Порядок по `playedAt`;
   * у встреч без даты его взять неоткуда, поэтому они идут в конец по id (порядок заведения).
   */
  form: ("w" | "l")[];
  /** Как напечатано в таблице сезона. Расходится — значит сетку правили; показываем оба числа. */
  sheet: { played: number; wins: number; losses: number; points: number };
};

/** Ячейка сетки. `flipped` — встреча хранится с другой стороны, показываем её зеркально. */
export type GroupCell = { id: number; score: string; guessed: boolean; flipped: boolean } | null;

export type GroupTable = {
  /** Имя дивизиона — для подписей; выборки идут по id (`divisionId`). */
  division: string;
  divisionId: number;
  /** Вылетают ли последние из группы — правило дивизиона, а не глобальное (qualification.ts). */
  relegation: boolean;
  group: string;
  rows: GroupRow[];
  /** Матрица [строка][столбец] в порядке rows: счёт серии глазами команды-строки. */
  grid: GroupCell[][];
  /** Сколько встреч восстановлено расчётом, а не прочитано из таблицы — их надо проверить руками. */
  guessedCount: number;
  /** Сколько встреч в группе ожидается по жеребьёвке: круговая, n·(n−1)/2. */
  expected: number;
  /** Сколько из них уже с результатом (счёт неравный). Меньше ожидаемого — стадия не доиграна. */
  decided: number;
};

/**
 * Групповая стадия дивизиона завершена? Признак **автоматический** (решение Стаса, 23.08.2026):
 * стадия закрыта, когда у всех ожидаемых встреч всех групп есть результат. Ручного переключателя
 * нет — иначе о нём забывают, и сетка стоит пустая при доигранных группах.
 *
 * Обратная сторона: незаведённой встречи для нас «не существует», поэтому недостача видна оператору
 * числом «сыграно X из Y» на странице групповой стадии — иначе стадия закроется раньше времени тихо.
 */
export function groupStageDone(tables: GroupTable[]): boolean {
  return tables.length > 0 && tables.every((t) => t.expected > 0 && t.decided >= t.expected);
}

/** Прогресс стадии по всем группам разом — для подписи «сыграно X из Y». */
export function groupStageProgress(tables: GroupTable[]) {
  return tables.reduce(
    (acc, t) => ({ decided: acc.decided + t.decided, expected: acc.expected + t.expected }),
    { decided: 0, expected: 0 },
  );
}

/**
 * Кто куда вышел: команды по зонам, в порядке места в группе. Для сетки плей-офф.
 *
 * Пока группа не доиграна, зоны пустые: посев из текущих позиций таблицы — это не жеребьёвка,
 * а моментальный снимок, и сетка меняла бы участников после каждой сыгранной встречи. До конца
 * стадии плей-офф показывает слоты-заглушки, а прогресс возвращается тут же (`decided`/`expected`).
 */
export async function getQualified(divisionId: number) {
  const tables = await getGroupStage(divisionId);
  const done = groupStageDone(tables);
  const progress = groupStageProgress(tables);
  if (!done) return { upper: [], lower: [], out: [], done, ...progress };

  const seeded = tables.flatMap((t) =>
    t.rows.map((r) => ({ ...r, group: t.group, zone: qualificationOf(r.place, t.rows.length, t.relegation) })),
  );
  const byPlace = (a: { place: number; group: string }, b: { place: number; group: string }) =>
    a.place - b.place || a.group.localeCompare(b.group);

  return {
    upper: seeded.filter((r) => r.zone === "upper").sort(byPlace),
    lower: seeded.filter((r) => r.zone === "lower").sort(byPlace),
    out: seeded.filter((r) => r.zone === "out").sort(byPlace),
    done,
    ...progress,
  };
}

/**
 * Групповая стадия дивизиона. Ключ — `divisionId`, а не имя: имена дивизионов повторяются из сезона
 * в сезон («Division 1» есть у каждого), и по имени таблицы двух турниров слились бы в одну.
 */
export async function getGroupStage(divisionId: number): Promise<GroupTable[]> {
  const [division, sheet, participants, series] = await Promise.all([
    prisma.division.findUnique({ where: { id: divisionId } }),
    prisma.groupEntry.findMany({
      where: { divisionId },
      include: { team: { select: { id: true, slug: true, name: true, tag: true, logo: true } } },
      orderBy: [{ group: "asc" }, { place: "asc" }],
    }),
    prisma.tournamentEntry.findMany({
      where: { divisionId },
      include: { team: { select: { id: true, slug: true, name: true, tag: true, logo: true } } },
      orderBy: [{ group: "asc" }, { seed: "asc" }],
    }),
    prisma.series.findMany({ where: { divisionId, stage: "group" } }),
  ]);
  if (!division) return [];

  /**
   * Строки таблицы. У сезона S2 они пришли снимком таблицы («GS»), поэтому там есть напечатанные
   * место и очки. У турнира, заведённого в админке, снимка нет — берём жеребьёвку (`TournamentEntry`)
   * и считаем всё из сетки. Так новый турнир показывает группы сразу после жеребьёвки, а не после
   * ручной заливки итогов.
   */
  const entries = sheet.length
    ? sheet
    : participants
        .filter((p) => p.group)
        .map((p) => ({
          teamId: p.teamId,
          team: p.team,
          group: p.group!,
          place: p.seed ?? 0,
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
        }));

  // Лого разрешаем разом до сборки таблиц: дальше идёт синхронный расчёт очков, асинхронность туда не тащим.
  const logoByTeam = new Map(
    await Promise.all(
      entries.map(async (e) => [e.teamId, await resolveUpload("teams", e.team.slug, "logo", e.team.logo)] as const),
    ),
  );

  const byGroup = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!byGroup.has(e.group)) byGroup.set(e.group, []);
    byGroup.get(e.group)!.push(e);
  }

  return [...byGroup.entries()].map(([group, list]) => {
    const mine = series.filter((s) => s.group === group);

    const rows: GroupRow[] = list.map((e) => {
      const played = mine.filter((s) => s.homeId === e.teamId || s.awayId === e.teamId);
      let wins = 0;
      let points = 0;
      let mapsWon = 0;
      let mapsLost = 0;
      for (const s of played) {
        const home = s.homeId === e.teamId;
        const own = home ? s.homeScore : s.awayScore;
        const opp = home ? s.awayScore : s.homeScore;
        if (own > opp) wins++;
        mapsWon += own;
        mapsLost += opp;
        points += seriesPoints(own, opp);
      }
      // Форма — только по встречам с результатом: незаведённая встреча это не ничья, а пустота,
      // и рисовать её в ряду формы значило бы сообщать исход, которого не было.
      const form = played
        .filter((s) => s.homeScore !== s.awayScore)
        .sort((a, b) => (a.playedAt?.getTime() ?? Infinity) - (b.playedAt?.getTime() ?? Infinity) || a.id - b.id)
        .map<"w" | "l">((s) => {
          const home = s.homeId === e.teamId;
          return (home ? s.homeScore > s.awayScore : s.awayScore > s.homeScore) ? "w" : "l";
        });
      return {
        teamId: e.teamId,
        name: e.team.name,
        tag: teamTag(e.team),
        logo: logoByTeam.get(e.teamId) ?? null,
        place: e.place,
        played: played.length,
        wins,
        losses: played.length - wins,
        points,
        mapsWon,
        mapsLost,
        form,
        sheet: { played: e.played, wins: e.wins, losses: e.losses, points: e.points },
      };
    });

    // Без снимка таблицы место считаем сами — по очкам, победам и алфавиту. Со снимком порядок
    // задавал организатор (при равенстве очков его по цифрам не восстановить), и мы его не трогаем.
    if (!sheet.length) {
      rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
      rows.forEach((r, i) => {
        r.place = i + 1;
      });
    }

    const grid = rows.map((r) =>
      rows.map<GroupCell>((c) => {
        if (r.teamId === c.teamId) return null; // диагональ — сам с собой не играет
        const direct = mine.find((s) => s.homeId === r.teamId && s.awayId === c.teamId);
        if (direct) {
          return { id: direct.id, score: `${direct.homeScore}:${direct.awayScore}`, guessed: direct.guessed, flipped: false };
        }
        // встреча записана с другой стороны — показываем зеркально
        const back = mine.find((s) => s.homeId === c.teamId && s.awayId === r.teamId);
        return back ? { id: back.id, score: `${back.awayScore}:${back.homeScore}`, guessed: back.guessed, flipped: true } : null;
      }),
    );

    return {
      division: division.name,
      divisionId,
      relegation: division.relegation,
      group,
      rows,
      grid,
      guessedCount: mine.filter((s) => s.guessed).length,
      expected: (rows.length * (rows.length - 1)) / 2,
      // «Есть результат» — неравный счёт: в архив пишут итог встречи, а не ведут её вживую.
      // Так же считается решённость серии в плей-офф (см. playoff.ts), включая техпоражения.
      decided: mine.filter((s) => s.homeScore !== s.awayScore).length,
    };
  });
}
