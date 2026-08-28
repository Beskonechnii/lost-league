// Только сервер / скрипт: исходящие уведомления о встречах — напоминания, переносы и дайджест
// встреч без назначенного времени.
//
// **Кто тикает.** Тот же процесс, что крутит бота (`scripts/bot.ts`): раз в минуту зовётся
// `tickSchedule()`. Отдельного планировщика нет — пока бот живёт одним процессом, второй демон
// значил бы вторую вещь, которую надо не забыть запустить.
//
// **Написать можно лишь тому, кто сам писал боту.** Адрес человека — привязка `UserAccount.tgId`
// (Э1) либо, запасным ходом, его хендл в `TgChat`; кого не знаем, того молча пропускаем — ровно
// как в `tg-notify.ts`. Отправка не должна ронять тик: упавший телеграм это строка в консоли, а не
// остановленные напоминания всем остальным.
//
// **Повтор страшнее пропуска.** Бота перезапускают с ноутбука по нескольку раз в день, и без
// следа отправки каждый запуск слал бы то же самое заново. След — `SeriesNotice`, отметка
// ставится **до** рассылки: упавшая на середине рассылка не должна начинаться с начала на
// следующем тике.
//
// Тайминги и тексты сюда не зашиты — они у оператора в /admin/bot (`bot-settings.ts`).

import { prisma } from "./prisma";
import { botConfigured, sendMessage, sendTo, telegramConfigured } from "./telegram";
import { normalizeTelegram } from "./profiles";
import { loadBotSettings, type BotSettings } from "./bot-settings";

/** Повод уведомления — он же `SeriesNotice.kind`. */
type Kind = "remind" | "moved" | "scheduled" | "no_time";

// ── адреса ───────────────────────────────────────────────────────────────────

/**
 * Чаты игроков: сперва по привязке аккаунта (это точно тот самый человек), затем запасным ходом
 * по хендлу из ростера — у части лиги привязки ещё нет, а боту они когда-то писали.
 *
 * Хендлы сравниваем в памяти: sqlite через Prisma не умеет `mode: "insensitive"`, а знакомых чатов
 * у бота столько же, сколько людей в лиге.
 */
async function chatsOfPlayers(playerIds: number[]): Promise<string[]> {
  if (playerIds.length === 0) return [];
  const chats = new Set<string>();

  const accounts = await prisma.userAccount.findMany({
    where: { playerId: { in: playerIds } },
    select: { id: true },
  });
  if (accounts.length) {
    const bound = await prisma.tgChat.findMany({ where: { accountId: { in: accounts.map((a) => a.id) } } });
    for (const c of bound) chats.add(c.chatId);
  }

  const handles = (await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { telegram: true } }))
    .map((p) => normalizeTelegram(p.telegram ?? ""))
    .filter((h): h is string => !!h)
    .map((h) => h.toLowerCase());
  if (handles.length) {
    const known = await prisma.tgChat.findMany({ where: { username: { not: null } } });
    for (const c of known) if (handles.includes(c.username!.toLowerCase())) chats.add(c.chatId);
  }

  return [...chats];
}

// ── встреча ──────────────────────────────────────────────────────────────────

const seriesInclude = {
  home: { select: { id: true, name: true } },
  away: { select: { id: true, name: true } },
  divisionRef: { select: { tournament: { select: { name: true, status: true } } } },
} as const;

const loadSeries = (id: number) => prisma.series.findUnique({ where: { id }, include: seriesInclude });

/** Встреча с тем, что нужно тексту уведомления: обе команды и турнир. */
type NoticeSeries = NonNullable<Awaited<ReturnType<typeof loadSeries>>>;

/** «28 августа в 20:00» — так это сказал бы человек; часовой пояс берём машины, других у нас нет. */
const when = (d: Date): string =>
  `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в ` +
  d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/**
 * Отметить уведомление отправленным. Отметка и есть захват: уникальный индекс
 * `[seriesId, kind, mark]` не даст записать её дважды, поэтому «уже слали» и «занято прямо сейчас» —
 * один и тот же ответ `false`, и второй рассылки не будет.
 */
