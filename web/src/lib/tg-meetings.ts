// Только сервер / скрипт: «Заказать встречу» в боте — диалог капитана, ответ капитана соперника и
// решение организатора. Модель очереди живёт в `match-request.ts`, здесь тексты, кнопки и отправка.
//
// **Шаги:** какая встреча → дата → время → подтверждение. Соперника не выбирают: список встреч —
// это расписание команды капитана (`openSeriesFor`), а не список команд лиги.
//
// **Цепочка.** Предложил один капитан → второй принял (или предложил своё, и тогда исходное
// закрывается, а встречное ссылается на него `parentId`) → организатор подтвердил, и только тут
// время попадает в `Series.startAt`. Рассылку о назначении делает не этот модуль, а
// `announceReschedule` из `tg-schedule.ts`: вход у уведомления «встреча назначена/перенесена» один,
// откуда бы время ни пришло — из админки руками или отсюда.
//
// **Написать можно лишь тому, кто сам писал боту** (`chatsOfPlayers`): капитану соперника без чата
// бот не напишет, и предложение зависнет. Поэтому такому капитану мы честно говорим об этом сразу,
// а не оставляем ждать ответа, которого не будет.
//
// Шаги живут в общей `BotSession` под префиксом `mr_*` — как `reg_*`, `pe_*`, `form_*` и `tt_*`:
// диалог у человека один. Состояние модуль возвращает наружу, пишет его `tg-quiz.ts`.

import { prisma } from "./prisma";
import { botConfigured, sendMessage, sendTo, telegramConfigured, type Keyboard, type Reply } from "./telegram";
import { loadBotSettings } from "./bot-settings";
import { siteIsLocal, siteUrl } from "./site";
import { announceReschedule, chatsOfPlayers, when } from "./tg-schedule";
import {
  acceptProposal,
  approveProposal,
  captainSpots,
  captainsOf,
  createProposal,
  declineProposal,
  linkedPlayerId,
  loadRequest,
  openSeriesFor,
  opponentTeamId,
  proposalsForCaptain,
  proposerTeamId,
  type MatchRequestRow,
} from "./match-request";

/** Шаг диалога. Лежит в том же `BotSession.step`, что и шаги заявки — префикс их разводит. */
export type MrStep = "mr_series" | "mr_date" | "mr_time" | "mr_confirm";

export const isMrStep = (step: string): step is MrStep => step.startsWith("mr_");

/**
 * Что уже выбрано. Дату и время держим строками («2026-08-29», «20:00»), а не готовым `Date`:
 * состояние уезжает в JSON и обратно, и там `Date` всё равно становится строкой — пусть уж это
 * будет строка, которую видно глазами.
 */
export type MrState = {
  seriesId: number | null;
  date: string | null;
  time: string | null;
  /** Исходное предложение, если это встречное. */
  parentId: number | null;
};

export const emptyMeeting = (): MrState => ({ seriesId: null, date: null, time: null, parentId: null });

export const MEETING_BUTTON = "Заказать встречу";
const SEND = "Отправить сопернику";
const CANCEL = "Не сейчас";

/** Ответы на предложение соперника. Приезжают без диалога — клавиатуру ставит само уведомление. */
export const MR_ACCEPT = "Принять время";
export const MR_COUNTER = "Предложить другое";

/** Служебные ответы сценария — ими нельзя случайно назваться на шаге со свободным текстом. */
export const MR_SERVICE = [MEETING_BUTTON, SEND, CANCEL, MR_ACCEPT, MR_COUNTER];

/** Ответ на чужое предложение? Такое нажатие приходит вне диалога — его ловит `tg-quiz.ts`. */
export const isMrAnswer = (text: string): boolean => text.trim() === MR_ACCEPT || text.trim() === MR_COUNTER;

/** Результат шага: что ответить и куда переходить. `done` — сценарий закончен, диалог сбросить. */
export type MrResult = { replies: Reply[]; step?: MrStep; state: MrState; done?: boolean };

const ctxDone = (text: string): MrResult => ({ replies: [{ text }], state: emptyMeeting(), done: true });

// ── дата и время ─────────────────────────────────────────────────────────────

