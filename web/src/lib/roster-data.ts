// Чтение данных для студии: команды, игроки, матчи под автозаполнение шаблонов.
// Пишет — только API-роуты (/api/studio/*), здесь только выборки.

import { prisma } from "@/lib/prisma";
import { currentTournament, getDivisions, tournamentRank } from "@/lib/tournaments";
import { playerAccountId } from "@/lib/profiles";
import { rolePosition, roleOrder } from "@/lib/roles";
import { withPlayerUploads, withTeamUploads } from "@/lib/uploads";
import { rankTotals, tpByTournament, type Rating } from "@/lib/tp";
import { teamRating, teamRatingByTournament } from "@/lib/team-rating";
import { mmrShown, privacy } from "@/lib/privacy";

/**
 * Порядок витрин пула: сперва ранжированные по убыванию очков, следом — все без рейтинга, по имени
 * (ТЗ 13). Место считает сервер (`rankTotals`), клиент его не пересчитывает: поиск и фильтр там
 * свои, и второй расчёт разъехался бы с этим списком.
 */
function byRating<T>(items: T[], ratingOf: (x: T) => Rating | null, nameOf: (x: T) => string): T[] {
  return [...items].sort((a, b) => {
    const ra = ratingOf(a);
    const rb = ratingOf(b);
    if (ra && rb) return rb.score - ra.score || nameOf(a).localeCompare(nameOf(b));
    if (ra || rb) return ra ? -1 : 1;
    return nameOf(a).localeCompare(nameOf(b));
  });
}

/** Рейтинги по турнирам в вид карточки: слаг → ячейка, только те турниры, где субъект ранжирован. */
function ratingsOf(id: number, byTournament: Map<string, Map<number, Rating>>): Record<string, Rating> {
  const out: Record<string, Rating> = {};
  for (const [slug, map] of byTournament) {
    const cell = map.get(id);
    if (cell) out[slug] = cell;
  }
  return out;
}

/**
 * MMR команды не хранится — считается по составу, как и standings. Берём только основу (позиции 1–5):
 * замены и тренер не должны двигать цифру, по которой команды сравнивают между собой.
 */
export function teamMmr(players: { role: string | null; mmr: number | null }[]) {
  const core = players.filter((p) => rolePosition(p.role) !== null && p.mmr);
  const total = core.reduce((sum, p) => sum + (p.mmr ?? 0), 0);
  return { total, average: core.length ? Math.round(total / core.length) : null, counted: core.length };
}

// MMR гасится ЗДЕСЬ, в слое данных, а не условием в разметке: условие оставляет число в
// RSC-payload страницы, и поле уезжает наружу, даже если его не рисуют (грабля ТЗ 29).
// Производные гасятся вместе с числом — средний по пятёрке при четырёх известных выдаёт пятого,
// а полоска силы это то же число, нарисованное иначе.

export type TeamCard = {
  id: number;
  slug: string;
  name: string;
  tag: string | null;
  group: string | null;
  color: string | null;
  logo: string | null;
  wordmark: string | null;
  photo: string | null;
  playersCount: number;
  /** Временно: сколько игроков без account_id — их подсвечиваем, пока добиваем ростер. */
  noAccountIdCount: number;
  /** Средний MMR основы (поз. 1–5); null, если MMR не проставлен ни у кого. */
  mmrAverage: number | null;
  mmrTotal: number;
  /**
   * Состав в форме «steam32 → ник из ростера»: по нему страница матча узнаёт команду лиги
   * и подписывает игроков нашими никами, а не теми, что стоят в клиенте Доты.
   * id берётся и из ссылок на профиль, не только из своего поля (см. `playerAccountId`).
   */
  lineup: { accountId: string; nickname: string }[];
};

/**
 * Фильтр состава по сезону. Состав принадлежит дивизиону турнира (`RosterSpot.divisionId`), поэтому
 * витрины показывают состав ТЕКУЩЕГО турнира; места без дивизиона (команды вне турнира, старые
 * записи) показываем всегда — иначе команда, ни в чём не участвующая, выглядела бы пустой.
 *
 * Историю прошлых сезонов это не прячет: она осталась в местах с их дивизионом и видна на странице
 * игрока, где показаны все его места с подписью турнира.
 */
export async function seasonRosterWhere(divisionIds?: number[]) {
  const ids = divisionIds ?? (await getDivisions()).map((d) => d.id);
  if (ids.length === 0) return undefined;
  return { OR: [{ divisionId: { in: ids } }, { divisionId: null }] };
}

