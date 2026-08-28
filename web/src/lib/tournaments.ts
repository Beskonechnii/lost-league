// Только сервер: турниры, дивизионы и участие команд. Одно место правды для «какой турнир текущий»,
// «какие у него дивизионы» и «в каком дивизионе команда» — разбор решений в ../../TOURNAMENTS-PLAN.md.
//
// Про зеркала. Имя дивизиона продолжает лежать строкой в `Team.group`, `Series.division` и
// `GroupEntry.division`: по этим строкам фильтруют полтора десятка выборок (standings, leaders,
// архив серий, витрины ростера), и переписывать их все разом ради одного FK — способ уронить
// работающий сезон. Поэтому строки остались denormalized-зеркалом, а единственный, кто их пишет —
// этот модуль. Правило простое: дивизион команде меняют через `setTeamDivision`, а не UPDATE'ом
// поля `group` где придётся.

// Директивы `server-only` здесь намеренно нет (в отличие от account.ts): модуль зовут и разовые
// скрипты через tsx, а `server-only` в обычном node падает. Клиенту он и так не нужен — списком
// дивизионов клиентские компоненты кормятся пропом (src/lib/divisions.ts).
import { cache } from "react";
import { prisma } from "./prisma";
import { slugify } from "./profiles";
import type { Division } from "./divisions";

/** Дивизион в форме, которую ждут навигация и справочник (src/lib/divisions.ts). */
type DivisionRow = {
  id: number;
  slug: string;
  name: string;
  label: string | null;
  short: string | null;
  orderNo: number;
  relegation: boolean;
};

const toDivision = (d: DivisionRow): Division => ({
  id: d.id,
  slug: d.slug,
  name: d.name,
  label: d.label ?? d.name,
  short: d.short ?? d.slug.toUpperCase(),
  relegation: d.relegation,
});

/**
 * Текущий турнир: идущий (`running`), иначе — последний заведённый. Пока сезон один, это он;
 * когда появится второй, «текущим» станет тот, что организатор перевёл в running — не дата, а
 * явное решение оператора, иначе турнир с незаполненными датами исчез бы из витрин.
 *
 * `cache` — на один запрос: витрину рисуют несколько server-компонентов сразу, и каждый спрашивает
 * дивизионы.
 */
export const loadCurrentTournament = async () => {
  const running = await prisma.tournament.findFirst({
    where: { status: "running" },
    orderBy: { startAt: "desc" },
  });
  if (running) return running;
  return prisma.tournament.findFirst({ orderBy: [{ startAt: "desc" }, { id: "desc" }] });
};

export const currentTournament = cache(loadCurrentTournament);

/** Дивизионы турнира (по умолчанию текущего) в порядке вкладок. Пусто — база ещё не засеяна. */
export const listDivisions = async (tournamentId?: number): Promise<Division[]> => {
  const id = tournamentId ?? (await loadCurrentTournament())?.id;
  if (!id) return [];
  const rows = await prisma.division.findMany({
    where: { tournamentId: id },
    orderBy: [{ orderNo: "asc" }, { id: "asc" }],
  });
  return rows.map(toDivision);
};

/** То же, но с памятью на один запрос — витрину рисуют несколько server-компонентов сразу. */
export const getDivisions = cache(listDivisions);

/** Дивизион текущего турнира по слагу из URL — null, если такого нет (роут отдаёт notFound). */
export async function divisionBySlug(slug: string): Promise<Division | null> {
  const list = await getDivisions();
  return list.find((d) => d.slug === slug) ?? null;
}

/** Дивизион по имени (строка-зеркало из Team.group / Series.division). */
export async function divisionByName(name: string | null | undefined): Promise<Division | null> {
  if (!name) return null;
  const list = await getDivisions();
  return list.find((d) => d.name === name) ?? null;
}

/** Дивизион по id вместе с его турниром — по нему страницы разделов знают, чей это раздел. */
export const divisionWithTournament = (id: number) =>
  prisma.division.findUnique({ where: { id }, include: { tournament: true } });

/** Дивизион турнира по паре слагов из URL: /tournaments/<турнир>/<дивизион>. */
export async function divisionOfTournament(tournamentSlug: string, divisionSlug: string) {
  const row = await prisma.division.findFirst({
    where: { slug: divisionSlug, tournament: { slug: tournamentSlug } },
    include: { tournament: true },
  });
  return row;
}

/** Ранг «актуальности» турнира: свежее — меньше (running > registration > finished, при равенстве
 *  статуса — поздний старт). Одно правило для `teamDivision` и пула команд (roster-data.ts). */
