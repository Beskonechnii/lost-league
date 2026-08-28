// Только сервер: архив серий — чтение и правка встреч любой стадии плюс привязка карт.
//
// Серия (`Series`) — единственный контейнер отыгранной встречи: из неё считается и сетка группы
// (src/lib/group-stage.ts), и таблица лиги (src/lib/standings.ts), и рейтинги (src/lib/leaders.ts).
// Карта попадает в архив только отсюда: `attachGame` заводит `Match` и зовёт синк статы.

import { prisma } from "@/lib/prisma";
import { syncMatch } from "@/lib/match-sync";
import { loadMatchReport } from "@/lib/match-api";
import { teamTag } from "@/lib/profiles";
import { isStage, type Bracket, type Stage } from "@/lib/stages";
import { slotByKey, validScores } from "@/lib/playoff-bracket";
import { resolveUpload } from "@/lib/uploads";

export type SeriesGame = {
  matchId: number;
  gameNumber: number | null;
  openDotaMatchId: string | null;
  durationSec: number | null;
  startedAt: Date | null;
  winnerTeamId: number | null;
  statsCount: number;
};

export type SeriesRow = {
  id: number;
  /** Ключ адреса `/series/<slug>` — переживает `db:import`, в отличие от `id`. */
  slug: string;
  division: string;
  /** Истина о принадлежности встречи дивизиону; `division` — имя-зеркало для подписей. */
  divisionId: number | null;
  stage: string;
  group: string | null;
  bracket: string | null;
  round: string | null;
  /** Позиция в сетке плей-офф — ключ слота (src/lib/playoff-bracket.ts). У групповых пусто. */
  slot: string | null;
  playedAt: Date | null;
  /** Запланированное время начала. Его правит оператор, и из него живут напоминания (tg-schedule.ts). */
  startAt: Date | null;
  guessed: boolean;
  home: { id: number; name: string; tag: string; logo: string | null };
  away: { id: number; name: string; tag: string; logo: string | null };
  homeScore: number;
  awayScore: number;
  games: SeriesGame[];
};

const teamSelect = { select: { id: true, slug: true, name: true, tag: true, logo: true } } as const;

/** Счёт серии Bo3 — только эти исходы; всё прочее ломает формулу очков (см. qualification.ts). */
export const VALID_SCORES = ["2:0", "2:1", "1:2", "0:2"];

export type SeriesFilter = {
  id?: number;
  slug?: string;
  divisionId?: number;
  /** Все дивизионы турнира разом — архив режется по турнирам, а не по одному дивизиону. */
  divisionIds?: number[];
  stage?: Stage;
  group?: string;
  bracket?: Bracket;
  teamId?: number;
};

/**
 * Серии по фильтру, свежие сверху. `playedAt` заполняется не всегда (групповую стадию заливали
 * снимком таблицы, без дат), поэтому вторым ключом идёт id — иначе порядок скачет между запросами.
 */
export async function listSeries(filter: SeriesFilter = {}): Promise<SeriesRow[]> {
  const rows = await prisma.series.findMany({
    where: {
      id: filter.id,
      slug: filter.slug,
      divisionId: filter.divisionIds ? { in: filter.divisionIds } : filter.divisionId,
      stage: filter.stage,
      group: filter.group,
      bracket: filter.bracket,
      ...(filter.teamId ? { OR: [{ homeId: filter.teamId }, { awayId: filter.teamId }] } : {}),
    },
    include: {
      home: teamSelect,
      away: teamSelect,
      games: { orderBy: { gameNumber: "asc" }, include: { _count: { select: { stats: true } } } },
    },
    orderBy: [{ playedAt: "desc" }, { id: "desc" }],
  });

  // Лого резолвятся файлами на диске — разом до сборки, чтобы не сыпать await в цикле.
  const logos = new Map(
    await Promise.all(
      rows
        .flatMap((r) => [r.home, r.away])
        .map(async (t) => [t.id, await resolveUpload("teams", t.slug, "logo", t.logo)] as const),
    ),
  );
  const team = (t: { id: number; name: string; tag: string | null }) => ({
    id: t.id,
    name: t.name,
    tag: teamTag(t),
    logo: logos.get(t.id) ?? null,
  });

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    division: r.division,
    divisionId: r.divisionId,
    stage: r.stage,
    group: r.group,
    bracket: r.bracket,
    round: r.round,
    slot: r.slot,
    playedAt: r.playedAt,
    startAt: r.startAt,
    guessed: r.guessed,
    home: team(r.home),
    away: team(r.away),
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    games: r.games.map((g) => ({
      matchId: g.id,
      gameNumber: g.gameNumber,
      openDotaMatchId: g.openDotaMatchId,
      durationSec: g.durationSec,
      startedAt: g.startedAt,
      winnerTeamId: g.winnerTeamId,
      statsCount: g._count.stats,
    })),
  }));
}