async function claim(seriesId: number, kind: Kind, mark: string): Promise<boolean> {
  try {
    await prisma.seriesNotice.create({ data: { seriesId, kind, mark } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Разослать текст обеим командам встречи. Каждой стороне — свой текст: `{команда}` это команда
 * получателя, `{соперник}` — вторая, поэтому одно и то же уведомление читается одинаково с обеих
 * сторон.
 *
 * `remind_targets` решает, всем игрокам или только капитанам. Состав берём из дивизиона встречи:
 * состав команды меняется от сезона к сезону, и без дивизиона в рассылку попал бы прошлогодний.
 * У старых серий дивизиона нет вовсе — там берём весь состав команды, иначе адресатов не будет.
 */
async function tellBothSides(
  series: NoticeSeries,
  settings: BotSettings,
  text: (vars: Record<string, string>) => string,
): Promise<void> {
  const tournament = series.divisionRef?.tournament?.name ?? "";
  const time = series.startAt ? when(series.startAt) : "";

  for (const [team, opponent] of [
    [series.home, series.away],
    [series.away, series.home],
  ] as const) {
    const spots = await prisma.rosterSpot.findMany({
      where: {
        teamId: team.id,
        divisionId: series.divisionId ?? undefined,
        ...(settings.remindTargets === "captains" ? { isCaptain: true } : {}),
      },
      select: { playerId: true },
    });
    const body = text({ команда: team.name, соперник: opponent.name, время: time, турнир: tournament });
    for (const chatId of await chatsOfPlayers(spots.map((s) => s.playerId))) {
      await sendTo(chatId, body).catch((e) => console.error(`Не доставлено в чат ${chatId}:`, e));
    }
  }
}

// ── напоминания ──────────────────────────────────────────────────────────────

/**
 * За какой интервал напоминаем прямо сейчас. Интервалы идут по убыванию, поэтому подходящим
 * оказывается последний: до встречи 30 минут — это band 1h, а не 24h.
 *
 * Так же лечится и простой бота: пока он лежал сутки, окно «за сутки» прошло — и при запуске
 * уходит только актуальное напоминание, а не оба разом.
 */
function band(minutesLeft: number, intervals: number[]): number | null {
  let found: number | null = null;
  for (const m of intervals) if (minutesLeft <= m) found = m;
  return found;
}

/** Напоминания о ближайших встречах. Сыгранные и те, что уже начались, не трогаем. */
async function remindDue(now: Date, settings: BotSettings): Promise<void> {
  const intervals = settings.remindBefore;
  if (intervals.length === 0) return;

  const horizon = new Date(now.getTime() + intervals[0] * 60_000);
  const rows = await prisma.series.findMany({
    where: { playedAt: null, startAt: { gt: now, lte: horizon } },
    include: seriesInclude,
  });

  for (const series of rows) {
    const minutesLeft = (series.startAt!.getTime() - now.getTime()) / 60_000;
    const interval = band(minutesLeft, intervals);
    if (interval === null) continue;
    if (!(await claim(series.id, "remind", String(interval)))) continue;
    await tellBothSides(series, settings, (vars) => settings.text("text_remind", vars));
  }
}

// ── перенос и назначение ─────────────────────────────────────────────────────

/**
 * Время встречи изменилось — сказать об этом игрокам. Единственный вход: и правка времени в
 * `/admin/series`, и (позже) апрув запроса встречи от капитана зовут её, а не рассылают сами.
 *
 * Рассылаем **после** решения организатора, а не по факту записи: время встречи до апрува это
 * предложение, и оповещать о нём обе команды значит рассылать шум.
 *
 * `before` пусто — встречу назначили впервые (это не перенос, и «было» сказать нечего), поэтому
 * текст другой. Время сняли совсем — молчим: сказать нечего, а «встреча теперь без времени»
 * игроку бесполезно.
 */
export async function announceReschedule(seriesId: number, before: Date | null): Promise<void> {
  if (!botConfigured()) return;
  try {
    const series = await loadSeries(seriesId);
    if (!series?.startAt) return;
    if (before && before.getTime() === series.startAt.getTime()) return; // время не изменилось

    // Напоминания считаются от времени встречи: после переноса прежние отметки бессмысленны —
    // без сброса напоминание «за сутки» второй раз уже не ушло бы.
    await prisma.seriesNotice.deleteMany({ where: { seriesId, kind: "remind" } });

    const kind: Kind = before ? "moved" : "scheduled";
    if (!(await claim(seriesId, kind, series.startAt.toISOString()))) return;

    const settings = await loadBotSettings();
    await tellBothSides(series, settings, (vars) =>
      settings.text(before ? "text_moved" : "text_scheduled", { ...vars, было: when(before ?? series.startAt!) }),
    );
  } catch (e) {
    console.error("Не удалось разослать перенос встречи:", e);
  }
}

// ── дайджест встреч без времени ──────────────────────────────────────────────

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Раз в сутки — список несыгранных встреч идущих турниров, которым не назначено время. Уходит в
 * служебный чат (`TG_CHAT_ID`), а не игрокам: это работа организатора, а не их.
 *
 * Условие «время дайджеста уже наступило», а не «наступило ровно сейчас»: тик минутный, и один
 * пропущенный тик (перезапуск, лаг сети) стоил бы дайджеста за целые сутки. От повтора защищает не
 * условие, а отметка `no_time` с датой — по одной на каждую перечисленную встречу.
 */
async function noTimeDigest(now: Date, settings: BotSettings): Promise<void> {
  // Служебного чата в окружении может не быть (`TG_CHAT_ID` не обязателен — без него живёт весь
  // входящий поток). Проверяем до отметок: иначе дайджест «отправлялся» бы в никуда и сгорал на
  // сутки вперёд.
  if (!telegramConfigured()) return;
  if (now.getHours() * 60 + now.getMinutes() < settings.digestAt) return;

  const rows = await prisma.series.findMany({
    where: { playedAt: null, startAt: null, divisionRef: { tournament: { status: "running" } } },
    include: { ...seriesInclude, divisionRef: { select: { name: true, tournament: { select: { name: true } } } } },
    orderBy: { id: "asc" },
  });
  if (rows.length === 0) return;

  const today = dayKey(now);
  const fresh = [];
  for (const s of rows) if (await claim(s.id, "no_time", today)) fresh.push(s);
  if (fresh.length === 0) return; // за сегодня уже слали

  const lines = rows.map(
    (s) =>
      `• <b>${s.home.name}</b> — <b>${s.away.name}</b>` +
      (s.divisionRef ? ` (${s.divisionRef.tournament.name}, ${s.divisionRef.name})` : ""),
  );
  try {
    await sendMessage([`Встречи без назначенного времени — ${rows.length}:`, ...lines].join("\n"));
  } catch (e) {
    // Дайджест — одно сообщение в один чат: не ушло значит не ушло никому, и отметки надо снять,
    // иначе моргнувшая сеть съедала бы напоминание организатору на целые сутки. У рассылки игрокам
    // так нельзя — там доставка частичная, и откат отметки означал бы второе письмо половине.
    await prisma.seriesNotice.deleteMany({
      where: { kind: "no_time", mark: today, seriesId: { in: fresh.map((s) => s.id) } },
    });
    console.error("Не ушёл дайджест встреч без времени:", e);
  }
}

// ── тик ──────────────────────────────────────────────────────────────────────

/**
 * Один тик расписания: напоминания и, если пора, дайджест. Зовётся раз в минуту из `scripts/bot.ts`.
 * Обе половины ловят свою ошибку по отдельности — упавший дайджест не должен уносить с собой
 * напоминания.
 */
export async function tickSchedule(now: Date = new Date()): Promise<void> {
  if (!botConfigured()) return;
  let settings: BotSettings;
  try {
    settings = await loadBotSettings();
  } catch (e) {
    console.error("Не прочитал настройки бота:", e);
    return;
  }
  await remindDue(now, settings).catch((e) => console.error("Напоминания о встречах:", e));
  await noTimeDigest(now, settings).catch((e) => console.error("Дайджест встреч без времени:", e));
}