const STATUS_RANK: Record<string, number> = { running: 0, registration: 1, finished: 2 };
export const tournamentRank = (t: { status: string; startAt: Date | null }) =>
  (STATUS_RANK[t.status] ?? 3) * 1e15 - (t.startAt?.getTime() ?? 0);

/**
 * Дивизион команды в её собственном актуальном турнире (с самим турниром) — по нему витрина команды
 * знает, в какую таблицу и в какой раздел вести. Раньше брали дивизион глобально «текущего» турнира
 * (running, иначе последний) — команда, только что принятая в новый турнир (`registration`) при ещё
 * идущем прошлом (`running`), оставалась без своего дивизиона и состава. Поэтому ищем среди участий
 * самой команды, а не среди дивизионов заранее выбранного турнира.
 *
 * Кандидаты — дивизионы, где у команды есть состав (`RosterSpot`), а если состава нигде нет — где есть
 * участие (`TournamentEntry`, команда заявилась, состав ещё не завели). Состав важнее пустого участия:
 * встречается рассинхрон, когда участие сняли, а места состава остались висеть на дивизионе — карточка
 * тогда должна показать состав, а не пустоту (ровно так у команды WW: 6 мест в дивизионе, энтри нет).
 * draft не показываем — у него ещё нет открытой витрины. Из кандидатов берём самый свежий турнир.
 */
export async function teamDivision(teamId: number) {
  const [spots, entries] = await Promise.all([
    prisma.rosterSpot.findMany({
      where: { teamId, divisionId: { not: null }, division: { tournament: { status: { not: "draft" } } } },
      select: { division: { include: { tournament: true } } },
      distinct: ["divisionId"],
    }),
    prisma.tournamentEntry.findMany({
      where: { teamId, division: { tournament: { status: { not: "draft" } } } },
      include: { division: { include: { tournament: true } } },
    }),
  ]);
  const withRoster = spots.map((s) => s.division!).filter(Boolean);
  const pool = withRoster.length > 0 ? withRoster : entries.map((e) => e.division);
  if (pool.length === 0) return null;
  pool.sort((a, b) => tournamentRank(a.tournament) - tournamentRank(b.tournament));
  return pool[0];
}

// ── турниры ──────────────────────────────────────────────────────────────────

export const listTournaments = () =>
  prisma.tournament.findMany({
    orderBy: [{ startAt: "desc" }, { id: "desc" }],
    include: { divisions: { orderBy: [{ orderNo: "asc" }, { id: "asc" }] } },
  });

export const tournamentBySlug = (slug: string) =>
  prisma.tournament.findUnique({
    where: { slug },
    include: { divisions: { orderBy: [{ orderNo: "asc" }, { id: "asc" }] } },
  });

export type TournamentInput = {
  name: string;
  slug?: string | null;
  short?: string | null;
  description?: string | null;
  format?: string | null;
  prize?: string | null;
  status?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  regOpenAt?: string | null;
  regCloseAt?: string | null;
};

const TOURNAMENT_STATUSES = ["draft", "registration", "running", "finished"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];
export const isTournamentStatus = (v: string): v is TournamentStatus =>
  (TOURNAMENT_STATUSES as readonly string[]).includes(v);

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: "Черновик",
  registration: "Приём заявок",
  running: "Идёт",
  finished: "Сыгран",
};