/** Встреча по ключу из адреса: слаг, либо (для старых ссылок и админки) числовой id. */
export async function getSeries(key: string | number): Promise<SeriesRow | null> {
  const id = typeof key === "number" ? key : /^\d+$/.test(key) ? Number(key) : undefined;
  const [row] = await listSeries(id !== undefined ? { id } : { slug: String(key) });
  return row ?? null;
}

/**
 * Слаг встречи: `<хозяева>-vs-<гости>` по слагам команд — сквозному ключу проекта.
 * Одна и та же пара может сыграть дважды (группа и плей-офф, верхняя сетка и гранд-финал),
 * поэтому занятый слаг получает числовой хвост. Считается один раз при создании и дальше живёт
 * в базе: пересчитывать его при правке значило бы ломать уже отданные наружу ссылки.
 */
async function uniqueSlug(homeId: number, awayId: number): Promise<string> {
  const teams = await prisma.team.findMany({ where: { id: { in: [homeId, awayId] } }, select: { id: true, slug: true } });
  const slugOf = (id: number) => teams.find((t) => t.id === id)?.slug ?? String(id);
  const base = `${slugOf(homeId)}-vs-${slugOf(awayId)}`;

  const taken = new Set(
    (await prisma.series.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((s) => s.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

// --- Развёрнутая серия для публичной страницы ---

export type GamePlayer = {
  playerId: number;
  nickname: string;
  heroSlug: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  netWorth: number;
};

/** Карта глазами страницы серии: обе стороны с составами, счёт по убийствам, кто был за свет. */
export type SeriesGameDetail = SeriesGame & {
  radiantTeamId: number | null;
  radiantScore: number | null;
  direScore: number | null;
  firstPickRadiant: boolean | null;
  /** Игроки по командам — ключ совпадает с `home.id`/`away.id` серии. */
  byTeam: Record<number, GamePlayer[]>;
};

export type SeriesDetail = Omit<SeriesRow, "games"> & { games: SeriesGameDetail[] };

/**
 * Серия со всеми составами. Отдельно от `listSeries` намеренно: списку архива стата игроков не нужна,
 * а тянуть её на сотню серий — лишние сотни строк на каждый рендер списка.
 *
 * Команда игрока выводится из `won` + победителя карты: стороны в строке статы нет, и заводить её
 * ради этого не стоит — «кто выиграл» уже записано, а команд в карте ровно две.
 */
export async function getSeriesDetail(key: string | number): Promise<SeriesDetail | null> {
  const base = await getSeries(key);
  if (!base) return null;

  const games = await prisma.match.findMany({
    where: { seriesId: base.id },
    orderBy: { gameNumber: "asc" },
    include: { stats: { include: { player: { select: { id: true, nickname: true } } } } },
  });

  return {
    ...base,
    games: games.map((g) => {
      const byTeam: Record<number, GamePlayer[]> = { [base.home.id]: [], [base.away.id]: [] };
      for (const s of g.stats) {
        const teamId =
          g.winnerTeamId == null ? base.home.id
          : s.won ? g.winnerTeamId
          : g.winnerTeamId === base.home.id ? base.away.id
          : base.home.id;
        byTeam[teamId]?.push({
          playerId: s.player.id,
          nickname: s.player.nickname,
          heroSlug: s.heroSlug,
          level: s.level,
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
          netWorth: s.netWorth,
        });
      }
      // Внутри команды — по уровню вниз, как в постгейме: это грубый, но читаемый порядок «кор → саппорт».
      for (const list of Object.values(byTeam)) list.sort((a, b) => b.level - a.level || b.netWorth - a.netWorth);

      return {
        matchId: g.id,
        gameNumber: g.gameNumber,
        openDotaMatchId: g.openDotaMatchId,
        durationSec: g.durationSec,
        startedAt: g.startedAt,
        winnerTeamId: g.winnerTeamId,
        statsCount: g.stats.length,
        radiantTeamId: g.radiantTeamId,
        radiantScore: g.radiantScore,
        direScore: g.direScore,
        firstPickRadiant: g.firstPickRadiant,
        byTeam,
      };
    }),
  };
}

/**
 * Пересчёт счёта серии по победителям привязанных карт — счёт больше не вводят руками.
 * Считаем только карты, где победитель — одна из двух команд серии. Если карт нет или у какой-то
 * победитель ещё не определён (отчёт не дозрел, игроков нет в ростере), счёт не трогаем: у неявок
 * карт нет вовсе, а недосчитанную карту нельзя молча свести к нулю поверх заданного руками.
 */
async function recomputeSeriesScore(seriesId: number) {
  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { homeId: true, awayId: true } });
  if (!series) return;
  const games = await prisma.match.findMany({ where: { seriesId }, select: { winnerTeamId: true } });
  if (games.length === 0) return; // неявка/пусто — счёт держит то, что задали руками
  let home = 0;
  let away = 0;
  for (const g of games) {
    if (g.winnerTeamId === series.homeId) home++;
    else if (g.winnerTeamId === series.awayId) away++;
    else return; // карта без победителя серии — не считаем, чтобы не затереть счёт нулём
  }
  await prisma.series.update({ where: { id: seriesId }, data: { homeScore: home, awayScore: away } });
}

export type NewSeries = {
  divisionId: number;
  stage: string;
  group?: string | null;
  /** Плей-офф: ключ слота сетки (src/lib/playoff-bracket.ts). Из него выводятся bracket и round. */
  slot?: string | null;
  playedAt?: Date | null;
  homeId: number;
  awayId: number;
  score: string;
};

/** Завести встречу руками. Групповые уже залиты импортом — это в первую очередь про плей-офф. */
export async function createSeries(input: NewSeries) {
  if (!isStage(input.stage)) throw new Error(`Неизвестная стадия: «${input.stage}»`);
  if (input.homeId === input.awayId) throw new Error("Команда не играет сама с собой");
  if (input.stage === "group" && !input.group) throw new Error("У групповой встречи должна быть группа");

  // Плей-офф привязывается к слоту сетки: он задаёт и половину (bracket), и подпись раунда, и Bo.
  const slot = input.stage === "playoff" ? slotByKey(input.slot) : null;
  if (input.stage === "playoff" && !slot) throw new Error("У плей-офф встречи должен быть слот сетки");

  // Bo3 в группе, Bo слота — в плей-офф: гранд-финал играется до трёх побед, остальное до двух.
  const allowed = slot ? validScores(slot.bestOf) : VALID_SCORES;
  if (!allowed.includes(input.score)) {
    throw new Error(`Счёт серии должен быть ${allowed.join(", ")} — не «${input.score}»`);
  }

  // Слот занят? Один слот — одна серия (в БД это @@unique([division, slot])), но проверяем заранее,
  // чтобы отдать понятную ошибку вместо сырого нарушения индекса.
  if (slot) {
    const taken = await prisma.series.findFirst({ where: { divisionId: input.divisionId, slot: slot.key } });
    if (taken) throw new Error(`Слот «${slot.label}» уже занят другой встречей`);
  }

  // Имя дивизиона в серии — зеркало (src/lib/tournaments.ts): по нему читают старые выборки,
  // но истина — divisionId, поэтому имя берём из самого дивизиона, а не из формы.
  const division = await prisma.division.findUnique({ where: { id: input.divisionId } });
  if (!division) throw new Error("Дивизион не найден");

  const [homeScore, awayScore] = input.score.split(":").map(Number);
  return prisma.series.create({
    data: {
      slug: await uniqueSlug(input.homeId, input.awayId),
      divisionId: division.id,
      division: division.name,
      stage: input.stage,
      // У плей-офф группы нет — пустую строку из формы приводим к NULL, иначе сломается @@unique.
      group: input.stage === "group" ? input.group! : null,
      bracket: slot?.bracket ?? null,
      round: slot?.round ?? null,
      slot: slot?.key ?? null,
      playedAt: input.playedAt ?? null,
      homeId: input.homeId,
      awayId: input.awayId,
      homeScore,
      awayScore,
      guessed: false, // завели руками — значит, знаем наверняка
    },
  });
}

/**
 * Привязать карту к серии: заводим `Match` под её командами и тут же читаем стату.
 *
 * `openDotaMatchId` уникален глобально, поэтому одна и та же карта не ляжет в две серии — повторная
 * привязка переносит существующий матч, а не плодит дубль. Стороны (кто был за свет) определяет
 * синк по составам, руками их вводить не нужно.
 */
/**
 * Перечитать уже привязанную карту из OpenDota.
 *
 * **Когда перечитывают.** Отчёт дозрел (непарсенный матч позже обрастает вардами и таймингами);
 * стата легла неполной («стата не легла — игроков нет в ростере»); поправили ростер — завели
 * игрока, проставили ему account_id, перевели в другую команду.
 *
 * **Что перезаписывается.** Всё, что выведено из отчёта: `MatchStat` опознанных игроков (upsert),
 * `Ward` карты (сносятся и пишутся заново), у матча — длительность, время старта, счёт сторон,
 * первый пик, стороны и победитель. Строки статы игроков, которых в свежем отчёте нет, удаляются.
 * Счёт серии пересчитывается по победителям карт — иначе смена победителя карты не доехала бы до
 * таблицы (раньше «перечитать» этого не делало, и счёт серии оставался старым).
 *
 * **Что остаётся.** Сама привязка (`seriesId`, `gameNumber`), дата серии, начисленные баллы
 * (`PointsEntry`) и собранная графика: это решения оператора, а не производные отчёта.
 */
export async function resyncGame(matchId: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, seriesId: true } });
  if (!match) throw new Error(`Матч ${matchId} не найден`);

  const synced = await syncMatch(prisma, match.id);
  if (match.seriesId) await recomputeSeriesScore(match.seriesId);
  return synced;
}

