// Настройки флоу бота: тайминги напоминаний и тексты уведомлений о встречах. Устроено ровно как
// вопросы квиза (`quiz-config.ts` / `BotQuestion`): реестр с дефолтами живёт в коде, в таблице
// `BotSetting` лежат только отличия оператора. Сброшенная база означает бота с обычными
// настройками, а не бота без таймингов.
//
// Почему настройка — строка, а не колонка на каждую: реестр здесь и рисует экран, и проверяет
// ввод, поэтому новая настройка стоит одной записи в массиве, а не миграции. Разбор строки
// (`24h,1h` → минуты) делается при чтении, а оператор правит ровно то, что видит.
//
// Читается на каждое обращение — правка в админке действует без перезапуска бота: он живёт
// долгоживущим процессом, и просить перезапуск после каждой запятой значит не дать править вовсе.

import { prisma } from "./prisma";
import { fill } from "./quiz-config";

/** Ключ настройки. Он же лежит в `BotSetting.key`. */
export type BotSettingKey =
  | "remind_before"
  | "remind_targets"
  | "no_time_digest_at"
  | "slots"
  | "text_remind"
  | "text_moved"
  | "text_scheduled"
  | "text_proposal";

/**
 * Чем настройка является — от этого зависят и разбор, и вид поля на экране:
 * `durations` — список интервалов (`24h,1h`), `time` — время суток (`10:00`),
 * `times` — список времён, `choice` — выбор из вариантов, `text` — текст уведомления.
 */
type Kind = "durations" | "time" | "times" | "choice" | "text";

type Field = {
  key: BotSettingKey;
  /** Подпись на экране правки. */
  label: string;
  /** Чем настройка занята — оператору. */
  hint: string;
  kind: Kind;
  /** Значение по умолчанию, сырой строкой — ровно в том виде, в каком его правит оператор. */
  value: string;
  /** Варианты у `choice`. */
  options?: { value: string; label: string }[];
  /** Какие подстановки осмысленны в тексте — показываем рядом с полем. */
  vars?: string[];
};

/**
 * Подстановки в текстах уведомлений едины по смыслу: `{команда}` — команда получателя,
 * `{соперник}` — вторая команда встречи. Так один и тот же текст читается одинаково с обеих сторон.
 */
const MATCH_VARS = ["{команда}", "{соперник}", "{время}", "{турнир}"];

/** Реестр настроек в порядке экрана. Им же рисуется вкладка «Настройки» на /admin/bot. */
export const BOT_SETTINGS: Field[] = [
  {
    key: "remind_before",
    label: "За сколько напоминать",
    hint: "Через запятую, от большего к меньшему: 24h — за сутки, 1h — за час, 30m — за полчаса",
    kind: "durations",
    value: "24h,1h",
  },
  {
    key: "remind_targets",
    label: "Кому напоминать",
    hint: "Всем игрокам обеих команд или только капитанам",
    kind: "choice",
    value: "all",
    options: [
      { value: "all", label: "всем игрокам" },
      { value: "captains", label: "только капитанам" },
    ],
  },
  {
    key: "no_time_digest_at",
    label: "Дайджест встреч без времени",
    hint: "Во сколько раз в сутки присылать в служебный чат список несыгранных встреч без назначенного времени",
    kind: "time",
    value: "10:00",
  },
  {
    key: "slots",
    label: "Предлагаемые времена начала",
    hint: "Кнопки, из которых капитан выбирает время встречи. Через запятую",
    kind: "times",
    value: "18:00,19:00,20:00,21:00,22:00",
  },
  {
    key: "text_remind",
    label: "Напоминание о встрече",
    hint: "Уходит игрокам обеих команд за каждый интервал из «за сколько напоминать»",
    kind: "text",
    value: "Напоминание: <b>{команда}</b> — <b>{соперник}</b>, {время}. Турнир: {турнир}.",
    vars: MATCH_VARS,
  },
  {
    key: "text_moved",
    label: "Перенос встречи",
    hint: "Уходит после того, как перенос подтвердил организатор. {было} — прежнее время, {время} — новое",
    kind: "text",
    value: "Встреча <b>{команда}</b> — <b>{соперник}</b> перенесена: было {было}, стало {время}. Турнир: {турнир}.",
    vars: [...MATCH_VARS, "{было}"],
  },
  {
    key: "text_scheduled",
    label: "Встреча назначена",
    hint: "Уходит обеим командам, когда организатор подтвердил время",
    kind: "text",
    value: "Назначена встреча: <b>{команда}</b> — <b>{соперник}</b>, {время}. Турнир: {турнир}.",
    vars: MATCH_VARS,
  },
  {
    key: "text_proposal",
    label: "Предложение соперника",
    hint: "Уходит капитану команды, которой предложили время. {команда} — его команда, {соперник} — кто предложил",
    kind: "text",
    value:
      "<b>{соперник}</b> предлагает сыграть встречу с <b>{команда}</b> {время}. Турнир: {турнир}.\n" +
      "Ответьте кнопкой ниже: принять или предложить другое время.",
    vars: MATCH_VARS,
  },
];

const FIELD = new Map(BOT_SETTINGS.map((f) => [f.key, f]));

export const isBotSettingKey = (v: string): v is BotSettingKey => FIELD.has(v as BotSettingKey);