/**
 * Команды турнира. `divisionIds` — дивизионы того турнира, чью витрину рисуем: команда попадает в
 * список по участию (`TournamentEntry`), а не по строке-зеркалу `Team.group`. Без него список был
 * бы общим для всех сезонов сразу — ровно то, из-за чего ростер нового турнира показывал чужие
 * команды. Без аргумента (студия, драфт) — весь ростер лиги, как раньше.
 */
export async function listTeams(divisionIds?: number[]): Promise<TeamCard[]> {
  const [where, showMmr] = await Promise.all([seasonRosterWhere(divisionIds), mmrShown()]);
  const teams = await prisma.team.findMany({
    where: divisionIds ? { entries: { some: { divisionId: { in: divisionIds } } } } : undefined,
    orderBy: [{ group: "asc" }, { name: "asc" }],
    include: {
      roster: {
        where,
        select: {
          role: true,
          player: {
            select: { id: true, slug: true, nickname: true, photo: true, mmr: true, country: true, accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true },
          },
        },
      },
    },
  });
  return Promise.all(
    teams.map(async ({ roster, ...t }) => {
      const mmr = teamMmr(roster.map((s) => ({ role: s.role, mmr: s.player.mmr })));
      return {
        ...(await withTeamUploads(t)),
        playersCount: roster.length,
        // «Без account_id» — это когда id не выводится вообще ниоткуда, а не когда пусто поле.
        noAccountIdCount: roster.filter((s) => !playerAccountId(s.player)).length,
        mmrAverage: showMmr ? mmr.average : null,
        mmrTotal: showMmr ? mmr.total : 0,
        lineup: lineupOf(roster),
      };
    }),
  );
}

export type RosterMember = {
  id: number;
  nickname: string;
  photo: string | null;
  mmr: number | null;
  role: string | null;
  position: number | null;
  isCaptain: boolean;
  country: string | null;
  accountId: string | null;
};

export type TeamWithRoster = TeamCard & {
  players: RosterMember[];
  /** Дивизионы, в которых команда участвует (`TournamentEntry.divisionId`) — разрез витрин идёт по ним,
   *  а не по строке-зеркалу `Team.group`: зеркало хранит имя дивизиона последнего турнира и в новом
   *  сезоне врёт (команда была видна только на вкладке «Все»). */
  divisionIds: number[];
};

type SpotWithPlayer = { role: string | null; isCaptain: boolean; player: PlayerRecord };
type PlayerRecord = {
  id: number;
  slug: string;
  nickname: string;
  photo: string | null;
  mmr: number | null;
  country: string | null;
  accountId: string | null;
  dotabuffUrl?: string | null;
  stratzUrl?: string | null;
  steamUrl?: string | null;
};

/** Состав в форме «account_id → ник». Игроки, у которых id взять неоткуда, выпадают. */
const lineupOf = (roster: { player: PlayerRecord }[]) =>
  roster
    .map((s) => ({ accountId: playerAccountId(s.player), nickname: s.player.nickname }))
    .filter((x): x is { accountId: string; nickname: string } => !!x.accountId);

/** Место в составе → строка ростера. Один вид данных для списка команд и для страницы команды. */
async function toRosterMember(spot: SpotWithPlayer, showMmr: boolean): Promise<RosterMember> {
  const player = await withPlayerUploads(spot.player);
  return {
    id: player.id,
    nickname: player.nickname,
    photo: player.photo,
    mmr: showMmr ? player.mmr : null,
    role: spot.role,
    position: rolePosition(spot.role),
    isCaptain: spot.isCaptain,
    country: player.country,
    accountId: playerAccountId(player),
  };
}

/** Состав в привычном порядке: керри → хард, потом замены и тренер, внутри роли — по алфавиту. */
const byRole = (a: SpotWithPlayer, b: SpotWithPlayer) =>
  roleOrder(a.role) - roleOrder(b.role) || a.player.nickname.localeCompare(b.player.nickname);

async function withRoster<T extends { slug: string; logo: string | null; wordmark?: string | null; photo?: string | null }>(
  team: T,
  roster: SpotWithPlayer[],
  showMmr: boolean,
): Promise<
  T & {
    players: RosterMember[];
    playersCount: number;
    noAccountIdCount: number;
    mmrAverage: number | null;
    mmrTotal: number;
    lineup: { accountId: string; nickname: string }[];
  }
