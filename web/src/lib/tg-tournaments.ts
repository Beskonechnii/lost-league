// Только сервер / скрипт: раздел «Турниры» в телеграм-боте — навигация по сезонам, своему составу
// и командам турнира.
//
// Отдельно от `tg-menu.ts` по той же причине, по какой отдельны анкеты (`tg-forms.ts`): меню — это
// плоские справки, каждая в один ответ, а здесь у человека три уровня (турнир → раздел → команда),
// и на каждом нужно помнить, где он стоит. Состояние держим в общей `BotSession` под префиксом
// `tt_*` — как `form_*`, `reg_*` и `pe_*`; пишет её `tg-quiz.ts`, модуль только возвращает наружу.
//
// **Почему состав живёт здесь, а не кнопкой первого уровня.** Состав принадлежит дивизиону турнира
// (`RosterSpot.divisionId`), и «мой состав» без турнира — это два разных состава (D1 и прошлый
// сезон), слитые в один список. Внутри турнира вопрос однозначен.

import { prisma } from "./prisma";
import { siteIsLocal, siteUrl } from "./site";
import type { Reply } from "./telegram";
import { playerLinks, playerPath, telegramUrl } from "./profiles";
import { roleShort, roleOrder } from "./roles";
import { teamMmr } from "./roster-data";
import { registrationOpen, TOURNAMENT_STATUS_LABELS, isTournamentStatus } from "./tournaments";
import { parseDraft } from "./team-application";
import { MENU, applicationsOf, identify, menuKeyboard, unknownReply } from "./tg-menu";
import { captainSpots, linkedPlayerId } from "./match-request";
import { MEETING_BUTTON } from "./tg-meetings";

/** Шаги раздела. Лежат в том же `BotSession.step`, что и шаги заявки — префикс их разводит. */
export type TtStep = "tt_pick" | "tt_menu" | "tt_teams";

export const isTtStep = (step: string): step is TtStep => step.startsWith("tt_");

/** Где человек стоит. Турнир — единственное, что нужно помнить: команда выбирается заново каждый раз. */
export type TtState = { tournamentId: number | null };

export const emptyTt = (): TtState => ({ tournamentId: null });

/* Подписи кнопок раздела. Экспортируются: те же слова стоят на кнопках нодового флоу
   (`bot-flow/default-flow.ts`) — по подписи едет и переход по ребру, и разбор в старом коде. */
export const MY_TEAM = "Моя команда";
export const TEAMS = "Команды турнира";
export const BACK = "К списку турниров";

/** Выход из раздела. Наружу — потому что нажатие на него без сессии тоже надо узнать (`tg-quiz.ts`). */
export const TT_EXIT = "В меню";

/** Служебные ответы раздела — ими нельзя случайно назваться на шаге со свободным текстом. */
export const TT_SERVICE = [MY_TEAM, TEAMS, BACK, TT_EXIT];

/**
 * Кнопка раздела? Клавиатура у Telegram висит до отмены, и «Команды турнира» прилетает и через день
 * после того, как диалог закончился.
 */
export const isTtButton = (text: string): boolean => TT_SERVICE.includes(text.trim());

/** Результат шага: что ответить и куда переходить. `done` — из раздела вышли, диалог сбросить. */
export type TtResult = {
  replies: Reply[];
  step?: TtStep;
  state: TtState;
  done?: boolean;
};

// ── список турниров ──────────────────────────────────────────────────────────

/**
 * Что показываем: приём заявок, идущие и три последних сыгранных. Черновики — никогда: это турнир,
 * который оператор ещё заводит, и его название с датами меняются на ходу.
 *
 * Сыгранных именно три: архив за все сезоны есть на сайте, а в чате длинный список лишь мешает
 * добраться до текущего.
 */
async function visibleTournaments() {
  const rows = await prisma.tournament.findMany({
    where: { status: { in: ["registration", "running", "finished"] } },
    orderBy: [{ startAt: "desc" }, { id: "desc" }],
    include: { divisions: { orderBy: [{ orderNo: "asc" }, { id: "asc" }] } },
  });
  const of = (status: string) => rows.filter((t) => t.status === status);
  return [...of("registration"), ...of("running"), ...of("finished").slice(0, 3)];
}

type Listed = Awaited<ReturnType<typeof visibleTournaments>>[number];