const DAYS = 6; // сегодня плюс пять: дальше капитаны не планируют, а кнопок становится экран

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** «сегодня, 28.08» — кнопка и подпись сразу: по ней же ответ и разбирается (день с месяцем). */
function dayLabel(d: Date, offset: number): string {
  const dm = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (offset === 0) return `сегодня, ${dm}`;
  if (offset === 1) return `завтра, ${dm}`;
  return `${d.toLocaleDateString("ru-RU", { weekday: "short" })}, ${dm}`;
}

/** Кнопки дат — по две в ряд: столбец из шести на телефоне занимает весь экран. */
function dateKeyboard(now = new Date()): string[][] {
  const labels: string[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    labels.push(dayLabel(d, i));
  }
  const rows: string[][] = [];
  for (let i = 0; i < labels.length; i += 2) rows.push(labels.slice(i, i + 2));
  rows.push([CANCEL]);
  return rows;
}

/**
 * Дата из ответа: и кнопка («завтра, 29.08»), и набранное руками «29.08» разбираются одним
 * правилом — день с месяцем. Год не спрашиваем: встречи назначают вперёд, поэтому прошедшая дата
 * означает следующий год, а не ошибку.
 */
function parseDate(text: string, now = new Date()): string | null {
  const m = /(\d{1,2})[.\-/](\d{1,2})/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let d = new Date(now.getFullYear(), month - 1, day);
  if (d.getMonth() !== month - 1) return null; // 31.02 — такого дня нет
  if (d < today) d = new Date(now.getFullYear() + 1, month - 1, day);
  return iso(d);
}