export async function attachGame(seriesId: number, gameNumber: number, openDotaMatchId: string) {
  if (!/^\d{1,20}$/.test(openDotaMatchId)) throw new Error("ID матча — это число, например 8907510684");
  if (gameNumber < 1 || gameNumber > 5) throw new Error("Номер карты в серии — от 1 до 5");

  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    include: { divisionRef: { select: { tournament: { select: { leagueId: true, name: true } } } } },
  });
  if (!series) throw new Error(`Серия ${seriesId} не найдена`);

  // Если у турнира задан league_id, сверяем его с лигой матча ДО записи: самая частая ошибка при
  // ручном вводе — опечатка в id, и она привязывает к встрече чужой матч вместе с его статой.
  // Проверка бесплатная: отчёт всё равно читается ниже, здесь он берётся из того же кэша.
  const leagueId = series.divisionRef?.tournament.leagueId ?? null;
  if (leagueId) {
    const report = await loadMatchReport("opendota", openDotaMatchId).catch(() => null);
    // `leagueId === null` — источник поля не отдал (Steam-фолбэк, отчёт из старого кэша): это
    // «не знаем», а не «вне лиги», и блокировать по нему нельзя — иначе привязка ломается на
    // ровном месте. Публичный матч приезжает с нулём, его отличаем и отбиваем.
    if (report && report.leagueId !== null && report.leagueId !== leagueId) {
      throw new Error(
        report.leagueId
          ? `Матч ${openDotaMatchId} сыгран в другой лиге (league_id ${report.leagueId}, у турнира ${leagueId}) — проверьте id`
          : `Матч ${openDotaMatchId} сыгран вне лиги (обычное лобби), а у турнира league_id ${leagueId} — проверьте id`,
      );
    }
  }

  const existing = await prisma.match.findUnique({ where: { openDotaMatchId } });
  const match = existing
    ? await prisma.match.update({
        where: { id: existing.id },
        data: { seriesId, gameNumber, teamAId: series.homeId, teamBId: series.awayId },
      })
    : await prisma.match.create({
        data: {
          openDotaMatchId,
          seriesId,
          gameNumber,
          teamAId: series.homeId,
          teamBId: series.awayId,
          status: "finished",
        },
      });

  const synced = await syncMatch(prisma, match.id);

  // Счёт серии — по победителям карт, руками его больше не задают.
  await recomputeSeriesScore(seriesId);

  // Дата серии — по первой карте: вводить её руками смысла нет, она уже есть в отчёте.
  if (!series.playedAt) {
    const first = await prisma.match.findFirst({
      where: { seriesId, startedAt: { not: null } },
      orderBy: { startedAt: "asc" },
    });
    if (first?.startedAt) await prisma.series.update({ where: { id: seriesId }, data: { playedAt: first.startedAt } });
  }

  return synced;
}