// --- разбор значений -------------------------------------------------------

/** `30m` / `2h` / `1d` → минуты. Мусор и ноль — null: интервал «за 0 минут» напоминанием не является. */
function parseDuration(raw: string): number | null {
  const m = /^(\d{1,4})\s*([mhdмчд])$/i.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const minutes = unit === "m" || unit === "м" ? n : unit === "h" || unit === "ч" ? n * 60 : n * 1440;
  return minutes > 0 ? minutes : null;
}

/** Минуты обратно в короткую запись — чтобы сохранённое выглядело как написанное человеком. */
function showDuration(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

/** `9:5` не время, `09:05` — время. Возвращаем минуты от полуночи. */
function parseTime(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const showTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const items = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Список интервалов из сырого значения, в минутах, по убыванию. Битые токены молча пропускаем. */
const durationList = (raw: string): number[] =>
  [...new Set(items(raw).map(parseDuration).filter((n): n is number => n !== null))].sort((a, b) => b - a);

/** Список времён «HH:MM», по возрастанию. */
const timeList = (raw: string): string[] =>
  [...new Set(items(raw).map(parseTime).filter((n): n is number => n !== null))].sort((a, b) => a - b).map(showTime);

/**
 * Проверка и нормализация того, что ввёл оператор. Возвращает либо готовое к записи значение,
 * либо человеческую причину отказа: молча чинить ввод нельзя — оператор должен видеть, что «25:00»
 * это не время, а не гадать, почему напоминания уходят не тогда.
 */
export function normalizeSetting(key: BotSettingKey, raw: string): { value: string } | { error: string } {
  const field = FIELD.get(key)!;
  const trimmed = raw.trim();

  switch (field.kind) {
    case "text":
      if (!trimmed) return { error: "Текст пустой — боту нечего отправить" };
      return { value: trimmed };
    case "choice":
      if (!field.options!.some((o) => o.value === trimmed)) return { error: "Неизвестный вариант" };
      return { value: trimmed };
    case "time": {
      const t = parseTime(trimmed);
      if (t === null) return { error: "Время задаётся как 10:00" };
      return { value: showTime(t) };
    }
    case "times": {
      const bad = items(trimmed).find((s) => parseTime(s) === null);
      if (bad) return { error: `Не время: ${bad}. Нужен вид 18:00, через запятую` };
      const list = timeList(trimmed);
      if (!list.length) return { error: "Нужно хотя бы одно время" };
      return { value: list.join(",") };
    }
    case "durations": {
      const bad = items(trimmed).find((s) => parseDuration(s) === null);
      if (bad) return { error: `Не интервал: ${bad}. Нужен вид 24h, 1h или 30m, через запятую` };
      const list = durationList(trimmed);
      if (!list.length) return { error: "Нужен хотя бы один интервал" };
      return { value: list.map(showDuration).join(",") };
    }
  }
}

// --- чтение ----------------------------------------------------------------

export type BotSettings = {
  /** Сырое значение настройки — оператора либо дефолт. */
  raw: (key: BotSettingKey) => string;
  /** За сколько минут до встречи напоминать, по убыванию. */
  remindBefore: number[];
  /** Кому уходят напоминания. */
  remindTargets: "all" | "captains";
  /** Когда слать дайджест встреч без времени — минуты от полуночи. */
  digestAt: number;
  /** Предлагаемые времена начала, «HH:MM», по возрастанию. */
  slots: string[];
  /** Текст уведомления с уже подставленными значениями. */
  text: (key: BotSettingKey, vars?: Record<string, string | number>) => string;
};

/**
 * Настройки бота: дефолты из реестра, поверх — правки оператора. Зовётся на каждую рассылку
 * (восемь строк из sqlite), чтобы правка действовала сразу.
 */
export async function loadBotSettings(): Promise<BotSettings> {
  const rows = await prisma.botSetting.findMany();
  const edits = new Map(rows.filter((r) => isBotSettingKey(r.key)).map((r) => [r.key, r.value]));
  const raw = (key: BotSettingKey) => edits.get(key) ?? FIELD.get(key)!.value;

  return {
    raw,
    remindBefore: durationList(raw("remind_before")),
    remindTargets: raw("remind_targets") === "captains" ? "captains" : "all",
    // Битое значение в базе не должно останавливать дайджест — падаем на дефолт реестра.
    digestAt: parseTime(raw("no_time_digest_at")) ?? parseTime(FIELD.get("no_time_digest_at")!.value)!,
    slots: timeList(raw("slots")),
    text: (key, vars) => fill(raw(key), vars),
  };
}

/** Настройки для экрана правки: тут нужны сырые значения и признак «отличается от дефолта». */
export async function loadBotSettingsForEditor() {
  const rows = await prisma.botSetting.findMany();
  const edits = new Map(rows.map((r) => [r.key, r.value]));
  return BOT_SETTINGS.map((f) => ({
    ...f,
    /** Значение оператора либо дефолт — форма показывает то, чем бот пользуется на самом деле. */
    current: edits.get(f.key) ?? f.value,
    /** По этому признаку рисуется «изменено» и кнопка возврата к исходному. */
    edited: edits.has(f.key) && edits.get(f.key) !== f.value,
  }));
}

export type BotSettingsEditor = Awaited<ReturnType<typeof loadBotSettingsForEditor>>;