> {
  const mmr = teamMmr(roster.map((s) => ({ role: s.role, mmr: s.player.mmr })));
  return {
    ...(await withTeamUploads(team)),
    players: await Promise.all([...roster].sort(byRole).map((s) => toRosterMember(s, showMmr))),
    playersCount: roster.length,
    noAccountIdCount: roster.filter((s) => !playerAccountId(s.player)).length,
    mmrAverage: showMmr ? mmr.average : null,
    mmrTotal: showMmr ? mmr.total : 0,
    lineup: lineupOf(roster),
  };
}

/**
 * Список команд вместе с составами — для карточек на /roster/teams, которые разворачиваются
 * прямо в списке. Отдельно от listTeams(): там состав не нужен, а тут без него нечего показывать.
 */
/**
 * То же, что `listTeams`, но с полным составом — витрина команд турнира.
 *
 * `operator` — заход из служебной части (админский fearless-драфт): там MMR виден всегда, флаг
 * витрины его не касается. По умолчанию заход витринный, то есть закрытый: забыть флаг здесь
 * должно быть безопасно.
 */
export async function listTeamRosters(
  divisionIds?: number[],
  { operator = false }: { operator?: boolean } = {},
): Promise<TeamWithRoster[]> {
  const [where, showMmr] = await Promise.all([seasonRosterWhere(divisionIds), operator ? true : mmrShown()]);
  const teams = await prisma.team.findMany({
    where: divisionIds ? { entries: { some: { divisionId: { in: divisionIds } } } } : undefined,
    orderBy: [{ group: "asc" }, { name: "asc" }],
    include: {
      roster: { where, include: { player: true } },
      // участие нужно витрине: по нему она делит команды на дивизионы (см. TeamWithRoster.divisionIds)
      entries: { select: { divisionId: true } },
    },
  });
  return Promise.all(
    teams.map(async ({ roster, entries, ...t }) => ({
      ...(await withRoster(t, roster, showMmr)),
      divisionIds: entries.map((e) => e.divisionId).filter((id) => !divisionIds || divisionIds.includes(id)),
    })),
  );
}

/** Турнир, в котором команда играла — метка на карточке пула (по нему же строится фильтр). */
export type PoolTournament = { slug: string; name: string; short: string | null };

export type PoolTeam = TeamWithRoster & {
  /** null — команда в пуле; дата — убрана в архив (первое из двух удалений). */
  archivedAt: Date | null;
  /** Все турниры, в дивизионах которых команда участвовала — метки и фильтр таба «Ростер». */
  tournaments: PoolTournament[];
  /** Рейтинг за текущий турнир: очки и место. null — начислений не было, на карточке прочерк. */
  rating: Rating | null;
  /** Тот же рейтинг по турнирам (слаг → ячейка) — разрез «По турнирам» показывает цифру за свой. */
  ratings: Record<string, Rating>;
};

/**
 * Общий пул команд лиги — витрина таба «Ростер», сквозная по всем турнирам (в отличие от
 * `listTeamRosters`, что режет по одному турниру). Каждой команде показываем её СОБСТВЕННЫЙ актуальный
 * состав (по последнему участию, как `teamDivision`), а не состав какого-то «текущего» турнира, и
 * список турниров, где она играла, — по нему таб строит фильтр и метки.
 *
 * `archived`: false (по умолчанию) — команды в пуле; true — убранные в архив (первое удаление).
 * Историю турниров архив не трогает: их таблицы и матчи по-прежнему показывают команду.
 */