const statusLabel = (t: { status: string }) =>
  isTournamentStatus(t.status) ? TOURNAMENT_STATUS_LABELS[t.status] : t.status;

/** Строка турнира в списке: название, состояние и дивизионы — по ним человек и выбирает. */
const listRow = (t: Listed) =>
  [`<b>${t.name}</b> — ${statusLabel(t)}`, t.divisions.map((d) => d.name).join(", ") || null]
    .filter(Boolean)
    .join("\n");

const listText = (rows: Listed[]) => ["Какой турнир смотрим?", ...rows.map(listRow)].join("\n\n");

/** Текст списка без навигации: им отвечаем посреди начатого диалога, чтобы не сбрасывать его. */
export async function tournamentsDigest(): Promise<Reply> {
  const rows = await visibleTournaments();
  if (rows.length === 0) return { text: "Сейчас турниров нет — как объявим, напишу." };
  return { text: rows.map(listRow).join("\n\n") };
}

const listReply = (rows: Listed[]): Reply => ({
  text: listText(rows),
  keyboard: [...rows.map((t) => [t.name]), [TT_EXIT]],
});

/** Вход в раздел из меню. Турниров нет — навигацию не заводим: ходить всё равно некуда. */
export async function startTournaments(): Promise<TtResult> {
  const rows = await visibleTournaments();
  if (rows.length === 0) {
    return {
      replies: [{ text: "Сейчас турниров нет — как объявим, напишу.", keyboard: await menuKeyboard() }],
      state: emptyTt(),
      done: true,
    };
  }
  return { replies: [listReply(rows)], step: "tt_pick", state: emptyTt() };
}

// ── экран турнира ────────────────────────────────────────────────────────────

const day = (date: Date | null): string | null =>
  date ? date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : null;

