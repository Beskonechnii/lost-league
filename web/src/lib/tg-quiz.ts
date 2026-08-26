// Только сервер / скрипт: квиз заявки команды в телеграм-боте. Бот ведёт капитана по вопросам и
// кладёт готовый состав в ту же очередь `TeamApplication`, что и форма на сайте (`source = telegram`).
// Апдейты приносит `scripts/bot.ts` (long polling), сеть — `src/lib/telegram.ts`.
//
// Почему квиз по одному вопросу, а не «пришлите состав текстом»: разбор свободного текста у нас уже
// есть (`roster-import.ts`), но на входе от незнакомого человека он ошибается молча — оператор
// получает заявку с пустыми позициями и чужой ссылкой. Пошаговый вопрос проверяет ответ на месте,
// пока капитан ещё в диалоге и может поправить.
//
// **Ссылка на профиль обязательна у каждого игрока**: без account_id человек не находится ни в
// одном матче, а просить её потом перепиской — та же работа, что вернуть заявку.

import { prisma } from "./prisma";
import { sendTo, type Keyboard } from "./telegram";
import { submitTelegramApplication } from "./team-application";
import { emptyPlayer, type TeamDraft, type PlayerDraft } from "./roster-import";
import { profileLinkProblem } from "./application";
import { ROLES, type RoleKey } from "./roles";
import { isCoreRole } from "./roster-spots";
import { slugify, accountIdFromUrl, normalizeTelegram } from "./profiles";
import { registrationOpen } from "./tournaments";
import { loadQuiz, type QuizConfig } from "./quiz-config";

/** Шаг диалога. Хранится строкой в `BotSession.step` — старую сессию после правки квиза сбросим. */
export type Step =
  | "tournament"
  | "division"
  | "team_name"
  | "team_tag"
  | "nick"
  | "role"
  | "link"
  | "telegram"
  | "more"
  | "captain"
  | "custom"
  | "confirm"
  // правка собранного состава: выбор что править → выбор поля → новое значение → назад в сводку
  | "edit_pick"
  | "edit_field"
  | "edit_nick"
  | "edit_role"
  | "edit_link"
  | "edit_tg"
  | "edit_name"
  | "edit_tag";

/** Всё собранное на текущий момент. Лежит JSON'ом в `BotSession.state`. */
type State = {
  tournamentId: number | null;
  divisionId: number | null;
  team: TeamDraft;
  /** Игрок, которого сейчас заполняем: он уже в `team.players`, дописываем его поля по шагам. */
  index: number;
  /** Ответы на свои вопросы оператора (`quiz-config.ts`) — в том же порядке, что заданы. */
  answers: Answer[];
};

/** Ответ на свой вопрос: сохраняем текст вопроса, а не только ключ — оператор его потом перепишет,
 *  и заявка прошлого месяца должна остаться читаемой. */
export type Answer = { question: string; answer: string };

/** Что бот скажет в ответ. Список, потому что шаг иногда отвечает подтверждением и следующим вопросом. */
type Reply = { text: string; keyboard?: Keyboard };

const emptyState = (): State => ({
  tournamentId: null,
  divisionId: null,
  team: { slug: "", name: "", tag: null, players: [] },
  index: -1,
  answers: [],
});

// Состав: пять **основных** обязательны (иначе заявка не заявка), сверху — замены и тренер.
// Считаем именно занятые позиции 1–5, а не строки: замена, названная до того как собрана основа,
// иначе закрывала бы чужое место, и бот отпускал бы капитана с четырьмя игроками в составе.
// Верхняя граница не про регламент, а про диалог: после десятого игрока это уже опечатка.
const CORE_SIZE = 5;
const MAX_PLAYERS = 10;

/** Сколько позиций 1–5 уже занято. */
const coreCount = (state: State): number => state.team.players.filter((p) => isCoreRole(p.role)).length;

// Ответ «пропустить» для необязательных полей. Кнопкой, чтобы не гадать, чем помечают пустое.
const SKIP = "Пропустить";
const DONE = "Состав готов";
const ADD = "Добавить игрока";
const EDIT = "Поправить";
const BACK = "К сводке";
const DROP = "Удалить игрока";