export async function listPoolTeams({ archived = false }: { archived?: boolean } = {}): Promise<PoolTeam[]> {
  // Рейтинг — за текущий турнир; карта по турнирам едет следом для разреза «По турнирам».
  const current = await currentTournament();
  const [rating, ratingByTournament, showMmr] = await Promise.all([
    teamRating(current?.id ?? null),
    teamRatingByTournament(),
    mmrShown(),
  ]);
  const teams = await prisma.team.findMany({
    where: { archivedAt: archived ? { not: null } : null },
    orderBy: [{ name: "asc" }],
    include: {
      // division у мест нужен, чтобы понять «в каком турнире этот состав»: состав может висеть на
      // дивизионе и без TournamentEntry (участие сняли, а места остались) — тогда энтри пусты, но
      // показать команду с её составом всё равно надо.
      roster: { include: { player: true, division: { include: { tournament: true } } } },
      entries: { include: { division: { include: { tournament: true } } } },
    },
  });

  type Tour = { slug: string; name: string; short: string | null; status: string; startAt: Date | null };

  return Promise.all(
    teams.map(async ({ roster, entries, ...t }) => {
      // Ранг «актуальности» дивизиона по его турниру — то же правило, что у `teamDivision`: не
      // «текущий» турнир лиги, а собственный последний (свежее — меньше, чтобы сортировать по возрастанию).
      const rank = (tr: Tour) => tournamentRank(tr);

      // Дивизион → его турнир: берём и из участия, и из мест состава — так команда без энтри (её
      // сняли с турнира, а состав остался) всё равно опознаётся по дивизиону своих игроков.
      const divTour = new Map<number, Tour>();
      const add = (divisionId: number | null, tr: { slug: string; name: string; short: string | null; status: string; startAt: Date | null } | null) => {
        if (divisionId === null || !tr || tr.status === "draft") return;
        if (!divTour.has(divisionId)) divTour.set(divisionId, tr);
      };
      for (const e of entries) add(e.divisionId, e.division.tournament);
      for (const s of roster) add(s.divisionId, s.division?.tournament ?? null);

      // Актуальный дивизион выбираем среди тех, где реально есть места состава (иначе показали бы
      // пустую карточку по участию без игроков). Пусто — команда вне турнира, покажем места без дивизиона.
      const rosterDivs = [...new Set(roster.map((s) => s.divisionId).filter((id): id is number => id !== null))]
        .filter((id) => divTour.has(id))
        .sort((a, b) => rank(divTour.get(a)!) - rank(divTour.get(b)!));
      const currentDivisionId = rosterDivs[0] ?? null;
      const shown = roster.filter((s) => s.divisionId === currentDivisionId || s.divisionId === null);

      // Турниры для меток и фильтра — все, где команда засветилась (участие или состав), свежие сверху.
      const tournaments: PoolTournament[] = [...divTour.values()]
        .sort((a, b) => rank(a) - rank(b))
        .map((tr) => ({ slug: tr.slug, name: tr.name, short: tr.short }))
        .filter((tr, i, all) => all.findIndex((x) => x.slug === tr.slug) === i);

      return {
        ...(await withRoster(t, shown, showMmr)),
        archivedAt: t.archivedAt,
        divisionIds: [...divTour.keys()],
        tournaments,
        rating: rating.get(t.id) ?? null,
        ratings: ratingsOf(t.id, ratingByTournament),
      };
    }),
  ).then((rows) => byRating(rows, (t) => t.rating, (t) => t.name));
}

/**
 * Турниры лиги в том же порядке, в каком они стоят метками на карточках, — свежие сверху.
 * Нужен разрезу «По турнирам»: у каждой команды и игрока свой список турниров, а порядок секций
 * на витрине должен быть один на всех, иначе он менялся бы от того, кто попал в выборку первым.
 */
export async function poolTournaments(): Promise<PoolTournament[]> {
  const rows = await prisma.tournament.findMany({
    where: { status: { not: "draft" } },
    select: { slug: true, name: true, short: true, status: true, startAt: true },
  });
  return rows
    .sort((a, b) => tournamentRank(a) - tournamentRank(b))
    .map((t) => ({ slug: t.slug, name: t.name, short: t.short }));
}

/** Команда игрока в карточке пула — минимум для акцента и подписи. */
type PoolPlayerTeam = { id: number; slug: string; name: string; tag: string | null; color: string | null; group: string | null };

export type PoolPlayer = {
  id: number;
  /** Слаг — ключ адреса страницы игрока (`/players/<slug>`), поэтому едет в карточку вместе с ником. */
  slug: string;
  nickname: string;
  photo: string | null;
  mmr: number | null;
  /** Ранг Доты и значение до последней смены — медаль со стрелкой в карточке (`pouf/rank.tsx`). */
  rank: number | null;
  rankPrev: number | null;
  country: string | null;
  accountId: string | null;
  /** Главное место: действующая команда (по свежести турнира), с ролью и капитанством — для акцента. */
  main: { team: PoolPlayerTeam; role: string | null; isCaptain: boolean } | null;
  /** Прочие команды игрока (обычно замены/прошлые) — строкой «ещё в …». */
  otherTeams: string[];
  /** Турниры, где игрок засветился составом — метки и фильтр таба «Игроки». */
  tournaments: PoolTournament[];
  /** Рейтинг игрока — тот же сезонный зачёт TP, что в `/tournaments/<slug>/tp`. null — прочерк. */
  rating: Rating | null;
  /** Тот же зачёт по турнирам (слаг → ячейка) — для разреза «По турнирам». */
  ratings: Record<string, Rating>;
};