/** Дата и время встречи по-человечески. Времени может не быть — тогда и не пишем. */
const when = (date: Date | null): string =>
  date
    ? `, ${date.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
    : "";

/**
 * Кнопка «Заказать встречу» есть только у капитана этого турнира: остальным она обещала бы то,
 * чего им нельзя, и вела бы в отказ. Сам заказ ведёт `tg-meetings.ts` — сюда он не заходит, кнопку
 * ловит первый уровень (`tg-quiz.ts`), как «Изменить данные».
 */
async function canOrderMeeting(tournamentId: number, tgId: string | null | undefined): Promise<boolean> {
  const playerId = await linkedPlayerId(tgId);
  if (!playerId) return false;
  return (await captainSpots(playerId, tournamentId)).length > 0;
}

const tournamentKeyboard = (open: boolean, meeting = false): string[][] => [
  [MY_TEAM],
  [TEAMS],
  ...(meeting ? [[MEETING_BUTTON]] : []),
  ...(open ? [[MENU.apply]] : []),
  [BACK, TT_EXIT],
];

/** Карточка турнира без клавиатуры: тот же текст показывает нода-действие нодового флоу. */
function tournamentText(t: Listed): string {
  const dates = [day(t.startAt), day(t.endAt)].filter(Boolean).join(" — ");
  return [
    `<b>${t.name}</b> — ${statusLabel(t)}`,
    t.divisions.length ? `Дивизионы: ${t.divisions.map((d) => d.name).join(", ")}` : null,
    t.format || null,
    dates || null,
    registrationOpen(t) && t.regCloseAt ? `Заявки принимаем до ${day(t.regCloseAt)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function tournamentReply(t: Listed, meeting = false): Reply {
  return { text: tournamentText(t), keyboard: tournamentKeyboard(registrationOpen(t), meeting) };
}

/**
 * Ответ на «Подать заявку»: ссылка на сборку состава. Отдельным сообщением, а не строкой в карточке
 * турнира, — её надо нажать, а не прочитать.
 */
function applyText(t: { slug: string; name: string }): string {
  const url = `${siteUrl()}/tournaments/${t.slug}/apply`;
  // Локальный адрес телеграм ссылкой не делает — он покажет её обычным текстом, и человек решит,
  // что бот сломался. Честнее сказать, что сайт не опубликован: адрес всё равно виден, а
  // организатор по этой же строке понимает, что надо поднять туннель (скилл `serve`).
  const link = siteIsLocal()
    ? [`Сайт сейчас не опубликован наружу (${url}) — скажите организатору.`]
    : [`<a href="${url}">Открыть сборку состава</a>`];
  return [
    `<b>${t.name}</b> — заявка подаётся на сайте: там виден весь пул игроков лиги, и состав`,
    "набирается мышью, а не по одному нику в чате.",
    "",
    ...link,
    "",
    `Сайт спросит, кто вы: код для входа даёт бот — «${MENU.profile}» → «${MENU.login}».`,
    "В составе может быть только игрок, которого знает лига: незнакомого позовите",
    "зарегистрироваться — ссылка-приглашение есть там же, на странице заявки.",
  ].join("\n");
}

export function applyReply(t: { slug: string; name: string }, open = true, meeting = false): Reply {
  return { text: applyText(t), keyboard: tournamentKeyboard(open, meeting) };
}

const loadTournament = (id: number) =>
  prisma.tournament.findUnique({
    where: { id },
    include: { divisions: { orderBy: [{ orderNo: "asc" }, { id: "asc" }] } },
  });

// ── «Моя команда» ────────────────────────────────────────────────────────────

/**
 * Строка игрока в составе: ник, позиция и капитанство — то же, что показывает витрина. Ник ведёт
 * на карточку игрока в лиге: у неё есть постоянный адрес по числовому id, и это единственный
 * способ из чата попасть к его статистике, не пересказывая её сюда.
 */
const rosterLine = (m: { isCaptain: boolean; role: string | null; player: { id: number; nickname: string } }) =>
  [
    `• <a href="${siteUrl()}${playerPath(m.player.id)}"><b>${m.player.nickname}</b></a>`,
    roleShort(m.role) ?? "без позиции",
    m.isCaptain ? "капитан" : null,
  ]
    .filter(Boolean)
    .join(" — ");

/** Статус поданной заявки — то, ради чего капитан и заходит сюда сразу после отправки. */
function applicationBlock(a: Awaited<ReturnType<typeof applicationsOf>>[number]): string {
  const draft = parseDraft(a.payload);
  const state =
    a.status === "rejected"
      ? `Заявка возвращена${a.notes ? `: ${a.notes}` : ""}. Поправить — «${MENU.apply}».`
      : "Заявка на проверке у организатора.";
  const lines = (draft?.players ?? []).map((p) =>
    [`• <b>${p.nickname}</b>`, roleShort(p.role) ?? "без позиции", p.isCaptain ? "капитан" : null]
      .filter(Boolean)
      .join(" — "),
  );
  return [`<b>${draft?.name ?? "Команда"}</b>${a.division ? ` · ${a.division.name}` : ""}`, state, "", ...lines].join("\n");
}

/**
 * Состав человека в этом турнире: сначала поданные заявки со статусом, потом места, уже заведённые
 * в лигу. Показываем и то, и другое: состав, отправленный минуту назад, в ростере появится только
 * после одобрения, а до тех пор человеку кажется, что заявка пропала.
 */
async function myTeam(t: Listed, chatId: string, username: string | null | undefined, tgId: string | null | undefined): Promise<string[]> {
  const blocks: string[] = [];

  const applications = await applicationsOf(chatId, username);
  // Одобренная заявка живёт дальше как состав в ростере — второй раз её же показывать незачем.
  for (const a of applications) {
    if (a.tournamentId === t.id && a.status !== "approved") blocks.push(applicationBlock(a));
  }

  const divisionIds = t.divisions.map((d) => d.id);
  const me = await identify(chatId, username, tgId);
  if (me.length && divisionIds.length) {
    const spots = await prisma.rosterSpot.findMany({
      where: { playerId: { in: me }, divisionId: { in: divisionIds } },
      include: { team: true, division: true },
    });
    for (const spot of spots) {
      const mates = await prisma.rosterSpot.findMany({
        where: { teamId: spot.teamId, divisionId: spot.divisionId },
        include: { player: true },
      });
      const next = await prisma.series.findFirst({
        where: {
          OR: [{ homeId: spot.teamId }, { awayId: spot.teamId }],
          divisionId: spot.divisionId,
          playedAt: null,
          startAt: { gte: new Date() },
        },
        orderBy: { startAt: "asc" },
        include: { home: true, away: true },
      });
      blocks.push(
        [
          `<b>${spot.team.name}</b>${spot.division ? ` · ${spot.division.name}` : ""}`,
          "",
          ...mates.sort((a, b) => roleOrder(a.role) - roleOrder(b.role)).map(rosterLine),
          ...(next
            ? ["", `Ближайшая встреча: <b>${next.home.name}</b> — <b>${next.away.name}</b>${when(next.startAt)}`]
            : []),
        ].join("\n"),
      );
    }
  }
  return blocks;
}

/** Кто спрашивает: чат, хендл и числовой id — этого хватает всем справкам раздела. */
type Who = { chatId: string; username?: string | null; tgId?: string | null };

/**
 * «Моя команда» одним текстом. `known: false` — лига человека не знает: это другой случай, чем
 * «знаем, но в этом турнире не заявлен», и путать их нельзя (однажды бот так сказал «вас нет»
 * игроку, который в лиге есть).
 */
async function myTeamText(t: Listed, ctx: Who): Promise<{ text: string; known: boolean }> {
  const blocks = await myTeam(t, ctx.chatId, ctx.username, ctx.tgId);
  if (blocks.length) return { text: blocks.join("\n\n"), known: true };

  const me = await identify(ctx.chatId, ctx.username, ctx.tgId);
  if (me.length === 0) return { text: (await unknownReply(ctx.username)).text, known: false };
  const player = await prisma.player.findUnique({ where: { id: me[0] }, select: { nickname: true } });
  return {
    text:
      `Вы есть в лиге как <b>${player?.nickname ?? "игрок"}</b>, но в турнире «${t.name}» не заявлены.` +
      (registrationOpen(t) ? ` Заявиться — «${MENU.apply}».` : ""),
    known: true,
  };
}

// ── «Команды турнира» ────────────────────────────────────────────────────────

/** Команды турнира — по участию (`TournamentEntry`), а не по строке-зеркалу `Team.group`. */
const tournamentEntries = (t: Listed) =>
  prisma.tournamentEntry.findMany({
    where: { divisionId: { in: t.divisions.map((d) => d.id) } },
    include: { team: true, division: true },
    orderBy: [{ divisionId: "asc" }, { seed: "asc" }, { id: "asc" }],
  });

type Entry = Awaited<ReturnType<typeof tournamentEntries>>[number];

/**
 * Список команд — кнопками, а карточка приезжает отдельным сообщением. Одним списком не выводим:
 * в сообщение Telegram влезает 4096 знаков, а команд в дивизионе бывает два десятка, и у каждой
 * состав со ссылками.
 */
/** Список команд текстом — по дивизионам. Без клавиатуры: её собирают оба пути по-своему. */
function teamsText(entries: Entry[]): string {
  const byDivision = new Map<string, string[]>();
  for (const e of entries) {
    const key = e.division?.name ?? "Без дивизиона";
    byDivision.set(key, [...(byDivision.get(key) ?? []), e.team.name]);
  }
  const text = [...byDivision.entries()].map(([name, teams]) => `<b>${name}</b> (${teams.length})\n${teams.join(", ")}`);
  return ["Чью команду смотрим?", ...text].join("\n\n");
}

/** Кнопки команд: по две в ряд — столбец из двадцати кнопок на телефоне листать невозможно. */
function teamRows(entries: Entry[]): string[][] {
  const names = entries.map((e) => e.team.name);
  const rows: string[][] = [];
  for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2));
  return rows;
}

