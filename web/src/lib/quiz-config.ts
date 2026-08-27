// Вопросы телеграм-бота: дефолтные формулировки и правки оператора. Чистая часть (реестр шагов,
// подстановка) отделена от БД — по реестру рисуется экран /admin/bot, им же спрашивает бот.
//
// **Дефолт живёт в коде, а не в базе.** В `BotQuestion` попадают только отличия: так пустая база
// (новая машина, сброшенный dev.db) означает бота с обычными вопросами, а не бота без вопросов.
// Оператор правит формулировки, отключает необязательные шаги и добавляет свои вопросы — но не
// меняет порядок и состав обязательных: ник, позиция и ссылка диктуются моделью заявки, без них
// оператору нечего одобрять.
//
// Подстановка — простыми фигурными скобками: `{ник}`, `{команда}`, `{турнир}`, `{дивизион}`,
// `{осталось}`, `{n}`. Незнакомая скобка остаётся текстом: опечатка оператора не должна ронять диалог.

import { prisma } from "./prisma";

/** Шаг с настраиваемым текстом. Ключ хранится в `BotQuestion.key` и в коде квиза. */
export type QuizKey =
  | "menu"
  | "hello"
  | "closed"
  | "tournament"
  | "division"
  | "team_name"
  | "team_tag"
  | "nick_first"
  | "nick_next"
  | "role"
  | "link"
  | "telegram"
  | "need_more"
  | "more"
  | "captain"
  | "confirm"
  | "done";

type Slot = {
  key: QuizKey;
  /** Подпись шага на экране редактирования. */
  label: string;
  /** Чем шаг занят — оператору, который правит формулировку. */
  hint: string;
  text: string;
  /** Можно ли не спрашивать. Обязательные шаги выключателя не имеют. */
  optional?: boolean;
  /** Какие подстановки осмысленны здесь — показываем рядом с полем. */
  vars?: string[];
};

/** Реестр шагов в порядке диалога — им же рисуется экран /admin/bot. */
export const QUIZ_SLOTS: Slot[] = [
  {
    key: "menu",
    label: "Главное меню",
    hint: "Первое сообщение на /start: что бот умеет",
    text:
      "Бот лиги LOST. «Личный профиль» — ваша анкета, вход на сайт и правки; «Турниры» — сезоны, ваш " +
      "состав, команды соперников и подача заявки.\n" +
      "Выберите кнопкой ниже.",
  },
  {
    key: "hello",
    label: "Приветствие",
    hint: "Первое сообщение, когда начинается заявка",
    text: "Заявка команды в лигу LOST. Отвечайте по одному сообщению; отменить — /cancel.",
  },
  {
    key: "closed",
    label: "Приём закрыт",
    hint: "Ответ, когда ни один турнир не принимает заявки",
    text: "Сейчас приём заявок закрыт. Как откроется — возвращайтесь; что идёт сейчас, видно в «Турниры».",
  },
  {
    key: "tournament",
    label: "Выбор турнира",
    hint: "Спрашивается, только если открытых турниров больше одного",
    text: "На какой <b>турнир</b> заявляетесь?",
  },
  {
    key: "division",
    label: "Выбор дивизиона",
    hint: "Спрашивается, только если у турнира больше одного дивизиона. Выключить — оператор поставит сам",
    text: "В каком <b>дивизионе</b> хотите играть? Финальное слово за организатором.",
    optional: true,
  },
  { key: "team_name", label: "Название команды", hint: "", text: "<b>Название команды</b>:" },
  {
    key: "team_tag",
    label: "Тег команды",
    hint: "Короткая подпись для таблицы",
    text: "<b>Тег команды</b> — 2–5 символов для таблицы, например LST. Нет — пропустите.",
    optional: true,
  },
  {
    key: "nick_first",
    label: "Ник первого игрока",
    hint: "С него начинается состав",
    text: "Состав. Начнём с капитана.\n\n<b>Ник 1-го игрока</b> — как он пишется в лиге:",
  },
  { key: "nick_next", label: "Ник следующего игрока", hint: "", text: "<b>Ник {n}-го игрока</b>:", vars: ["{n}"] },
  { key: "role", label: "Позиция игрока", hint: "Ответ — кнопкой, «Мид», «Mid» или «2»", text: "Позиция игрока <b>{ник}</b>:", vars: ["{ник}"] },
  {
    key: "link",
    label: "Ссылка на профиль",
    hint: "Обязательна: без account_id игрок не находится в матчах",
    text:
      "<b>Ссылка на профиль {ник}</b> — Dotabuff, Stratz или Steam.\n" +
      "По ней организатор находит игрока в матчах, поэтому она обязательна.\n" +
      "Например: https://www.dotabuff.com/players/123456",
    vars: ["{ник}"],
  },
  {
    key: "telegram",
    label: "Телеграм игрока",
    hint: "Контакт для связи. Выключить — бот не будет спрашивать ни у кого",
    text: "<b>Телеграм {ник}</b> — хендл вида @nickname. Нет или не знаете — пропустите.",
    optional: true,
    vars: ["{ник}"],
  },
  {
    key: "need_more",
    label: "Состав ещё не полон",
    hint: "Ответ, пока в составе меньше пяти игроков",
    text: "Записал. Осталось игроков до полного состава: {осталось}.",
    vars: ["{осталось}"],
  },
  {
    key: "more",
    label: "Добавить ещё игрока",
    hint: "Спрашивается, когда основа собрана",
    text: "Записал. В составе {n} — добавить ещё (замена, тренер) или закончить?",
    vars: ["{n}"],
  },
  {
    key: "captain",
    label: "Кто капитан",
    hint: "",
    text: "Кто <b>капитан</b>? С ним организатор будет решать вопросы по команде.",
  },
  { key: "confirm", label: "Перед отправкой", hint: "Строка под сводкой состава", text: "Всё верно?" },
  {
    key: "done",
    label: "Заявка отправлена",
    hint: "Последнее сообщение диалога",
    text:
      "Заявка отправлена — она у организатора на проверке. Как проверят, с капитаном свяжутся в телеграме.\n\n" +
      "Посмотреть, что с ней, — «Турниры» → ваш турнир → «Моя команда». Поправить состав — подайте заявку заново.",
  },
];