/**
 * Общий пул игроков лиги — витрина `/roster/players`, сквозная по всем турнирам (пара к `listPoolTeams`).
 * У каждого игрока — его главная команда (по свежайшему турниру), прочие команды строкой и список
 * турниров для фильтра/меток. Фильтр по турниру и поиск считает клиент (PlayersExplorer).
 */
export async function listPoolPlayers(): Promise<PoolPlayer[]> {
  const showMmr = await mmrShown();
  const players = await prisma.player.findMany({
    // Непроверенный (Mix Cup до апрува, ТЗ 34) на публичную витрину лиги не выходит —
    // он участник микса и строка в пуле драфта, но не факт ростера (DECISIONS 10.09.2026).
    where: { verified: true },
    orderBy: [{ nickname: "asc" }],
    include: {
      spots: {
        include: {
          team: { select: { id: true, slug: true, name: true, tag: true, color: true, group: true } },
          division: { include: { tournament: true } },
        },
      },
    },
  });

  // Рейтинг игрока новый не заводим: это существующий сезонный зачёт TP (`tpByTournament`), тот же,
  // что в `/tournaments/<slug>/tp`. Места считаются здесь, на сервере, — как и у команд.
  const nicknames = new Map(players.map((p) => [p.id, p.nickname]));
  const current = await currentTournament();
  const seasons = await prisma.tournament.findMany({ where: { status: { not: "draft" } }, select: { id: true, slug: true } });
  const [currentTotals, seasonTotals] = await Promise.all([
    tpByTournament(current?.id ?? null),
    Promise.all(seasons.map((t) => tpByTournament(t.id))),
  ]);
  const rating = rankTotals(currentTotals, (id) => nicknames.get(id));
  const ratingByTournament = new Map(seasons.map((t, i) => [t.slug, rankTotals(seasonTotals[i], (id) => nicknames.get(id))]));

  return Promise.all(
    players.map(async (p) => {
      const uploaded = await withPlayerUploads(p);
      // Свежесть места — по рангу турнира его дивизиона; места без турнира (null-дивизион) считаем
      // самыми старыми. Главное место — из свежайшего турнира, при равенстве — по порядку ролей.
      const spotRank = (s: (typeof p.spots)[number]) =>
        s.division?.tournament && s.division.tournament.status !== "draft"
          ? tournamentRank(s.division.tournament)
          : Number.MAX_SAFE_INTEGER;
      const ordered = [...p.spots].sort((a, b) => spotRank(a) - spotRank(b) || roleOrder(a.role) - roleOrder(b.role));
      const main = ordered[0]
        ? { team: ordered[0].team, role: ordered[0].role, isCaptain: ordered[0].isCaptain }
        : null;
      const otherTeams = [...new Set(ordered.slice(1).map((s) => s.team.name))];

      // Турниры без повторов, свежие сверху.
      const divTour = new Map<number, { slug: string; name: string; short: string | null; status: string; startAt: Date | null }>();
      for (const s of p.spots) {
        const tr = s.division?.tournament;
        if (s.divisionId === null || !tr || tr.status === "draft") continue;
        if (!divTour.has(s.divisionId)) divTour.set(s.divisionId, tr);
      }
      const tournaments: PoolTournament[] = [...divTour.values()]
        .sort((a, b) => tournamentRank(a) - tournamentRank(b))
        .map((tr) => ({ slug: tr.slug, name: tr.name, short: tr.short }))
        .filter((tr, i, all) => all.findIndex((x) => x.slug === tr.slug) === i);

      return {
        id: p.id,
        slug: p.slug,
        nickname: p.nickname,
        photo: uploaded.photo,
        mmr: showMmr ? p.mmr : null,
        rank: p.rank,
        rankPrev: p.rankPrev,
        country: p.country,
        accountId: playerAccountId(p),
        main,
        otherTeams,
        tournaments,
        rating: rating.get(p.id) ?? null,
        ratings: ratingsOf(p.id, ratingByTournament),
      };
    }),
  ).then((rows) => byRating(rows, (p) => p.rating, (p) => p.nickname));
}