function teamsReply(entries: Entry[]): Reply {
  return { text: teamsText(entries), keyboard: [...teamRows(entries), [BACK, TT_EXIT]] };
}

/** Карточка команды: состав, сила, капитан и ссылки — всё, чего хватает, чтобы позвать на игру. */
async function teamCard(entry: Entry): Promise<string> {
  const roster = await prisma.rosterSpot.findMany({
    where: { teamId: entry.teamId, divisionId: entry.divisionId },
    include: { player: true },
  });
  const sorted = roster.sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
  const mmr = teamMmr(sorted.map((s) => ({ role: s.role, mmr: s.player.mmr })));

  const lines = sorted.map((s) => {
    const link = playerLinks(s.player).dotabuff;
    const parts = [
      // Ник — ссылкой на карточку в лиге, Dotabuff остаётся отдельной: это разные вопросы
      // («кто он у нас» и «как он играет вообще»), и подменять один другим неверно.
      `• <a href="${siteUrl()}${playerPath(s.player.id)}"><b>${s.player.nickname}</b></a>`,
      roleShort(s.role) ?? "без позиции",
      s.isCaptain ? "капитан" : null,
    ].filter(Boolean);
    return link ? `${parts.join(" — ")} — <a href="${link}">Dotabuff</a>` : parts.join(" — ");
  });

  const captain = sorted.find((s) => s.isCaptain);
  return [
    `<b>${entry.team.name}</b>${entry.division ? ` · ${entry.division.name}` : ""}`,
    // Средний MMR — по основе (позиции 1–5), как на витрине: замены и тренер цифру двигать не должны.
    mmr.average ? `Средний MMR основы: ${mmr.average}` : null,
    "",
    ...(lines.length ? lines : ["Состав ещё не заведён."]),
    captain
      ? `\nКапитан: <a href="${siteUrl()}${playerPath(captain.player.id)}"><b>${captain.player.nickname}</b></a>` +
        `${captain.player.telegram ? ` — ${telegramUrl(captain.player.telegram)}` : " (телеграм не указан)"}`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

// ── шаг диалога ──────────────────────────────────────────────────────────────

/**
 * Один ответ человека в разделе. Состояние возвращаем наружу, а не пишем сами: строка диалога в
 * `BotSession` общая с заявкой, и два писателя в неё — это две правды о том, где человек стоит.
 */
export async function handleTournaments(
  step: TtStep,
  state: TtState,
  text: string,
  ctx: { chatId: string; username?: string | null; tgId?: string | null },
): Promise<TtResult> {
  const answer = text.trim();
  if (answer === TT_EXIT) return { replies: [], state, done: true };

  const rows = await visibleTournaments();
  const back = (): TtResult => ({ replies: [listReply(rows)], step: "tt_pick", state: { tournamentId: null } });
  if (rows.length === 0) {
    return { replies: [{ text: "Сейчас турниров нет — как объявим, напишу.", keyboard: await menuKeyboard() }], state, done: true };
  }

  if (step === "tt_pick") {
    const chosen = rows.find((t) => t.name.trim().toLowerCase() === answer.toLowerCase());
    if (!chosen) return { replies: [listReply(rows)], step: "tt_pick", state };
    const canMeet = await canOrderMeeting(chosen.id, ctx.tgId);
    return { replies: [tournamentReply(chosen, canMeet)], step: "tt_menu", state: { tournamentId: chosen.id } };
  }

  // Турнир мог уехать в черновики или быть удалён, пока человек смотрел, — тогда возвращаем к списку,
  // а не падаем на пустой ссылке.
  const current = state.tournamentId ? await loadTournament(state.tournamentId) : null;
  if (!current) return back();
  const open = registrationOpen(current);
  // Капитанство спрашиваем один раз на ответ: от него зависит только лишняя кнопка в клавиатуре.
  const meet = await canOrderMeeting(current.id, ctx.tgId);

  if (answer === BACK) return back();

  if (step === "tt_menu") {
    if (answer === MY_TEAM) {
      const mine = await myTeamText(current, ctx);
      // Лига человека не знает — показывать ему экран турнира не с чем: выходим в меню.
      if (!mine.known) return { replies: [await unknownReply(ctx.username)], state, done: true };
      return { replies: [{ text: mine.text, keyboard: tournamentKeyboard(open, meet) }], step: "tt_menu", state };
    }

    if (answer === TEAMS) {
      const entries = await tournamentEntries(current);
      if (entries.length === 0) {
        return {
          replies: [{ text: "Команд в турнире пока нет — заявки ещё разбирают.", keyboard: tournamentKeyboard(open, meet) }],
          step: "tt_menu",
          state,
        };
      }
      return { replies: [teamsReply(entries)], step: "tt_teams", state };
    }

    if (answer === MENU.apply) {
      if (!open) {
        return {
          replies: [{ text: "Приём заявок в этот турнир закрыт.", keyboard: tournamentKeyboard(open, meet) }],
          step: "tt_menu",
          state,
        };
      }
      // Состав собирается на сайте (Э5): в чате пятёрку не выбрать из пула, а вписать кого угодно
      // мимо лиги больше нельзя. Из раздела при этом не выходим — человек вернётся сюда за статусом.
      return { replies: [applyReply(current, open, meet)], step: "tt_menu", state };
    }

    return { replies: [tournamentReply(current, meet)], step: "tt_menu", state };
  }

  // tt_teams
  const entries = await tournamentEntries(current);
  // Именами команды не уникальны: в S2 «ReMix» есть и в D1, и в D2 — это две разные команды.
  // Кнопка одна, поэтому показываем обе карточки, а не угаданную первой.
  const chosen = entries.filter((e) => e.team.name.trim().toLowerCase() === answer.toLowerCase());
  if (chosen.length === 0) return { replies: [teamsReply(entries)], step: "tt_teams", state };
  const cards = await Promise.all(chosen.map(teamCard));
  return {
    replies: [{ text: cards.join("\n\n"), keyboard: teamsReply(entries).keyboard }],
    step: "tt_teams",
    state,
  };
}

// ── экраны для нодового флоу ─────────────────────────────────────────────────

/*
 * То же самое, что показывает `handleTournaments` выше, но без навигации и без клавиатур: где
 * человек стоит, помнит граф, а кнопки рисуют его ноды (`bot-flow/default-flow.ts`). Здесь —
 * только содержимое экрана и список, которого граф не знает заранее (турниры, команды): их
 * подписи возвращаются рядами и уезжают клавиатурой ближайшей ждущей ноды.
 *
 * Логика не переписана — это обёртки над теми же функциями раздела. Иначе две правды об одном
 * экране разъехались бы на первой же правке текста.
 */

/** Список турниров: текст и ряды кнопок с их названиями. Пустые ряды — турниров нет. */
export async function flowTournaments(): Promise<{ text: string; rows: string[][] }> {
  const rows = await visibleTournaments();
  if (rows.length === 0) return { text: "Сейчас турниров нет — как объявим, напишу.", rows: [] };
  return { text: listText(rows), rows: rows.map((t) => [t.name]) };
}

/** Экран турнира по названию с кнопки. `null` — такого турнира в списке нет (промах или опечатка). */
export async function flowTournament(
  name: string,
  tgId?: string | null,
): Promise<{ id: number; text: string; open: boolean; meeting: boolean } | null> {
  const rows = await visibleTournaments();
  const chosen = rows.find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (!chosen) return null;
  return {
    id: chosen.id,
    text: tournamentText(chosen),
    open: registrationOpen(chosen),
    meeting: await canOrderMeeting(chosen.id, tgId),
  };
}

/** «Моя команда». `null` — турнир уехал в черновики или удалён, пока человек смотрел. */
export async function flowMyTeam(id: number, ctx: Who): Promise<{ text: string; known: boolean } | null> {
  const t = await loadTournament(id);
  if (!t) return null;
  return myTeamText(t, ctx);
}

/** «Команды турнира»: текст по дивизионам и ряды кнопок. Пустые ряды — команд ещё нет. */
export async function flowTeams(id: number): Promise<{ text: string; rows: string[][] } | null> {
  const t = await loadTournament(id);
  if (!t) return null;
  const entries = await tournamentEntries(t);
  if (entries.length === 0) return { text: "Команд в турнире пока нет — заявки ещё разбирают.", rows: [] };
  return { text: teamsText(entries), rows: teamRows(entries) };
}

/**
 * Карточка команды по названию с кнопки. Ряды возвращаем те же: после карточки человек остаётся в
 * списке команд, и клавиатура не должна пропасть. `null` — команды с таким именем в турнире нет.
 */
export async function flowTeamCard(id: number, name: string): Promise<{ text: string; rows: string[][] } | null> {
  const t = await loadTournament(id);
  if (!t) return null;
  const entries = await tournamentEntries(t);
  // Именами команды не уникальны (в S2 «ReMix» есть и в D1, и в D2) — показываем обе карточки.
  const chosen = entries.filter((e) => e.team.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (chosen.length === 0) return null;
  const cards = await Promise.all(chosen.map(teamCard));
  return { text: cards.join("\n\n"), rows: teamRows(entries) };
}

/** «Подать заявку»: ссылка на сборку состава либо отказ, если приём закрыт. */
export async function flowApply(id: number): Promise<{ text: string; open: boolean } | null> {
  const t = await loadTournament(id);
  if (!t) return null;
  if (!registrationOpen(t)) return { text: "Приём заявок в этот турнир закрыт.", open: false };
  return { text: applyText(t), open: true };
}