// Клавиатура у Telegram висит до отмены, и кнопку прошлого шага легко нажать на следующем. Ник,
// совпавший со служебным ответом, — почти наверняка такое нажатие, а не имя игрока.
const SERVICE = new Set([SKIP, DONE, ADD, EDIT, BACK, DROP, "Отправить заявку", "Начать заново"]);

// ── сессия ───────────────────────────────────────────────────────────────────

async function load(chatId: string): Promise<{ step: Step; state: State } | null> {
  const row = await prisma.botSession.findUnique({ where: { chatId } });
  if (!row) return null;
  try {
    return { step: row.step as Step, state: JSON.parse(row.state) as State };
  } catch {
    // Битый JSON — не повод отвечать человеку ошибкой: начнём диалог заново.
    return null;
  }
}

async function save(chatId: string, step: Step, state: State): Promise<void> {
  const data = { step, state: JSON.stringify(state) };
  await prisma.botSession.upsert({ where: { chatId }, create: { chatId, ...data }, update: data });
}

const clear = (chatId: string) => prisma.botSession.deleteMany({ where: { chatId } });

// ── справочники и разбор ответов ─────────────────────────────────────────────

/** Турниры с открытым приёмом. Их же именами подписаны кнопки — второй список не заводим. */
async function openTournaments() {
  const all = await prisma.tournament.findMany({ where: { status: "registration" }, orderBy: { id: "desc" } });
  return all.filter(registrationOpen);
}

/** Кнопки в столбик: названия турниров и дивизионов длинные, в ряд не помещаются. */
const column = (items: string[]): Keyboard => items.map((t) => [t]);

/** Выбор из списка по тексту кнопки. Регистр и лишние пробелы прощаем — человек мог набрать руками. */
const pick = <T extends { name: string }>(items: T[], text: string): T | undefined => {
  const needle = text.trim().toLowerCase();
  return items.find((i) => i.name.trim().toLowerCase() === needle);
};

function roleShort(key: RoleKey): string {
  return ROLES.find((r) => r.key === key)!.short;
}

/**
 * Кнопки позиций для этого игрока: занятые позиции 1–5 не показываем — в составе они по одной, и
 * предлагать керри второй раз значит звать капитана в ошибку, которую потом разбирает оператор.
 * Замена и тренер остаются всегда: их в команде может быть несколько.
 *
 * @param exceptIndex  игрок, которому сейчас выбираем позицию: его собственная роль занятой не считается
 *                     (иначе при точечной правке он не смог бы оставить свою же)
 */
function roleButtons(state: State, exceptIndex: number): string[][] {
  const taken = new Set(
    state.team.players.filter((p, i) => i !== exceptIndex && isCoreRole(p.role)).map((p) => p.role as RoleKey),
  );
  const free = ROLES.filter((r) => r.position !== null && !taken.has(r.key as RoleKey)).map((r) => r.short);
  const rows: string[][] = [];
  for (let i = 0; i < free.length; i += 2) rows.push(free.slice(i, i + 2));
  rows.push([roleShort("standin"), roleShort("coach")]);
  return rows;
}

/**
 * Позиция по ответу. Принимаем не только подпись кнопки: капитан набирает и «мид», и «Mid», и
 * просто «2» — переспрашивать на том, что понятно, значит злить человека посреди длинной анкеты.
 */
function roleByAnswer(text: string): RoleKey | null {
  const answer = text.trim().toLowerCase();
  const position = Number(answer);
  const role = ROLES.find(
    (r) =>
      r.short.toLowerCase() === answer ||
      r.label.toLowerCase() === answer ||
      (Number.isInteger(position) && r.position === position),
  );
  return (role?.key as RoleKey | undefined) ?? null;
}

/**
 * Ссылка на профиль → поле драфта. Кладём по хосту: у игрока нас устраивает любой из трёх, а
 * `playerAccountId` потом сам выберет, из чего вывести account_id.
 */