/**
 * Ключ карточки ростера: число — это id, всё остальное — слаг. Ссылки по слагу до сих пор попадаются
 * (старые адреса, ручной ввод), а `Number("bsk")` даёт NaN — Prisma на нём падает, и вместо карточки
 * посетитель видел 500. Разбираем ключ здесь, одним местом на команду и игрока.
 */
export function rosterKey(key: string | number): { id: number } | { slug: string } {
  const id = typeof key === "number" ? key : Number(key);
  return Number.isInteger(id) && id > 0 ? { id } : { slug: String(key).trim() };
}

/**
 * История составов команды по турнирам. Состав сезонный (`RosterSpot.divisionId`), поэтому у команды,
 * прожившей два сезона, лежат два разных состава — карточка показывает текущий сверху, прошлые ниже.
 *
 * `currentDivisionId` — дивизион, который у этой команды сейчас показывает блок «Основа» (её
 * собственное актуальное участие, `teamDivision`, а не дивизионы глобально «текущего» турнира: у
 * команды, принятой в новый турнир, пока прошлый ещё идёт, это разные вещи). Он сюда не попадает;
 * места без дивизиона — тоже: это состав команды вне турниров, он и есть текущий.
 *
 * Итог участия берём из снимка таблицы (`GroupEntry`): место и группа. Считать его заново по сериям
 * прошлого сезона незачем — карточка не таблица, а подпись «где команда закончила».
 */
export async function teamRosterHistory(teamId: number, currentDivisionId?: number | null) {
  const showMmr = await mmrShown();
  const spots = await prisma.rosterSpot.findMany({
    where: {
      teamId,
      divisionId: currentDivisionId ? { not: currentDivisionId } : { not: null },
    },
    include: {
      player: true,
      division: { include: { tournament: true } },
    },
  });
  if (spots.length === 0) return [];

  const divisionIds = [...new Set(spots.map((s) => s.divisionId!))];
  const places = await prisma.groupEntry.findMany({
    where: { teamId, divisionId: { in: divisionIds } },
    select: { divisionId: true, group: true, place: true },
  });
  const placeBy = new Map(places.map((p) => [p.divisionId, p]));

  const byDivision = new Map<number, typeof spots>();
  for (const spot of spots) {
    const list = byDivision.get(spot.divisionId!) ?? [];
    list.push(spot);
    byDivision.set(spot.divisionId!, list);
  }

  const seasons = await Promise.all(
    [...byDivision.entries()].map(async ([divisionId, list]) => {
      const division = list[0].division!;
      return {
        divisionId,
        division: { slug: division.slug, name: division.name, label: division.label },
        tournament: {
          slug: division.tournament.slug,
          name: division.tournament.name,
          short: division.tournament.short,
          startAt: division.tournament.startAt,
        },
        result: placeBy.get(divisionId) ?? null,
        players: await Promise.all([...list].sort(byRole).map((s) => toRosterMember(s, showMmr))),
      };
    }),
  );

  // Свежие сезоны сверху: у турнира без даты старта порядок по id дивизиона — тоже «позже завели».
  return seasons.sort(
    (a, b) =>
      (b.tournament.startAt?.getTime() ?? 0) - (a.tournament.startAt?.getTime() ?? 0) || b.divisionId - a.divisionId,
  );
}

export type TeamSeasonRoster = Awaited<ReturnType<typeof teamRosterHistory>>[number];

/**
 * Всё для страницы команды: картинки, состав и агрегаты по MMR. Состав берём по собственному
 * дивизиону команды (`divisionId`, передаётся вызывающей стороной из `teamDivision`), а не по
 * дивизионам глобально «текущего» турнира — иначе команда, принятая в новый турнир, пока прошлый ещё
 * идёт, оставалась без состава на своей же странице.
 */
export async function getTeamProfile(key: string | number, divisionId?: number | null) {
  const where = divisionId ? { OR: [{ divisionId }, { divisionId: null }] } : { divisionId: null };
  const team = await prisma.team.findUnique({
    where: rosterKey(key),
    include: { roster: { where, include: { player: true } } },
  });
  if (!team) return null;
  const { roster, ...rest } = team;
  return withRoster(rest, roster, await mmrShown());
}