/** Пустая строка и null — одно и то же: «поля нет». undefined оставляет значение как было. */
const clean = (v: string | null | undefined) => {
  if (v === undefined) return undefined;
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

/** Дата из формы (`YYYY-MM-DD` или ISO). Мусор трактуем как «не задано», а не как 1970 год. */
const date = (v: string | null | undefined) => {
  if (v === undefined) return undefined;
  const s = (v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

function tournamentData(input: TournamentInput) {
  const status = clean(input.status);
  return {
    name: input.name.trim(),
    short: clean(input.short),
    description: clean(input.description),
    format: clean(input.format),
    prize: clean(input.prize),
    ...(status && isTournamentStatus(status) ? { status } : {}),
    startAt: date(input.startAt),
    endAt: date(input.endAt),
    regOpenAt: date(input.regOpenAt),
    regCloseAt: date(input.regCloseAt),
  };
}

export async function createTournament(input: TournamentInput) {
  const name = input.name.trim();
  if (!name) throw new Error("У турнира должно быть название");
  const slug = (clean(input.slug) ?? slugify(name)) || `t-${Date.now()}`;
  if (await prisma.tournament.findUnique({ where: { slug } }))
    throw new Error(`Турнир со слагом «${slug}» уже есть`);
  return prisma.tournament.create({ data: { ...tournamentData(input), slug } });
}

export async function updateTournament(id: number, input: TournamentInput) {
  if (!input.name.trim()) throw new Error("У турнира должно быть название");
  return prisma.tournament.update({ where: { id }, data: tournamentData(input) });
}

/**
 * Смена статуса отдельной операцией: это единственное поле, которое меняют «на ходу» (открыли
 * заявки, стартовали, закрыли сезон), и тащить ради него всю форму турнира незачем.
 */
export async function setTournamentStatus(id: number, status: string) {
  if (!isTournamentStatus(status)) throw new Error(`Неизвестный статус: ${status}`);
  return prisma.tournament.update({ where: { id }, data: { status } });
}

/**
 * Открыт ли приём заявок: статус «Приём заявок» и срок не прошёл. Одно место правды — правило
 * нужно и странице заявки (показывать ли форму), и записи (`submitTeamApplication`), а два
 * одинаковых условия в разных файлах однажды разъедутся.
 */
export const registrationOpen = (t: { status: string; regCloseAt: Date | null }): boolean =>
  t.status === "registration" && (!t.regCloseAt || t.regCloseAt.getTime() > Date.now());

/**
 * Что уедет вместе с турниром. Считается до удаления и показывается в подтверждении: турнир —
 * контейнер сезона, и «удалить» здесь означает снести весь его архив, а не одну строку.
 */
export async function tournamentUsage(id: number) {
  const divisionIds = (await prisma.division.findMany({ where: { tournamentId: id }, select: { id: true } })).map(
    (d) => d.id,
  );
  const where = { divisionId: { in: divisionIds } };
  const [entries, series, games, spots, groupRows, applications, points] = await Promise.all([
    prisma.tournamentEntry.count({ where }),
    prisma.series.count({ where }),
    prisma.match.count({ where: { series: { divisionId: { in: divisionIds } } } }),
    prisma.rosterSpot.count({ where }),
    prisma.groupEntry.count({ where }),
    prisma.teamApplication.count({ where: { tournamentId: id } }),
    prisma.pointsEntry.count({ where: { tournamentId: id } }),
  ]);
  return { divisions: divisionIds.length, entries, series, games, spots, groupRows, applications, points };
}

/**
 * Удаление турнира со всем, что к нему привязано: дивизионы, участие команд, составы этих
 * дивизионов, сетка встреч с картами и начисления TP. Задумано для тестовых прогонов — заводить и
 * сносить сезон целиком, не оставляя сирот: строковые зеркала (`Series.division`, `GroupEntry`)
 * FK-каскад не чистит, поэтому удаляем явно и в транзакции.
 *
 * Команды и игроки остаются: они переживают турнир (TOURNAMENTS-PLAN.md) — уходит только участие.
 */
export async function deleteTournament(id: number) {
  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { divisions: true } });
  if (!tournament) throw new Error("Турнир не найден");
  const divisionIds = tournament.divisions.map((d) => d.id);
  const where = { divisionId: { in: divisionIds } };
  const teamIds = (await prisma.tournamentEntry.findMany({ where, select: { teamId: true } })).map((e) => e.teamId);
  // Кому пересчитать кеш Player.tp: сумма «за всё время» уменьшится ровно у этих игроков.
  const tpPlayers = (
    await prisma.pointsEntry.findMany({
      where: { tournamentId: id, subjectType: "player", reason: "tp" },
      select: { subjectId: true },
    })
  ).map((r) => r.subjectId);

  await prisma.$transaction([
    // Карты сначала: у Match связь с серией необязательная, то есть каскад бы их не тронул, а
    // отвязанная карта осталась бы висеть в архиве без встречи.
    prisma.match.deleteMany({ where: { series: { divisionId: { in: divisionIds } } } }),
    prisma.series.deleteMany({ where }),
    prisma.groupEntry.deleteMany({ where }),
    prisma.rosterSpot.deleteMany({ where }),
    prisma.pointsEntry.deleteMany({ where: { tournamentId: id } }),
    // Дивизионы, участие и заявки уедут каскадом от турнира (см. schema.prisma).
    prisma.tournament.delete({ where: { id } }),
  ]);

  // Зеркало `Team.group` каскад не чинит: команда осталась бы «в Division 1» несуществующего
  // турнира. Ставим имя дивизиона по оставшемуся участию — команда могла играть и в другом.
  for (const teamId of new Set(teamIds)) {
    const left = await prisma.tournamentEntry.findFirst({
      where: { teamId },
      orderBy: { id: "desc" },
      include: { division: true },
    });
    await prisma.team.update({ where: { id: teamId }, data: { group: left?.division.name ?? null } });
  }

  // Кеш TP — из реестра, как в setPlayerTp: истина в PointsEntry, поле лишь сумма по нему.
  for (const playerId of new Set(tpPlayers)) {
    const sum = await prisma.pointsEntry.aggregate({
      where: { subjectType: "player", reason: "tp", subjectId: playerId },
      _sum: { amount: true },
    });
    await prisma.player.update({ where: { id: playerId }, data: { tp: sum._sum.amount ?? 0 } });
  }

  return tournament;
}

// ── дивизионы ────────────────────────────────────────────────────────────────

export type DivisionInput = {
  name: string;
  slug?: string | null;
  label?: string | null;
  short?: string | null;
  orderNo?: number | null;
  mmrFrom?: number | null;
  mmrTo?: number | null;
};

export async function createDivision(tournamentId: number, input: DivisionInput) {
  const name = input.name.trim();
  if (!name) throw new Error("У дивизиона должно быть название");
  const slug = (clean(input.slug) ?? slugify(name)) || "div";
  const taken = await prisma.division.findFirst({ where: { tournamentId, OR: [{ slug }, { name }] } });
  if (taken) throw new Error(`В этом турнире уже есть дивизион «${taken.slug}» / «${taken.name}»`);
  const last = await prisma.division.findFirst({ where: { tournamentId }, orderBy: { orderNo: "desc" } });
  return prisma.division.create({
    data: {
      tournamentId,
      slug,
      name,
      label: clean(input.label),
      short: clean(input.short),
      orderNo: input.orderNo ?? (last ? last.orderNo + 1 : 0),
      mmrFrom: input.mmrFrom ?? null,
      mmrTo: input.mmrTo ?? null,
    },
  });
}

/**
 * Правка дивизиона. Переименование тянет за собой зеркала: имя дивизиона лежит строкой в командах,
 * сериях и итогах группы, и без этого шага таблица сезона просто опустела бы.
 */
export async function updateDivision(id: number, input: DivisionInput) {
  const name = input.name.trim();
  if (!name) throw new Error("У дивизиона должно быть название");
  const before = await prisma.division.findUnique({ where: { id } });
  if (!before) throw new Error("Дивизион не найден");

  const division = await prisma.division.update({
    where: { id },
    data: {
      name,
      slug: clean(input.slug) ?? before.slug,
      label: clean(input.label),
      short: clean(input.short),
      ...(input.orderNo === undefined || input.orderNo === null ? {} : { orderNo: input.orderNo }),
      mmrFrom: input.mmrFrom ?? null,
      mmrTo: input.mmrTo ?? null,
    },
  });

  if (before.name !== name) {
    await prisma.$transaction([
      prisma.team.updateMany({ where: { group: before.name }, data: { group: name } }),
      prisma.series.updateMany({ where: { divisionId: id }, data: { division: name } }),
      prisma.groupEntry.updateMany({ where: { divisionId: id }, data: { division: name } }),
    ]);
  }
  return division;
}

/** Удаление дивизиона — только пустого: с ним уедут участники, а вместе с ними и разрез архива. */
export async function deleteDivision(id: number) {
  const entries = await prisma.tournamentEntry.count({ where: { divisionId: id } });
  if (entries) throw new Error(`В дивизионе ${entries} команд(ы) — сначала уберите их`);
  const series = await prisma.series.count({ where: { divisionId: id } });
  if (series) throw new Error(`К дивизиону привязано ${series} встреч(и) — удалять нельзя`);
  return prisma.division.delete({ where: { id } });
}

// ── жеребьёвка ───────────────────────────────────────────────────────────────

/** Правка строки участия: группа и посев. Пустая группа — «не разведены», это законное состояние. */
export async function setEntryDraw(entryId: number, draw: { group?: string | null; seed?: number | null }) {
  const group = draw.group === undefined ? undefined : (draw.group ?? "").trim().toUpperCase() || null;
  return prisma.tournamentEntry.update({
    where: { id: entryId },
    data: { ...(group === undefined ? {} : { group }), ...(draw.seed === undefined ? {} : { seed: draw.seed }) },
  });
}

/**
 * Развести команды дивизиона по группам «змейкой» по силе состава: 1-я команда в группу A, 2-я в B,
 * 3-я в B, 4-я в A и так далее. Змейка, а не по кругу: она уравнивает суммарную силу групп, иначе
 * в первой группе окажутся все сеяные.
 *
 * Сила — средний MMR основы (позиции 1–5), как на витрине команды. Без MMR команда идёт в конец
 * посева: считать её сильной не за что.
 */
export async function drawGroups(divisionId: number, groupCount: number) {
  if (groupCount < 1) throw new Error("Групп должно быть хотя бы одна");
  const entries = await prisma.tournamentEntry.findMany({
    where: { divisionId },
    include: { team: { include: { roster: { where: { divisionId }, include: { player: true } } } } },
  });

  const strength = (e: (typeof entries)[number]) => {
    // Основа — те же позиции 1–5, что считает teamMmr на витрине; роли живут строками (roles.ts).
    const core = e.team.roster.filter((s) => s.role && !["coach", "standin"].includes(s.role) && s.player.mmr);
    if (!core.length) return 0;
    return core.reduce((sum, s) => sum + (s.player.mmr ?? 0), 0) / core.length;
  };

  const sorted = [...entries].sort((a, b) => strength(b) - strength(a));
  const letters = Array.from({ length: groupCount }, (_, i) => String.fromCharCode(65 + i)); // A, B, C…

  for (const [i, entry] of sorted.entries()) {
    const row = Math.floor(i / groupCount);
    const pos = i % groupCount;
    // Каждый второй ряд посева идёт в обратном порядке — это и есть змейка.
    const group = letters[row % 2 === 0 ? pos : groupCount - 1 - pos];
    await prisma.tournamentEntry.update({ where: { id: entry.id }, data: { group, seed: i + 1 } });
  }
  return sorted.length;
}

// ── участие команд ───────────────────────────────────────────────────────────

export const divisionTeams = (divisionId: number) =>
  prisma.tournamentEntry.findMany({
    where: { divisionId },
    include: { team: true },
    orderBy: [{ seed: "asc" }, { id: "asc" }],
  });

/**
 * Поставить команду в дивизион (или снять, `divisionId = null`). Здесь же обновляется зеркало
 * `Team.group` — ради него всё и заведено одной функцией: два места, пишущих дивизион команды,
 * рано или поздно разъедутся, и витрина покажет команду не в том разделе, где её встречи.
 *
 * Участие в других турнирах не трогаем: команда играет в S2 и в S3, это разные строки.
 */
export async function setTeamDivision(
  teamId: number,
  divisionId: number | null,
  opts: { seed?: number | null; group?: string | null; tournamentId?: number } = {},
) {
  if (divisionId === null) {
    // Снимаем из ЯВНО указанного турнира, а не из «текущего»: карточку открывают у любого сезона,
    // и привязка к current означала, что кнопка «Убрать» на карточке следующего турнира молча
    // выкидывала команду из идущего, а на месте не меняла ничего.
    const tournamentId = opts.tournamentId ?? (await currentTournament())?.id;
    if (!tournamentId) return null;
    await prisma.tournamentEntry.deleteMany({ where: { teamId, division: { tournamentId } } });
    // Снятие с турнира отзывает и заявку команды на него: участие и заявка — одна цепочка (решение
    // Стаса), иначе на подаче осталась бы «принята, состав уже в турнире» у команды, которой в
    // турнире уже нет, и повторная подача правила бы мёртвую строку вместо новой заявки.
    await prisma.teamApplication.deleteMany({ where: { teamId, tournamentId } });
    // Зеркало гасим только когда сняли из текущего турнира: `Team.group` описывает актуальный сезон.
    const current = await currentTournament();
    if (current?.id === tournamentId) await prisma.team.update({ where: { id: teamId }, data: { group: null } });
    return null;
  }

  const division = await prisma.division.findUnique({ where: { id: divisionId } });
  if (!division) throw new Error("Дивизион не найден");

  // Одна команда — один дивизион внутри турнира: иначе она попадёт в две таблицы сразу.
  await prisma.tournamentEntry.deleteMany({
    where: { teamId, divisionId: { not: divisionId }, division: { tournamentId: division.tournamentId } },
  });
  const entry = await prisma.tournamentEntry.upsert({
    where: { divisionId_teamId: { divisionId, teamId } },
    create: { divisionId, teamId, seed: opts.seed ?? null, group: opts.group ?? null },
    update: {
      ...(opts.seed === undefined ? {} : { seed: opts.seed }),
      ...(opts.group === undefined ? {} : { group: opts.group }),
    },
  });

  // Зеркало ставим только для текущего турнира: запись команды в прошлый сезон не должна
  // переносить её из актуальной таблицы в архивную.
  const current = await currentTournament();
  if (current?.id === division.tournamentId)
    await prisma.team.update({ where: { id: teamId }, data: { group: division.name } });

  return entry;
}