const SLOT = new Map(QUIZ_SLOTS.map((s) => [s.key, s]));

export const isQuizKey = (v: string): v is QuizKey => SLOT.has(v as QuizKey);

/** Свой вопрос оператора. Задаётся после состава, ответ едет в заявку отдельным блоком. */
export type CustomQuestion = {
  key: string;
  text: string;
  /** Варианты ответа кнопками; пусто — свободный ответ. */
  options: string[];
  enabled: boolean;
  orderNo: number;
};

export type QuizConfig = {
  /** Текст шага с уже подставленными значениями. */
  text: (key: QuizKey, vars?: Record<string, string | number>) => string;
  /** Спрашивать ли шаг. Обязательные — всегда да. */
  enabled: (key: QuizKey) => boolean;
  /** Включённые свои вопросы, в порядке оператора. */
  custom: CustomQuestion[];
};

/** Подстановка `{имя}`. Незнакомую скобку оставляем как есть — это опечатка, а не повод падать. */
export const fill = (text: string, vars: Record<string, string | number> = {}): string =>
  text.replace(/\{([^}]+)\}/g, (whole, name: string) => {
    const value = vars[name.trim()];
    return value === undefined ? whole : String(value);
  });

const parseOptions = (raw: string | null): string[] =>
  (raw ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Конфигурация бота: дефолты из реестра, поверх — правки оператора. Читается на каждое сообщение
 * (десяток строк из sqlite), чтобы правка в админке действовала сразу: бот — долгоживущий процесс,
 * и просить оператора перезапустить его после каждой запятой значит не дать ему править вовсе.
 */
export async function loadQuiz(): Promise<QuizConfig> {
  const rows = await prisma.botQuestion.findMany({ orderBy: { orderNo: "asc" } });
  const edits = new Map(rows.filter((r) => !r.custom).map((r) => [r.key, r]));

  return {
    text: (key, vars) => fill(edits.get(key)?.text ?? SLOT.get(key)!.text, vars),
    enabled: (key) => (SLOT.get(key)?.optional ? (edits.get(key)?.enabled ?? true) : true),
    custom: rows
      .filter((r) => r.custom && r.enabled)
      .map((r) => ({ key: r.key, text: r.text, options: parseOptions(r.options), enabled: true, orderNo: r.orderNo })),
  };
}

/** Конфигурация для экрана правки: тут нужны и выключенные свои вопросы, и сырые тексты. */
export async function loadQuizForEditor() {
  const rows = await prisma.botQuestion.findMany({ orderBy: { orderNo: "asc" } });
  const edits = new Map(rows.filter((r) => !r.custom).map((r) => [r.key, r]));
  return {
    slots: QUIZ_SLOTS.map((s) => ({
      ...s,
      /** Текст оператора либо дефолт — форма показывает то, что реально скажет бот. */
      value: edits.get(s.key)?.text ?? s.text,
      /** Отличается ли от дефолта: по этому признаку рисуется «вернуть исходный». */
      edited: edits.has(s.key) && edits.get(s.key)!.text !== s.text,
      enabled: s.optional ? (edits.get(s.key)?.enabled ?? true) : true,
    })),
    custom: rows
      .filter((r) => r.custom)
      .map(
        (r): CustomQuestion => ({ key: r.key, text: r.text, options: parseOptions(r.options), enabled: r.enabled, orderNo: r.orderNo }),
      ),
  };
}

export type QuizEditor = Awaited<ReturnType<typeof loadQuizForEditor>>;