/** Команда с составом: место в составе разворачивается в игрока с ролью этого места. */
export async function getTeam(id: number) {
  const team = await prisma.team.findUnique({ where: { id }, include: { roster: { include: { player: true } } } });
  if (!team) return null;
  // порядок состава задаёт список ролей (керри → хард, потом замены и тренер), не алфавит
  const players = await Promise.all(
    team.roster
      .map((s) => ({ ...s.player, role: s.role, isCaptain: s.isCaptain, spotId: s.id }))
      .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.nickname.localeCompare(b.nickname))
      .map(withPlayerUploads),
  );
  // Картинки самой команды оставляем как в БД: страница отдаёт их в редактор, а он должен
  // показывать реальное состояние поля, а не файл, подставленный по слагу.
  return { ...team, players };
}

/** Игрок со всеми его местами: он может стоять в нескольких командах (действующим — только в одной). */
export function getPlayer(id: number) {
  return prisma.player.findUnique({
    where: { id },
    include: { spots: { include: { team: true }, orderBy: { id: "asc" } } },
  });
}

/**
 * Всё для страницы профиля: человек, его места в составах — с лого команды и сокомандниками.
 * Отдельно от getPlayer(), потому что редактору эта развесистая выборка не нужна.
 */
export async function getPlayerProfile(key: string | number) {
  const player = await prisma.player.findUnique({
    // verified: true — непроверенный (Mix Cup до апрува, ТЗ 34) на свою публичную карточку не
    // выходит: findUnique молча вернёт null, страница/редирект обработают это как «не найден».
    where: { ...rosterKey(key), verified: true },
    include: {
      spots: {
        // Историю не режем: на странице игрока видно все его места, каждое — со своим турниром.
        include: {
          team: { include: { roster: { include: { player: true } } } },
          division: { include: { tournament: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!player) return null;

  // порядок мест — как везде: сначала действующая команда (по порядку ролей), потом замены и тренерство
  const spots = await Promise.all(
    [...player.spots]
      .sort((a, b) => roleOrder(a.role) - roleOrder(b.role))
      .map(async ({ team, ...spot }) => ({
        ...spot,
        team: await withTeamUploads(team),
        // Состав того же турнира, что и само место: `team.roster` держит места всех сезонов разом,
        // и без этого фильтра рядом с местом S2 стояли и игроки S3 — один и тот же человек дважды.
        teammates: await Promise.all(
          team.roster
            .filter((m) => m.playerId !== player.id && m.divisionId === spot.divisionId)
            .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.player.nickname.localeCompare(b.player.nickname))
            .map(async (m) => ({ ...(await withPlayerUploads(m.player)), role: m.role, isCaptain: m.isCaptain })),
        ),
      })),
  );

  // Страница игрока публичная: MMR и телеграм гасим ДО сборки ответа, а не условием в разметке —
  // иначе они уезжают в RSC-payload страницы (грабля ТЗ 29). Оператор правит эти поля в ростер-
  // редакторе, который ходит в базу своей выборкой (`getPlayer`) и флага не спрашивает.
  const show = await privacy();
  const self = await withPlayerUploads(player);
  return { ...self, mmr: show.mmr ? self.mmr : null, telegram: show.telegram ? self.telegram : null, spots };
}

/**
 * Игроки турнира: те, у кого есть место в его дивизионах. Без аргумента — весь пул лиги (драфт,
 * студия): там нужны все, включая тех, кто сейчас ни за кого не заявлен.
 */
export async function listPlayers(divisionIds?: number[]) {
  const where = await seasonRosterWhere(divisionIds);
  const players = await prisma.player.findMany({
    where: divisionIds ? { spots: { some: { divisionId: { in: divisionIds } } } } : undefined,
    orderBy: [{ nickname: "asc" }],
    // slug и color нужны аватаркам-заглушкам: цвет команды выводится из слага (teamAccent);
    // group — чтобы делить список по дивизиону (вкладки D1/D2/Все на /roster/players)
    include: { spots: { where, include: { team: { select: { id: true, slug: true, name: true, tag: true, color: true, group: true } } } } },
  });
  // в списке показываем основное место (действующее, если оно есть), остальные — счётчиком
  return Promise.all(
    players.map(async (p) => {
      const spots = [...p.spots].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
      return { ...(await withPlayerUploads(p)), spots, main: spots[0] ?? null };
    }),
  );
}

/** Матчи для автозаполнения шаблонов: ближайшие сверху, с командами и победителем. */
export function listMatches() {
  return prisma.match.findMany({
    orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    take: 50,
    include: { teamA: true, teamB: true, winner: true },
  });
}