/** Отцепить карту: матч и его стата уходят целиком (на них ничего, кроме архива, не держится). */
export async function detachGame(matchId: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { renders: true, pointsEntries: true } });
  if (!match) throw new Error(`Матч ${matchId} не найден`);
  const seriesId = match.seriesId;
  // На матче могут висеть генерации и баллы — их удалять нельзя, поэтому просто снимаем с серии.
  const result =
    match.renders.length || match.pointsEntries.length
      ? await prisma.match.update({ where: { id: matchId }, data: { seriesId: null, gameNumber: null } })
      : await prisma.match.delete({ where: { id: matchId } });
  // Счёт серии пересчитываем по оставшимся картам. Если карт не осталось — счёт держим прежним.
  if (seriesId) await recomputeSeriesScore(seriesId);
  return result;
}

/**
 * Сводка архива по турнирам — вход в раздел. Оператор приходит за одним турниром, а раньше страница
 * вываливала все встречи всех сезонов разом: техническая часть (заведение встречи, привязка карт)
 * теперь живёт на уровень глубже, внутри турнира.
 */
export async function tournamentArchive() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ startAt: "desc" }, { id: "desc" }],
    include: { divisions: { orderBy: [{ orderNo: "asc" }, { id: "asc" }] } },
  });

  return Promise.all(
    tournaments.map(async (t) => {
      const divisionIds = t.divisions.map((d) => d.id);
      const [series, games] = await Promise.all([
        prisma.series.count({ where: { divisionId: { in: divisionIds } } }),
        prisma.match.count({ where: { series: { divisionId: { in: divisionIds } } } }),
      ]);
      // Встречи без единой карты — то, что оператору и надо добить: без карт стата в рейтинги не идёт.
      const empty = await prisma.series.count({
        where: { divisionId: { in: divisionIds }, games: { none: {} } },
      });
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        short: t.short,
        status: t.status,
        matchesUrl: t.matchesUrl,
        divisions: t.divisions.map((d) => ({ id: d.id, slug: d.slug, name: d.name, label: d.label, short: d.short })),
        series,
        games,
        empty,
      };
    }),
  );
}

export type TournamentArchiveRow = Awaited<ReturnType<typeof tournamentArchive>>[number];