function parseTime(text: string): string | null {
  const m = /(\d{1,2})[:.](\d{2})/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Дата и время в момент. Часовой пояс машины — других у нас нет (как и в `tg-schedule.ts`). */
function moment(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

/** Кнопки времени — из настроек оператора (`slots`, Э6), по три в ряд. */
async function timeKeyboard(): Promise<string[][]> {
  const { slots } = await loadBotSettings();
  const rows: string[][] = [];
  for (let i = 0; i < slots.length; i += 3) rows.push(slots.slice(i, i + 3));
  rows.push([CANCEL]);
  return rows;
}

// ── список встреч ────────────────────────────────────────────────────────────

const cut = (s: { stage: string; group: string | null; round: string | null }): string =>
  s.stage === "group" ? `группа ${s.group ?? "—"}` : s.round ?? "плей-офф";

type Option = Awaited<ReturnType<typeof openSeriesFor>>[number] & { label: string };

/**
 * Подписи кнопок — имя соперника. Одноимённых в списке быть не должно: в плей-офф одна и та же
 * пара встречается и в верхней сетке, и в финале, и тогда к имени добавляется стадия.
 */
function labelled(list: Awaited<ReturnType<typeof openSeriesFor>>): Option[] {
  const seen = new Map<string, number>();
  for (const it of list) seen.set(it.opponent.name, (seen.get(it.opponent.name) ?? 0) + 1);
  return list.map((it) => ({
    ...it,
    label: (seen.get(it.opponent.name) ?? 0) > 1 ? `${it.opponent.name} · ${cut(it.series)}` : it.opponent.name,
  }));
}

const seriesReply = (options: Option[]): Reply => ({
  text: [
    "Какую встречу назначаем?",
    "",
    ...options.map(
      (o) =>
        `• <b>${o.label}</b> — ` +
        (o.series.startAt ? `сейчас ${when(o.series.startAt)}` : "время не назначено"),
    ),
  ].join("\n"),
  keyboard: [...options.map((o) => [o.label]), [CANCEL]],
});

const dateReply = (): Reply => ({
  text: "На какой день? Кнопкой или числом — <b>ДД.ММ</b>:",
  keyboard: dateKeyboard(),
});

const timeReply = async (): Promise<Reply> => ({
  text: "Во сколько начинаем? Кнопкой или временем — <b>ЧЧ:ММ</b>:",
  keyboard: await timeKeyboard(),
});

// ── адреса и отправка ────────────────────────────────────────────────────────

/**
 * Написать игрокам. Возвращает, дошло ли хоть до кого-то: у капитана соперника может не быть чата
 * с ботом, и тогда предложение висит без ответа — об этом надо сказать вслух, а не молчать.
 */
async function tellPlayers(playerIds: number[], text: string, keyboard: Keyboard = null): Promise<boolean> {
  if (!botConfigured()) return false;
  const chats = await chatsOfPlayers(playerIds);
  let delivered = false;
  for (const chatId of chats) {
    try {
      await sendTo(chatId, text, keyboard);
      delivered = true;
    } catch (e) {
      console.error(`Не доставлено в чат ${chatId}:`, e);
    }
  }
  return delivered;
}

/** Служебный чат организатора. Его может не быть в окружении — тогда очередь видна только на сайте. */
async function tellAdmins(text: string): Promise<void> {
  if (!telegramConfigured()) return;
  await sendMessage(text).catch((e) => console.error("Не ушло уведомление организатору:", e));
}

/** Как встреча называется в тексте: «Хозяева — Гости» плюс турнир. */
const title = (r: MatchRequestRow): string =>
  `<b>${r.series.home.name}</b> — <b>${r.series.away.name}</b>` +
  (r.series.divisionRef ? ` (${r.series.divisionRef.tournament.name}, ${r.series.divisionRef.name})` : "");

/** Адрес страницы, где организатор подтверждает. Локальный сайт ссылкой не делаем — она не откроется. */
function adminLink(r: MatchRequestRow): string | null {
  const slug = r.series.divisionRef?.tournament.slug;
  if (!slug) return null;
  const url = `${siteUrl()}/admin/series/${slug}`;
  return siteIsLocal() ? url : `<a href="${url}">${url}</a>`;
}

/**
 * Отправить предложение капитану соперника. Текст — настраиваемый (`text_proposal`, Э6):
 * `{команда}` это команда получателя, `{соперник}` — та, что предлагает.
 */
async function sendProposal(requestId: number): Promise<{ delivered: boolean; opponentName: string }> {
  const request = await loadRequest(requestId);
  if (!request) return { delivered: false, opponentName: "соперник" };

  const toTeamId = await opponentTeamId(request);
  // Сторону не вывести — предложившего уже нет в составе. Писать наугад одной из команд хуже, чем
  // не писать вовсе: половина шансов позвать не тех.
  if (toTeamId === null) return { delivered: false, opponentName: "соперник" };
  const toTeam = toTeamId === request.series.homeId ? request.series.home : request.series.away;
  const fromTeam = toTeamId === request.series.homeId ? request.series.away : request.series.home;

  const settings = await loadBotSettings();
  const text = settings.text("text_proposal", {
    команда: toTeam.name,
    соперник: fromTeam.name,
    время: when(request.proposedStartAt),
    турнир: request.series.divisionRef?.tournament.name ?? "",
  });
  const captains = await captainsOf(toTeamId, request.series.divisionId);
  const delivered = await tellPlayers(captains, text, [[MR_ACCEPT], [MR_COUNTER]]);
  return { delivered, opponentName: toTeam.name };
}

// ── диалог капитана ──────────────────────────────────────────────────────────

/**
 * Начать заказ встречи. Отказ объясняем словами: «нельзя» без причины выглядит поломкой, а причин
 * ровно три — нет привязки, не капитан, нечего назначать.
 */
export async function startMeeting(tgId: string | null | undefined, tournamentId?: number): Promise<MrResult> {
  const playerId = await linkedPlayerId(tgId);
  if (!playerId) {
    return ctxDone(
      "Заказывать встречу я даю капитану, заведённому через меня, — так я точно знаю, что это вы. " +
        "Если вы в лиге давно, попросите организатора назначить время.",
    );
  }

  const spots = await captainSpots(playerId, tournamentId);
  if (spots.length === 0) {
    return ctxDone("Встречу заказывает капитан команды. В идущих турнирах капитанского места у вас нет.");
  }

  const options = labelled(await openSeriesFor(spots));
  if (options.length === 0) {
    return ctxDone("Несыгранных встреч у вашей команды сейчас нет — как появится сетка, напишу.");
  }
  return { replies: [seriesReply(options)], step: "mr_series", state: emptyMeeting() };
}

/** Вопрос шага — им же отвечаем на непонятый ответ и на возврат из меню (`askCurrent` в tg-quiz). */
export function askMeeting(step: MrStep, state: MrState): Reply {
  switch (step) {
    case "mr_series":
      // Список встреч — из БД, а ходить за ним ради повтора не стоит: кнопки у человека на экране.
      return { text: "Какую встречу назначаем? Выберите кнопкой из списка выше." };
    case "mr_date":
      return dateReply();
    case "mr_time":
      return { text: "Во сколько начинаем? Кнопкой или временем — <b>ЧЧ:ММ</b>:" };
    default:
      return { text: state.date && state.time ? "Отправляем предложение сопернику?" : "Начнём заново: /cancel" };
  }
}

/** Сводка перед отправкой: человек видит, что уходит сопернику, до того как это ушло. */
async function confirmReply(state: MrState): Promise<Reply> {
  const series = state.seriesId
    ? await prisma.series.findUnique({
        where: { id: state.seriesId },
        include: { home: { select: { name: true } }, away: { select: { name: true } } },
      })
    : null;
  const at = state.date && state.time ? moment(state.date, state.time) : null;
  return {
    text: [
      series ? `<b>${series.home.name}</b> — <b>${series.away.name}</b>` : "Встреча",
      at ? when(at) : "",
      "",
      "Отправляю капитану соперника?",
    ]
      .filter(Boolean)
      .join("\n"),
    keyboard: [[SEND], [CANCEL]],
  };
}

/**
 * Шаг диалога. Возвращает состояние наружу — пишет его вызывающий (`tg-quiz.ts`): строка диалога
 * в `BotSession` общая, и два писателя в неё это две правды о том, где человек стоит.
 */
export async function handleMeeting(
  step: MrStep,
  state: MrState,
  text: string,
  ctx: { chatId: string; tgId: string | null | undefined },
): Promise<MrResult> {
  const answer = text.trim();
  if (answer === CANCEL) return ctxDone("Хорошо, встречу не заказываем.");

  const playerId = await linkedPlayerId(ctx.tgId);
  // Привязку могли снять, пока человек выбирал время: писать от чужого имени нельзя.
  if (!playerId) return ctxDone("Не вижу вашей привязки к профилю — начните заново с /start.");

  if (step === "mr_series") {
    const options = labelled(await openSeriesFor(await captainSpots(playerId)));
    if (options.length === 0) return ctxDone("Несыгранных встреч у вашей команды сейчас нет.");
    const chosen = options.find((o) => o.label.toLowerCase() === answer.toLowerCase());
    if (!chosen) return { replies: [seriesReply(options)], step: "mr_series", state };
    return {
      replies: [{ text: `Встреча с <b>${chosen.opponent.name}</b>.` }, dateReply()],
      step: "mr_date",
      state: { ...state, seriesId: chosen.series.id },
    };
  }

  if (step === "mr_date") {
    const date = parseDate(answer);
    if (!date) return { replies: [{ text: "Не разобрал дату. Кнопкой или числом вида 29.08:" }, dateReply()], step, state };
    return { replies: [await timeReply()], step: "mr_time", state: { ...state, date } };
  }

  if (step === "mr_time") {
    const time = parseTime(answer);
    if (!time) return { replies: [{ text: "Не разобрал время. Кнопкой или вида 20:00:" }, await timeReply()], step, state };
    if (!state.date) return { replies: [dateReply()], step: "mr_date", state };
    // Прошедшее время отбиваем здесь, а не после подтверждения: «сегодня в 12:00» в три часа дня —
    // обычная опечатка, и узнать о ней надо на том же шаге, где её сделали.
    if (moment(state.date, time).getTime() <= Date.now()) {
      return { replies: [{ text: "Это время уже прошло — выберите другой день." }, dateReply()], step: "mr_date", state };
    }
    const next = { ...state, time };
    return { replies: [await confirmReply(next)], step: "mr_confirm", state: next };
  }

  // mr_confirm
  if (answer !== SEND) return { replies: [await confirmReply(state)], step, state };
  if (!state.seriesId || !state.date || !state.time) return ctxDone("Что-то потерялось по дороге — начнём заново.");

  const created = await createProposal({
    seriesId: state.seriesId,
    playerId,
    startAt: moment(state.date, state.time),
    parentId: state.parentId,
  });
  if ("error" in created) return ctxDone(created.error);

  // Исходное предложение закрываем **здесь**, а не когда нажали «Предложить другое»: брошенный на
  // полпути диалог не должен молча убивать то, на что капитан ещё может ответить «принять».
  if (state.parentId) await declineProposal(state.parentId, "предложено другое время");

  const { delivered, opponentName } = await sendProposal(created.id);
  return {
    replies: [
      {
        text: delivered
          ? `Отправил капитану <b>${opponentName}</b>. Ответит — напишу; после этого время подтверждает организатор.`
          : `Записал, но капитану <b>${opponentName}</b> написать не могу — он не писал мне, а по хендлу Telegram ` +
            `писать не даёт. Свяжитесь с ним сами или скажите организатору: предложение он уже видит.`,
      },
    ],
    state: emptyMeeting(),
    done: true,
  };
}

// ── ответ капитана соперника ─────────────────────────────────────────────────

/**
 * «Принять время» / «Предложить другое» — нажатие прилетает без диалога: клавиатуру поставило само
 * уведомление. Ищем последнее живое предложение, адресованное этому капитану; их может быть
 * несколько (две встречи разом), и отвечает он на свежее — то, кнопки которого у него на экране.
 */
export async function answerProposal(text: string, ctx: { tgId: string | null | undefined }): Promise<MrResult> {
  const playerId = await linkedPlayerId(ctx.tgId);
  if (!playerId) return ctxDone("Не вижу вашей привязки к профилю — начните заново с /start.");

  const pending = await proposalsForCaptain(playerId);
  const request = pending[0];
  if (!request) return ctxDone("Открытых предложений о встрече у вас нет.");

  if (text.trim() === MR_COUNTER) {
    // Встречное предложение — тот же диалог, но встреча уже известна: спрашивать «какую встречу»
    // второй раз незачем.
    return {
      replies: [{ text: `Тогда своё время для встречи ${title(request)}.` }, dateReply()],
      step: "mr_date",
      state: { ...emptyMeeting(), seriesId: request.seriesId, parentId: request.id },
    };
  }

  await acceptProposal(request.id);

  const fromTeamId = await proposerTeamId(request);
  if (fromTeamId !== null) {
    const toTeam = fromTeamId === request.series.homeId ? request.series.away : request.series.home;
    await tellPlayers(
      await captainsOf(fromTeamId, request.series.divisionId),
      `<b>${toTeam.name}</b> принял время: ${title(request)}, ${when(request.proposedStartAt)}. ` +
        `Осталось подтверждение организатора — как подтвердит, напишу всем.`,
    );
  }
  const link = adminLink(request);
  await tellAdmins(
    [
      `Капитаны договорились: ${title(request)} — ${when(request.proposedStartAt)}.`,
      link ? `Подтвердить: ${link}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return ctxDone(
    `Принято: ${title(request)}, ${when(request.proposedStartAt)}. ` +
      `Осталось подтверждение организатора — как подтвердит, напишу.`,
  );
}

// ── решение организатора ─────────────────────────────────────────────────────

/**
 * Подтвердить время. Рассылку делает `announceReschedule`: он один знает, «назначили» это или
 * «перенесли», и он же сбрасывает отметки напоминаний. Отдельного «организатор подтвердил» капитану
 * не шлём — он игрок того же состава и получит общий пуш.
 */
export async function approveMeeting(id: number): Promise<{ error?: string }> {
  const result = await approveProposal(id);
  if ("error" in result) return result;
  await announceReschedule(result.seriesId, result.before);
  return {};
}

/** Отклонить время с причиной. Причина обязательна: без неё капитанам нечего исправлять. */
export async function declineMeeting(id: number, reason: string): Promise<{ error?: string }> {
  const request = await loadRequest(id);
  if (!request) return { error: "Предложения больше нет." };
  if (request.status !== "pending_admin") return { error: "Предложение уже не ждёт подтверждения." };

  await declineProposal(id, reason, true);

  // Пишем обоим капитанам: время согласовывали двое, и отказ касается обоих.
  const captains = [
    ...(await captainsOf(request.series.homeId, request.series.divisionId)),
    ...(await captainsOf(request.series.awayId, request.series.divisionId)),
  ];
  await tellPlayers(
    [...new Set(captains)],
    `Организатор не подтвердил время: ${title(request)}, ${when(request.proposedStartAt)}.\n` +
      `Причина: ${reason}\n\nПредложите другое — «${MEETING_BUTTON}».`,
  );
  return {};
}