/** Ссылку приводим к единому виду: со схемой и без хвостовых слэшей — так её потом класть в Player. */
const normalizeLink = (raw: string): string => {
  const value = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

function linkField(raw: string): { field: "dotabuffUrl" | "stratzUrl" | "steamUrl"; problem: string | null } {
  const host = raw.toLowerCase();
  if (host.includes("stratz.com")) return { field: "stratzUrl", problem: profileLinkProblem("stratz", raw) };
  if (host.includes("steamcommunity.com")) return { field: "steamUrl", problem: profileLinkProblem("steam", raw) };
  // Всё прочее меряем по Dotabuff: так у непохожей ссылки будет внятная претензия с примером.
  return { field: "dotabuffUrl", problem: profileLinkProblem("dotabuff", raw) };
}

// ── вопросы ──────────────────────────────────────────────────────────────────
//
// Формулировки берутся из конфигурации (`quiz-config.ts`): дефолт в коде, правки оператора — в БД.
// Поэтому каждый вопрос принимает `q` — снимок конфигурации на это сообщение.

const nth = (i: number) => `${i + 1}-го игрока`;

const askNick = (q: QuizConfig, i: number): Reply => ({
  text: i === 0 ? q.text("nick_first") : q.text("nick_next", { n: i + 1 }),
  keyboard: null,
});

const askRole = (q: QuizConfig, state: State, nick: string): Reply => ({
  text: q.text("role", { "ник": nick }),
  keyboard: roleButtons(state, state.index),
});

const askLink = (q: QuizConfig, nick: string): Reply => ({ text: q.text("link", { "ник": nick }), keyboard: null });

const askTelegram = (q: QuizConfig, nick: string): Reply => ({
  text: q.text("telegram", { "ник": nick }),
  keyboard: [[SKIP]],
});

function askMore(q: QuizConfig, state: State): Reply {
  const core = coreCount(state);
  // Основа не собрана — «закончить» не предлагаем вовсе: заявку с четырьмя позициями оператору
  // всё равно возвращать. Считаем позиции, а не людей: замена основу не закрывает.
  if (core < CORE_SIZE) return { text: q.text("need_more", { "осталось": CORE_SIZE - core }), keyboard: null };
  const rows: string[][] = [[DONE]];
  if (state.team.players.length < MAX_PLAYERS) rows.unshift([ADD]);
  return { text: q.text("more", { n: state.team.players.length }), keyboard: rows };
}

const askCaptain = (q: QuizConfig, state: State): Reply => ({
  text: q.text("captain"),
  keyboard: column(state.team.players.map((p) => p.nickname)),
});

/** Свой вопрос оператора: варианты — кнопками, если он их задал. */
const askCustom = (q: QuizConfig, i: number): Reply => {
  const question = q.custom[i];
  return { text: question.text, keyboard: question.options.length ? column(question.options) : null };
};

/** Что правим: игрока из состава, название, тег — либо назад к сводке. */
function askEditPick(state: State): Reply {
  const rows = state.team.players.map((p) => [p.nickname]);
  rows.push(["Название команды", "Тег команды"]);
  if (state.team.players.length < MAX_PLAYERS) rows.push([ADD]);
  rows.push([BACK]);
  return { text: "Что поправить?", keyboard: rows };
}

/** Что именно у игрока. Удаление здесь же: чаще всего «поправить» и значит «убрать лишнего». */
const askEditField = (state: State): Reply => ({
  text: `Игрок <b>${state.team.players[state.index].nickname}</b> — что поправить?`,
  keyboard: [["Ник", "Позиция"], ["Ссылка", "Телеграм"], [DROP], [BACK]],
});

/** Сводка перед отправкой: последний шанс увидеть опечатку до очереди модерации. */
function askConfirm(q: QuizConfig, state: State, tournamentName: string, divisionName: string | null): Reply {
  const lines = state.team.players.map((p) => {
    const parts = [`• <b>${p.nickname}</b>`, p.role ? roleShort(p.role) : "без позиции"];
    if (p.isCaptain) parts.push("капитан");
    if (p.accountId) parts.push(`id ${p.accountId}`);
    return parts.join(" — ");
  });
  return {
    text: [
      `<b>${state.team.name}</b>${state.team.tag ? ` (${state.team.tag})` : ""}`,
      `Турнир: ${tournamentName}${divisionName ? ` · ${divisionName}` : ""}`,
      "",
      ...lines,
      ...(state.answers.length ? ["", ...state.answers.map((a) => `<b>${a.question}</b>\n${a.answer}`)] : []),
      "",
      q.text("confirm"),
    ].join("\n"),
    keyboard: [["Отправить заявку"], [EDIT], ["Начать заново"]],
  };
}

// ── начало диалога ───────────────────────────────────────────────────────────

/**
 * `/start`: с чего начать. Турнир и дивизион, если он один, проставляем молча — выбор из одного
 * варианта это не выбор, а лишний вопрос человеку.
 */
async function begin(chatId: string, q: QuizConfig): Promise<Reply[]> {
  await clear(chatId);
  const tournaments = await openTournaments();
  if (tournaments.length === 0) return [{ text: q.text("closed") }];

  const state = emptyState();
  const hello = { text: q.text("hello") };

  if (tournaments.length > 1) {
    await save(chatId, "tournament", state);
    return [hello, { text: q.text("tournament"), keyboard: column(tournaments.map((t) => t.name)) }];
  }

  state.tournamentId = tournaments[0].id;
  return [hello, ...(await afterTournament(chatId, q, state, tournaments[0].name))];
}

/** Турнир выбран → дивизион (если их больше одного и оператор не выключил вопрос) либо название. */
async function afterTournament(chatId: string, q: QuizConfig, state: State, tournamentName: string): Promise<Reply[]> {
  const divisions = await divisionsOf(state.tournamentId!);
  if (divisions.length > 1 && q.enabled("division")) {
    await save(chatId, "division", state);
    return [{ text: `Турнир: <b>${tournamentName}</b>.\n${q.text("division")}`, keyboard: column(divisions.map((d) => d.name)) }];
  }
  // Дивизионов несколько, но вопрос выключен — дивизион проставит оператор при разборе заявки.
  state.divisionId = divisions.length === 1 ? divisions[0].id : null;
  await save(chatId, "team_name", state);
  return [{ text: `Турнир: <b>${tournamentName}</b>.\n\n${q.text("team_name")}`, keyboard: null }];
}

const divisionsOf = (tournamentId: number) =>
  prisma.division.findMany({ where: { tournamentId }, orderBy: { orderNo: "asc" } });

// ── шаг диалога ──────────────────────────────────────────────────────────────

/**
 * Одно сообщение от человека → ответы бота. Чистая развилка по шагу: каждый шаг либо принимает
 * ответ и двигает состояние, либо переспрашивает. Ошибка ответа не сбрасывает диалог — иначе
 * опечатка на девятом игроке стоила бы всей заявки.
 */
export async function handleMessage(chatId: string, raw: string): Promise<Reply[]> {
  const text = raw.trim();
  // Конфигурацию читаем на каждое сообщение: правка в /admin/bot должна действовать сразу.
  const q = await loadQuiz();

  if (/^\/start\b/.test(text)) return begin(chatId, q);
  if (/^\/cancel\b/.test(text)) {
    await clear(chatId);
    return [{ text: "Заявка отменена. Начать заново — /start." }];
  }

  const session = await load(chatId);
  if (!session) return begin(chatId, q);
  const { step, state } = session;

  switch (step) {
    case "tournament": {
      const tournaments = await openTournaments();
      const chosen = pick(tournaments, text);
      if (!chosen) return [{ text: "Не понял, какой турнир. Выберите кнопкой:", keyboard: column(tournaments.map((t) => t.name)) }];
      state.tournamentId = chosen.id;
      return afterTournament(chatId, q, state, chosen.name);
    }

    case "division": {
      const divisions = await divisionsOf(state.tournamentId!);
      const chosen = pick(divisions, text);
      if (!chosen) return [{ text: "Такого дивизиона нет. Выберите кнопкой:", keyboard: column(divisions.map((d) => d.name)) }];
      state.divisionId = chosen.id;
      await save(chatId, "team_name", state);
      return [{ text: `Дивизион: <b>${chosen.name}</b>.\n\n${q.text("team_name")}`, keyboard: null }];
    }

    case "team_name": {
      if (!text) return [{ text: "Название пустое. Как называется команда?" }];
      state.team.name = text;
      state.team.slug = slugify(text);
      if (!state.team.slug) return [{ text: "Из такого названия не выходит имени для таблицы — добавьте латиницу или цифры." }];
      if (!q.enabled("team_tag")) return startRoster(chatId, q, state);
      await save(chatId, "team_tag", state);
      return [{ text: q.text("team_tag"), keyboard: [[SKIP]] }];
    }

    case "team_tag": {
      state.team.tag = text === SKIP ? null : text.toUpperCase();
      return startRoster(chatId, q, state);
    }

    case "nick": {
      if (!text) return [{ text: "Ник пустой. Как зовут игрока в лиге?" }];
      if (SERVICE.has(text)) return [{ text: `«${text}» — это кнопка прошлого шага, а не ник. Наберите ник игрока:` }];
      const taken = state.team.players.some((p, i) => i !== state.index && p.nickname.toLowerCase() === text.toLowerCase());
      if (taken) return [{ text: `«${text}» в составе уже есть. Дайте ник ${nth(state.index)}:` }];
      state.team.players[state.index].nickname = text;
      await save(chatId, "role", state);
      return [askRole(q, state, text)];
    }

    case "role": {
      const role = roleByAnswer(text);
      if (!role) return [{ text: "Не разобрал позицию — выберите кнопкой:", keyboard: roleButtons(state, state.index) }];
      const taken = state.team.players.find((p, i) => i !== state.index && isCoreRole(role) && p.role === role);
      if (taken) {
        return [{ text: `Эту позицию уже занял ${taken.nickname}. Выберите свободную:`, keyboard: roleButtons(state, state.index) }];
      }
      const player = state.team.players[state.index];
      player.role = role;
      await save(chatId, "link", state);
      return [askLink(q, player.nickname)];
    }

    case "link": {
      const player = state.team.players[state.index];
      if (!text) return [askLink(q, player.nickname)];
      const { field, problem } = linkField(text);
      if (problem) return [{ text: problem }];
      player[field] = normalizeLink(text);
      player.accountId = accountIdFromUrl(player[field]!);
      if (!q.enabled("telegram")) return afterPlayer(chatId, q, state);
      await save(chatId, "telegram", state);
      return [askTelegram(q, player.nickname)];
    }

    case "telegram": {
      const player = state.team.players[state.index];
      if (text !== SKIP) {
        const handle = normalizeTelegram(text);
        if (!handle) return [{ text: `«${text}» не похоже на телеграм-хендл. Ждём @nickname.`, keyboard: [[SKIP]] }];
        player.telegram = handle;
      }
      return afterPlayer(chatId, q, state);
    }

    case "more": {
      if (/добавить/i.test(text) && state.team.players.length < MAX_PLAYERS) return nextPlayer(chatId, q, state);
      if (/готов/i.test(text)) {
        // Капитана не спрашиваем, когда игрок один: он же и капитан.
        if (state.team.players.length === 1) {
          state.team.players[0].isCaptain = true;
          return afterCaptain(chatId, q, state);
        }
        await save(chatId, "captain", state);
        return [askCaptain(q, state)];
      }
      return [askMore(q, state)];
    }

    case "captain": {
      const player = state.team.players.find((p) => p.nickname.toLowerCase() === text.toLowerCase());
      if (!player) return [{ text: "Такого ника в составе нет. Выберите кнопкой:", keyboard: column(state.team.players.map((p) => p.nickname)) }];
      for (const p of state.team.players) p.isCaptain = p === player;
      return afterCaptain(chatId, q, state);
    }

    case "custom": {
      const i = state.answers.length;
      const question = q.custom[i];
      // Вопрос могли выключить, пока капитан отвечал: тогда просто идём дальше, а не падаем.
      if (!question) return finish(chatId, q, state);
      if (!text) return [askCustom(q, i)];
      if (question.options.length && !question.options.some((o) => o.toLowerCase() === text.toLowerCase())) {
        return [{ text: "Выберите один из вариантов:", keyboard: column(question.options) }];
      }
      state.answers.push({ question: question.text, answer: text });
      return askNextCustom(chatId, q, state);
    }

    case "confirm": {
      if (/начать/i.test(text)) return begin(chatId, q);
      if (text === EDIT) {
        await save(chatId, "edit_pick", state);
        return [askEditPick(state)];
      }
      if (!/отправить/i.test(text)) {
        return [{ text: "Отправляем заявку, правим состав или начинаем заново?", keyboard: [["Отправить заявку"], [EDIT], ["Начать заново"]] }];
      }
      // Правка могла оставить состав без позиции — до очереди такую заявку не пускаем.
      if (coreCount(state) < CORE_SIZE) {
        await save(chatId, "edit_pick", state);
        return [
          { text: `В составе не хватает позиций: ${CORE_SIZE - coreCount(state)}. Добавьте игроков — и отправим.` },
          askEditPick(state),
        ];
      }
      try {
        await submitTelegramApplication(state.tournamentId!, state.divisionId, state.team, state.answers);
      } catch (e) {
        // Приём мог закрыться, пока капитан отвечал: диалог оставляем, чтобы состав не пропал.
        return [{ text: `Не вышло отправить: ${e instanceof Error ? e.message : "ошибка"}` }];
      }
      await clear(chatId);
      return [{ text: q.text("done"), keyboard: null }];
    }

    case "edit_pick": {
      if (text === BACK) return finish(chatId, q, state);
      if (text === ADD && state.team.players.length < MAX_PLAYERS) return nextPlayer(chatId, q, state);
      if (/^название/i.test(text)) {
        await save(chatId, "edit_name", state);
        return [{ text: q.text("team_name"), keyboard: null }];
      }
      if (/^тег/i.test(text)) {
        await save(chatId, "edit_tag", state);
        return [{ text: q.text("team_tag"), keyboard: [[SKIP]] }];
      }
      const i = state.team.players.findIndex((p) => p.nickname.toLowerCase() === text.toLowerCase());
      if (i === -1) return [askEditPick(state)];
      state.index = i;
      await save(chatId, "edit_field", state);
      return [askEditField(state)];
    }

    case "edit_field": {
      const player = state.team.players[state.index];
      if (text === BACK) return finish(chatId, q, state);
      if (text === DROP) {
        state.team.players.splice(state.index, 1);
        state.index = -1;
        // Капитана могли удалить — без него сводка врёт, поэтому спрашиваем заново.
        if (state.team.players.length && !state.team.players.some((p) => p.isCaptain)) {
          await save(chatId, "captain", state);
          return [{ text: `${player.nickname} убран.` }, askCaptain(q, state)];
        }
        await save(chatId, "edit_pick", state);
        return [{ text: `${player.nickname} убран.` }, askEditPick(state)];
      }
      if (/^ник/i.test(text)) {
        await save(chatId, "edit_nick", state);
        return [{ text: `Новый ник вместо «${player.nickname}»:`, keyboard: null }];
      }
      if (/^позиц/i.test(text)) {
        await save(chatId, "edit_role", state);
        return [askRole(q, state, player.nickname)];
      }
      if (/^ссылк/i.test(text)) {
        await save(chatId, "edit_link", state);
        return [askLink(q, player.nickname)];
      }
      if (/^телеграм/i.test(text)) {
        await save(chatId, "edit_tg", state);
        return [askTelegram(q, player.nickname)];
      }
      return [askEditField(state)];
    }

    case "edit_nick": {
      if (!text || SERVICE.has(text)) return [{ text: "Наберите новый ник:" }];
      const taken = state.team.players.some((p, i) => i !== state.index && p.nickname.toLowerCase() === text.toLowerCase());
      if (taken) return [{ text: `«${text}» в составе уже есть. Наберите другой ник:` }];
      state.team.players[state.index].nickname = text;
      return finish(chatId, q, state);
    }

    case "edit_role": {
      const role = roleByAnswer(text);
      if (!role) return [{ text: "Не разобрал позицию — выберите кнопкой:", keyboard: roleButtons(state, state.index) }];
      const busy = state.team.players.find((p, i) => i !== state.index && isCoreRole(role) && p.role === role);
      if (busy) return [{ text: `Эту позицию уже занял ${busy.nickname}. Выберите свободную:`, keyboard: roleButtons(state, state.index) }];
      state.team.players[state.index].role = role;
      return finish(chatId, q, state);
    }

    case "edit_link": {
      const player = state.team.players[state.index];
      if (!text) return [askLink(q, player.nickname)];
      const { field, problem } = linkField(text);
      if (problem) return [{ text: problem }];
      // Ссылки трёх видов лежат в разных полях: старую убираем, иначе у игрока их станет две.
      player.dotabuffUrl = null;
      player.stratzUrl = null;
      player.steamUrl = null;
      player[field] = normalizeLink(text);
      player.accountId = accountIdFromUrl(player[field]!);
      return finish(chatId, q, state);
    }

    case "edit_tg": {
      const player = state.team.players[state.index];
      if (text === SKIP) player.telegram = null;
      else {
        const handle = normalizeTelegram(text);
        if (!handle) return [{ text: `«${text}» не похоже на телеграм-хендл. Ждём @nickname.`, keyboard: [[SKIP]] }];
        player.telegram = handle;
      }
      return finish(chatId, q, state);
    }

    case "edit_name": {
      if (!text || SERVICE.has(text)) return [{ text: "Наберите название команды:" }];
      state.team.name = text;
      state.team.slug = slugify(text);
      if (!state.team.slug) return [{ text: "Из такого названия не выходит имени для таблицы — добавьте латиницу или цифры." }];
      return finish(chatId, q, state);
    }

    case "edit_tag": {
      state.team.tag = text === SKIP ? null : text.toUpperCase();
      return finish(chatId, q, state);
    }
  }
}

/** Название и тег позади — начинаем состав. */
const startRoster = (chatId: string, q: QuizConfig, state: State) => nextPlayer(chatId, q, state);

/** Игрок заполнен: либо сразу следующий (состав не полон), либо вопрос «добавить ещё». */
async function afterPlayer(chatId: string, q: QuizConfig, state: State): Promise<Reply[]> {
  await save(chatId, "more", state);
  const more = askMore(q, state);
  // Пока основы нет, «дальше» не спрашиваем — сразу следующий ник.
  if (coreCount(state) < CORE_SIZE) return [more, ...(await nextPlayer(chatId, q, state))];
  return [more];
}

/** Завести следующего игрока и спросить его ник. */
async function nextPlayer(chatId: string, q: QuizConfig, state: State): Promise<Reply[]> {
  state.team.players.push(emptyPlayer(""));
  state.index = state.team.players.length - 1;
  await save(chatId, "nick", state);
  return [askNick(q, state.index)];
}

/** Состав собран → свои вопросы оператора, если он их завёл. */
const afterCaptain = (chatId: string, q: QuizConfig, state: State) => askNextCustom(chatId, q, state);

/** Следующий свой вопрос либо, если они кончились, сводка. */
async function askNextCustom(chatId: string, q: QuizConfig, state: State): Promise<Reply[]> {
  const i = state.answers.length;
  if (i >= q.custom.length) return finish(chatId, q, state);
  await save(chatId, "custom", state);
  return [askCustom(q, i)];
}

/** Всё собрано → сводка на подтверждение. */
async function finish(chatId: string, q: QuizConfig, state: State): Promise<Reply[]> {
  const [tournament, division] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: state.tournamentId! } }),
    state.divisionId ? prisma.division.findUnique({ where: { id: state.divisionId } }) : Promise.resolve(null),
  ]);
  await save(chatId, "confirm", state);
  return [askConfirm(q, state, tournament?.name ?? "—", division?.name ?? null)];
}

/** Обработать сообщение и ответить в чат. Точка входа для `scripts/bot.ts`. */
export async function replyTo(chatId: string, text: string): Promise<void> {
  const replies = await handleMessage(chatId, text);
  for (const r of replies) await sendTo(chatId, r.text, r.keyboard ?? null);
}

export type { PlayerDraft };
