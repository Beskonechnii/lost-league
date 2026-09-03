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
import { sendTo, type Keyboard, type Reply } from "./telegram";
import { submitTelegramApplication } from "./team-application";
import { emptyPlayer, type TeamDraft, type PlayerDraft } from "./roster-import";
import { profileLinkProblem } from "./application";
import { ROLES, roleShort, roleByAnswer, type RoleKey } from "./roles";
import { isCoreRole } from "./roster-spots";
import { slugify, accountIdFromUrl, normalizeTelegram } from "./profiles";
import { registrationOpen } from "./tournaments";
import { loadQuiz, type QuizConfig } from "./quiz-config";
// Нодовый флоу: пока он ведёт только первый уровень меню и только при включённом `BOT_FLOW`
// (`BOT-FLOW-PLAN.md`). Выключен — весь путь мёртв, бот работает как раньше.
import { BOT_FLOW, FLOW_STEP, continueFlow, flowReply, startFlow } from "./bot-flow/run";
import { MENU, LEGACY_ROSTER, QUIZ_ROSTER, menuKeyboard, isMenuButton, menuReply, rememberChat, identify } from "./tg-menu";
import { FORMS_BUTTON, handleForm, isFormStep, offerForms, type FormState, type FormStep } from "./tg-forms";
import {
  EDIT_BUTTON,
  PE_SERVICE,
  askEdit,
  emptyEdit,
  handleProfileEdit,
  isPeStep,
  startProfileEdit,
  type PeState,
  type PeStep,
} from "./tg-profile";
import {
  TT_EXIT,
  TT_SERVICE,
  emptyTt,
  handleTournaments,
  isTtButton,
  isTtStep,
  startTournaments,
  tournamentsDigest,
  type TtState,
  type TtStep,
} from "./tg-tournaments";
import {
  MEETING_BUTTON,
  MR_SERVICE,
  answerProposal,
  askMeeting,
  emptyMeeting,
  handleMeeting,
  isMrAnswer,
  isMrStep,
  startMeeting,
  type MrState,
  type MrStep,
} from "./tg-meetings";
import {
  REGISTER_BUTTON,
  REG_SERVICE,
  askReg,
  emptyRegistration,
  handleRegister,
  isRegStep,
  startRegistration,
  type RegState,
  type RegStep,
} from "./tg-register";

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
  | "edit_tag"
  // шаги анкеты (src/lib/tg-forms.ts), регистрации в лиге (src/lib/tg-register.ts), правки
  // профиля (src/lib/tg-profile.ts), раздела «Турниры» (src/lib/tg-tournaments.ts) и заказа
  // встречи (src/lib/tg-meetings.ts) — живут в той же сессии, разведены префиксом
  | FormStep
  | RegStep
  | PeStep
  | TtStep
  | MrStep;

/** Всё собранное на текущий момент. Лежит JSON'ом в `BotSession.state`. */
type State = {
  tournamentId: number | null;
  divisionId: number | null;
  team: TeamDraft;
  /** Игрок, которого сейчас заполняем: он уже в `team.players`, дописываем его поля по шагам. */
  index: number;
  /** Ответы на свои вопросы оператора (`quiz-config.ts`) — в том же порядке, что заданы.
   *  Их же переиспользует анкета (`tg-forms.ts`): формат один — вопрос и ответ текстом. */
  answers: Answer[];
  /** Какая анкета заполняется, если идёт анкета, а не заявка (`tg-forms.ts`). */
  quizId: number | null;
  /** Анкета игрока на вступление в лигу, если идёт регистрация (`tg-register.ts`). */
  reg: RegState | null;
  /** Правка своего профиля, если идёт она (`tg-profile.ts`). */
  edit: PeState | null;
  /** Где человек стоит в разделе «Турниры» (`tg-tournaments.ts`). */
  nav: TtState;
  /** Заказ встречи, если идёт он (`tg-meetings.ts`). */
  meet: MrState | null;
};

/** Ответ на свой вопрос: сохраняем текст вопроса, а не только ключ — оператор его потом перепишет,
 *  и заявка прошлого месяца должна остаться читаемой. */
export type Answer = { question: string; answer: string };

const emptyState = (): State => ({
  tournamentId: null,
  divisionId: null,
  team: { slug: "", name: "", tag: null, players: [] },
  index: -1,
  answers: [],
  quizId: null,
  reg: null,
  edit: null,
  nav: emptyTt(),
  meet: null,
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
const SERVICE = new Set([SKIP, DONE, ADD, EDIT, BACK, DROP, "Отправить заявку", "Начать заново", ...Object.values(MENU), LEGACY_ROSTER, ...REG_SERVICE, ...PE_SERVICE, ...TT_SERVICE, ...MR_SERVICE]);

// ── сессия ───────────────────────────────────────────────────────────────────

async function load(chatId: string): Promise<{ step: Step; state: State } | null> {
  const row = await prisma.botSession.findUnique({ where: { chatId } });
  if (!row) return null;
  // Строку ведёт граф (`bot-flow/run.ts`) — для старого пути такого диалога нет: у него нечего
  // терять и не во что возвращаться, а «начатым диалогом» стояние в меню считаться не должно.
  if (row.step === FLOW_STEP) return null;
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
  rows.push([roleShort("standin")!, roleShort("coach")!]);
  return rows;
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

/**
 * Повторить вопрос, на котором стоит диалог. Нужен там, где бот отвлёкся на постороннее (кнопку
 * меню): без повтора человек остаётся с ответом на другой вопрос и без понимания, что от него ждут.
 *
 * Шаги, которым нужны данные из БД (выбор турнира и дивизиона), повторяем текстом без кнопок:
 * ходить за списком ради подсказки не стоит, а ответ бот примет и набранный руками.
 */
function askCurrent(q: QuizConfig, step: Step, state: State): Reply {
  // Регистрация ведёт свои вопросы сама — повторяем тот, на котором стоим.
  if (isRegStep(step)) return askReg(step, state.reg ?? emptyRegistration());
  // Правка профиля — тоже свой модуль со своими вопросами.
  if (isPeStep(step)) return askEdit(step, state.edit ?? emptyEdit());
  // Заказ встречи — тоже.
  if (isMrStep(step)) return askMeeting(step, state.meet ?? emptyMeeting());
  const player = state.team.players[state.index];
  switch (step) {
    case "tournament":
      return { text: q.text("tournament") };
    case "division":
      return { text: q.text("division") };
    case "team_name":
    case "edit_name":
      return { text: q.text("team_name") };
    case "team_tag":
    case "edit_tag":
      return { text: q.text("team_tag"), keyboard: [[SKIP]] };
    case "nick":
      return askNick(q, state.index);
    case "edit_nick":
      return { text: `Новый ник вместо «${player.nickname}»:` };
    case "role":
    case "edit_role":
      return askRole(q, state, player.nickname);
    case "link":
    case "edit_link":
      return askLink(q, player.nickname);
    case "telegram":
    case "edit_tg":
      return askTelegram(q, player.nickname);
    case "more":
      return askMore(q, state);
    case "captain":
      return askCaptain(q, state);
    case "custom":
      return askCustom(q, state.answers.length);
    case "edit_pick":
      return askEditPick(state);
    case "edit_field":
      return askEditField(state);
    case "confirm":
      return { text: "Продолжаем: отправляем заявку, правим состав или начинаем заново?", keyboard: [["Отправить заявку"], [EDIT], ["Начать заново"]] };
    default:
      // Шаги анкеты сюда не приходят: их перехватывает `runForm` раньше. Ответ на всякий случай —
      // молчащий бот хуже лишней строки.
      return { text: "Продолжаем." };
  }
}

/** Сводка перед отправкой: последний шанс увидеть опечатку до очереди модерации. */
function askConfirm(q: QuizConfig, state: State, tournamentName: string, divisionName: string | null): Reply {
  const lines = state.team.players.map((p) => {
    const parts = [`• <b>${p.nickname}</b>`, roleShort(p.role) ?? "без позиции"];
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
  if (tournaments.length === 0) return [{ text: q.text("closed"), keyboard: await menuKeyboard() }];

  const state = emptyState();
  const hello = { text: q.text("hello") };

  if (tournaments.length > 1) {
    await save(chatId, "tournament", state);
    return [hello, { text: q.text("tournament"), keyboard: column(tournaments.map((t) => t.name)) }];
  }

  state.tournamentId = tournaments[0].id;
  return [hello, ...(await afterTournament(chatId, q, state, tournaments[0].name))];
}

/**
 * Начать регистрацию игрока. Два входа: кнопка «Регистрация» в меню и ссылка-приглашение
 * `?start=invite` со страницы сборки состава — шаги у них одни и те же.
 */
async function beginRegistration(
  chatId: string,
  username: string | null | undefined,
  tgId: string | null | undefined,
): Promise<Reply[]> {
  const started = await startRegistration(tgId ?? null, normalizeTelegram(username ?? ""));
  if (started.done || !started.step) {
    await clear(chatId);
    return [...started.replies, { text: "Что дальше?", keyboard: await menuKeyboard() }];
  }
  await save(chatId, started.step, { ...emptyState(), reg: started.state });
  return started.replies;
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
export async function handleMessage(
  chatId: string,
  raw: string,
  username?: string | null,
  tgId?: string | null,
  /** `file_id` присланной картинки, если сообщение было фото: его ждёт правка фото в профиле. */
  photoFileId?: string | null,
): Promise<Reply[]> {
  const text = raw.trim();
  // Конфигурацию читаем на каждое сообщение: правка в /admin/bot должна действовать сразу.
  const q = await loadQuiz();
  // Чат запоминаем при каждом сообщении: позже по нему уйдёт решение организатора по заявке.
  await rememberChat(chatId, username);

  const start = /^\/start(?:\s+(\S+))?/.exec(text);
  if (start) {
    await clear(chatId);
    // Кнопку регистрации показываем тому, кого лига не знает: остальным она предлагает вступить
    // туда, где человек уже играет.
    const known = (await identify(chatId, username, tgId)).length > 0;
    // `?start=invite` — переход по ссылке-приглашению со страницы заявки: капитан собирает состав и
    // не нашёл человека в пуле. Такого сразу ведём в регистрацию, а не в меню: он пришёл по делу,
    // и лишний экран между ним и анкетой — потерянный игрок.
    if (start[1] === "invite" && !known) return beginRegistration(chatId, username, tgId);
    // Первый уровень ведёт граф — если он включён и что-то ответил (`BOT-FLOW-PLAN.md`, Э1).
    if (BOT_FLOW) {
      const flowed = await startFlow({ chatId, text, username, tgId });
      if (flowed) return flowed;
    }
    return [{ text: q.text("menu"), keyboard: await menuKeyboard(!known) }];
  }
  if (/^\/cancel\b/.test(text)) {
    await clear(chatId);
    return [{ text: "Отменил. Что дальше?", keyboard: await menuKeyboard() }];
  }

  const session = await load(chatId);
  // Навигация по турнирам — не диалог: там нечего терять, кроме места в списке. Поэтому для кнопок,
  // которые «не сбрасывают начатое», она за начатое не считается — из неё просто выходят.
  const dialog = session && !isTtStep(session.step) ? session : null;
  // …а вот кнопка «Подать заявку» внутри раздела принадлежит ему: заявка подаётся в выбранный
  // турнир, и меню не должно перехватывать её вопросом «на какой турнир заявляетесь».
  const inNav = !!session && !dialog;

  // Регистрация в лиге. Посреди уже начатого диалога не запускаем: собранный состав или анкета
  // пропали бы молча — а это ровно та работа, которую человек только что сделал.
  if (text === REGISTER_BUTTON) {
    if (dialog && !isRegStep(dialog.step)) {
      return [{ text: "Сначала закончим начатое — или наберите /cancel, чтобы бросить.", keyboard: null }, askCurrent(q, dialog.step, dialog.state)];
    }
    return beginRegistration(chatId, username, tgId);
  }

  // Правка своего профиля. Как и регистрация, посреди начатого диалога не запускается: собранный
  // состав пропал бы молча.
  if (text === EDIT_BUTTON) {
    if (dialog && !isPeStep(dialog.step)) {
      return [{ text: "Сначала закончим начатое — или наберите /cancel, чтобы бросить.", keyboard: null }, askCurrent(q, dialog.step, dialog.state)];
    }
    const started = await startProfileEdit(tgId ?? null);
    if (started.done || !started.step) {
      await clear(chatId);
      return [...started.replies, { text: "Что дальше?", keyboard: await menuKeyboard() }];
    }
    await save(chatId, started.step, { ...emptyState(), edit: started.state });
    return started.replies;
  }

  // Заказ встречи. Кнопка живёт на экране турнира, но ловится здесь, как «Изменить данные»: из
  // раздела «Турниры» она выводит (там терять нечего), а посреди начатого диалога не запускается.
  if (text === MEETING_BUTTON) {
    if (dialog && !isMrStep(dialog.step)) {
      return [{ text: "Сначала закончим начатое — или наберите /cancel, чтобы бросить.", keyboard: null }, askCurrent(q, dialog.step, dialog.state)];
    }
    const started = await startMeeting(tgId ?? null);
    if (started.done || !started.step) {
      await clear(chatId);
      return [...started.replies, { text: "Что дальше?", keyboard: await menuKeyboard() }];
    }
    await save(chatId, started.step, { ...emptyState(), meet: started.state });
    return started.replies;
  }

  // Ответ на предложение соперника. Прилетает без диалога — клавиатуру поставило само уведомление,
  // и человек нажимает её из любого места, где он был.
  if (isMrAnswer(text) && !dialog) {
    const answered = await answerProposal(text, { tgId: tgId ?? null });
    if (answered.done || !answered.step) {
      await clear(chatId);
      return [...answered.replies, { text: "Что дальше?", keyboard: await menuKeyboard() }];
    }
    await save(chatId, answered.step, { ...emptyState(), meet: answered.state });
    return answered.replies;
  }

  // Нодовый флоу (`BOT-FLOW-PLAN.md`), ход первый: продолжить то, что граф уже ведёт. Стоит после
  // перехватов, которые НАЧИНАЮТ рукописный диалог (регистрация, правка профиля, заказ встречи,
  // ответ сопернику), и перед теми, что показывают справки: с Э4 справки ведёт граф, и его кнопки
  // подписаны теми же словами («Личный профиль», «Моя команда», «В меню»). Разбирай их старый код
  // первым — человек посреди графа проваливался бы в рукописный раздел на каждой второй кнопке.
  //
  // Начать разговор графом здесь нельзя: он ответил бы меню на «Мой состав» и «Анкеты», не дав
  // веткам ниже ни одного шанса. Начало — последним средством, в конце обработчика.
  //
  // `null` из графа значит «это не ко мне» — идём дальше старым путём. `!session` здесь значит «ни
  // начатого квиза, ни навигации по турнирам»: сессию графа `load` за диалог не считает (см. выше).
  if (BOT_FLOW && !session) {
    const flowed = await continueFlow({ chatId, text, username, tgId });
    if (flowed) return flowed;
  }

  // Кнопка меню посреди квиза — справка, а не выход: капитан на седьмом игроке не должен терять
  // состав из-за случайного нажатия. Отвечаем и тут же повторяем вопрос, на котором стоим.
  if (isMenuButton(text)) {
    if (text === MENU.apply && !inNav) {
      if (dialog && !isFormStep(dialog.step)) return [askCurrent(q, dialog.step, dialog.state)];
      // Кнопка прошлой версии меню (заявка переехала внутрь турнира, а состав — на сайт): ведём в
      // раздел турниров, там у «Подать заявку» уже есть ссылка на сборку состава.
      if (!QUIZ_ROSTER) {
        const hint = { text: `Заявка подаётся внутри турнира: «${MENU.tournaments}» → ваш турнир → «${MENU.apply}».` };
        return [hint, ...(await enterTournaments(chatId))];
      }
      return begin(chatId, q);
    }
    if (text === FORMS_BUTTON) {
      const offer = await offerForms();
      if (!offer) return [{ text: "Открытых анкет сейчас нет.", keyboard: await menuKeyboard() }];
      await save(chatId, "form_pick", emptyState());
      return [offer];
    }
    if (text === MENU.tournaments) {
      // Посреди начатого диалога навигацию не заводим — она затёрла бы собранный состав. Отдаём
      // список текстом и повторяем вопрос: меню не сбрасывает квиз.
      if (dialog) return [await tournamentsDigest(), askCurrent(q, dialog.step, dialog.state)];
      return enterTournaments(chatId);
    }
    const reply = await menuReply(chatId, text, username, tgId);
    if (reply) {
      if (dialog) return [reply, askCurrent(q, dialog.step, dialog.state)];
      // Из навигации по турнирам кнопка меню выводит: держать место в списке, пока человек читает
      // профиль, незачем — вернётся он всё равно с первого уровня.
      if (session) await clear(chatId);
      return [reply];
    }
  }

  // Кнопка раздела «Турниры», прилетевшая без сессии, — это клавиатура, оставшаяся от прошлого
  // захода: Telegram держит её до отмены. Начинать по ней заявку (что бот делает на любой непонятый
  // текст) значит отвечать не на то, о чём просили.
  // Кнопка прошлой версии меню: состав переехал внутрь турнира. Посреди диалога — только справка
  // (меню не сбрасывает квиз), иначе ведём туда, где состав теперь живёт.
  if (text === LEGACY_ROSTER) {
    const hint = { text: `Состав теперь внутри турнира: «${MENU.tournaments}» → ваш турнир → «Моя команда».` };
    if (dialog) return [hint, askCurrent(q, dialog.step, dialog.state)];
    return [hint, ...(await enterTournaments(chatId))];
  }

  if (!dialog && isTtButton(text)) {
    if (text === TT_EXIT) {
      await clear(chatId);
      return [{ text: "Что дальше?", keyboard: await menuKeyboard() }];
    }
    if (!session) return enterTournaments(chatId);
  }

  // Нодовый флоу, ход второй: за текст никто не взялся — граф начинает разговор с первой ноды и
  // отвечает тем же меню, что и ветка ниже. Начатое графом сюда не доходит: его ход сделан выше.
  if (BOT_FLOW && !session) {
    const flowed = await flowReply({ chatId, text, username, tgId });
    if (flowed) return flowed;
  }

  // Непонятый текст без начатого диалога. Раньше он начинал заявку команды — теперь начинать нечего:
  // состав собирается на сайте, и втягивать человека в квиз из пяти ников по слову «привет» значит
  // отвечать не на то, о чём просили. Показываем меню.
  if (!session && !QUIZ_ROSTER) {
    const known = (await identify(chatId, username, tgId)).length > 0;
    return [{ text: q.text("menu"), keyboard: await menuKeyboard(!known) }];
  }
  if (!session) return begin(chatId, q);
  const { step, state } = session;

  // Анкету ведёт свой модуль: у неё нет ни ростера, ни проверок состава — только вопросы подряд.
  if (isFormStep(step)) return runForm(chatId, step, state, text, username, tgId);
  // Регистрацию — свой: она пишет не в заявку команды, а в аккаунт человека.
  if (isRegStep(step)) return runRegister(chatId, step, state, text, username, tgId);
  // Правку профиля — свой: она пишет в очередь `ProfileEditRequest`.
  if (isPeStep(step)) return runProfileEdit(chatId, step, state, text, tgId, photoFileId);
  // Заказ встречи — свой: он пишет в очередь `MatchRequest`.
  if (isMrStep(step)) return runMeeting(chatId, step, state, text, tgId);
  // Раздел «Турниры» — свой: он ничего не пишет, только водит по уровням.
  if (isTtStep(step)) return runTournaments(chatId, step, state, text, q, username, tgId);

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
        await submitTelegramApplication(state.tournamentId!, state.divisionId, state.team, state.answers, chatId);
      } catch (e) {
        // Приём мог закрыться, пока капитан отвечал: диалог оставляем, чтобы состав не пропал.
        return [{ text: `Не вышло отправить: ${e instanceof Error ? e.message : "ошибка"}` }];
      }
      await clear(chatId);
      return [{ text: q.text("done"), keyboard: await menuKeyboard() }];
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

/**
 * Шаг анкеты. Состояние анкеты хранится в том же поле `BotSession.state`, что и состояние заявки:
 * диалог у человека один, и держать две строки на чат значит однажды показать ему оба сразу.
 * Ответы едут в общем поле `answers` (формат тот же — вопрос и ответ текстом), а какая именно
 * анкета идёт, помнит отдельное поле `quizId`: смысл поля не должен зависеть от сценария.
 */
async function runForm(
  chatId: string,
  step: FormStep,
  state: State,
  text: string,
  username: string | null | undefined,
  tgId: string | null | undefined,
): Promise<Reply[]> {
  const form: FormState = { quizId: state.quizId, answers: state.answers };
  // Кто отвечает — если человека знаем, ответ будет подписан игроком, а не только хендлом.
  const [playerId] = await identify(chatId, username, tgId);
  const result = await handleForm(step, form, text, chatId, username, playerId ?? null);

  if (result.done) {
    await clear(chatId);
    return [...result.replies, { text: "Что дальше?", keyboard: await menuKeyboard() }];
  }
  await save(chatId, result.step ?? step, { ...state, quizId: result.state.quizId, answers: result.state.answers });
  return result.replies;
}

/**
 * Шаг регистрации в лиге. Как и анкета, состояние держит в общей `BotSession` — своим полем `reg`,
 * чтобы смысл поля не зависел от того, какой сценарий сейчас идёт.
 */
async function runRegister(
  chatId: string,
  step: RegStep,
  state: State,
  text: string,
  username: string | null | undefined,
  tgId: string | null | undefined,
): Promise<Reply[]> {
  const result = await handleRegister(step, state.reg ?? emptyRegistration(), text, {
    chatId,
    tgId: tgId ?? null,
    username,
  });

  if (result.done) {
    await clear(chatId);
    return [...result.replies, { text: "Что дальше?", keyboard: await menuKeyboard() }];
  }
  await save(chatId, result.step ?? step, { ...state, reg: result.state });
  return result.replies;
}

/**
 * Шаг правки профиля. Состояние — своё поле `edit` в общей `BotSession`, как у регистрации: смысл
 * поля не должен зависеть от того, какой сценарий сейчас идёт. Хендл сюда не передаём вовсе —
 * править профиль можно только по привязке `tgId` (`tg-profile.ts`).
 */
async function runProfileEdit(
  chatId: string,
  step: PeStep,
  state: State,
  text: string,
  tgId: string | null | undefined,
  photoFileId: string | null | undefined,
): Promise<Reply[]> {
  const result = await handleProfileEdit(step, state.edit ?? emptyEdit(), text, { chatId, tgId, photoFileId });

  if (result.done) {
    await clear(chatId);
    return [...result.replies, { text: "Что дальше?", keyboard: await menuKeyboard() }];
  }
  await save(chatId, result.step ?? step, { ...state, edit: result.state });
  return result.replies;
}

/**
 * Шаг заказа встречи. Состояние — своё поле `meet` в общей `BotSession`, как у регистрации и правки
 * профиля. Хендл сюда не передаём вовсе: заказать встречу можно только по привязке `tgId`
 * (`tg-meetings.ts`) — это действие, которое пишет.
 */
async function runMeeting(
  chatId: string,
  step: MrStep,
  state: State,
  text: string,
  tgId: string | null | undefined,
): Promise<Reply[]> {
  const result = await handleMeeting(step, state.meet ?? emptyMeeting(), text, { chatId, tgId });

  if (result.done) {
    await clear(chatId);
    return [...result.replies, { text: "Что дальше?", keyboard: await menuKeyboard() }];
  }
  await save(chatId, result.step ?? step, { ...state, meet: result.state });
  return result.replies;
}

/** Вход в раздел «Турниры» с первого уровня: список сезонов и навигация по ним. */
async function enterTournaments(chatId: string): Promise<Reply[]> {
  const started = await startTournaments();
  if (!started.step) {
    // Показывать нечего — навигацию не заводим, а прежний диалог всё равно закрываем: человек
    // нажал кнопку меню, значит с начатым он закончил.
    await clear(chatId);
    return started.replies;
  }
  await save(chatId, started.step, { ...emptyState(), nav: started.state });
  return started.replies;
}

/**
 * Шаг раздела «Турниры». Он ничего не пишет и ничего не собирает — только водит по уровням, поэтому
 * состояние у него одно поле (`nav`), а выход из раздела просто сбрасывает диалог.
 */
async function runTournaments(
  chatId: string,
  step: TtStep,
  state: State,
  text: string,
  q: QuizConfig,
  username: string | null | undefined,
  tgId: string | null | undefined,
): Promise<Reply[]> {
  const result = await handleTournaments(step, state.nav, text, { chatId, username, tgId });

  // «Подать заявку» внутри турнира. С Э5 раздел на неё отвечает ссылкой на сайт и сюда не заходит;
  // ветка живёт как путь отката (`QUIZ_ROSTER` в tg-menu.ts): турнир уже выбран, спрашивать его
  // второй раз незачем.
  if (result.apply) {
    const tournament = await prisma.tournament.findUnique({ where: { id: result.apply } });
    const fresh = { ...emptyState(), tournamentId: result.apply };
    return [{ text: q.text("hello") }, ...(await afterTournament(chatId, q, fresh, tournament?.name ?? "турнир"))];
  }

  if (result.done) {
    await clear(chatId);
    // Раздел, отвечающий на выход своим сообщением (например «не нашёл вас в лиге»), сам ставит
    // клавиатуру меню — второе «Что дальше?» следом было бы шумом.
    return result.replies.length ? result.replies : [{ text: "Что дальше?", keyboard: await menuKeyboard() }];
  }
  await save(chatId, result.step ?? step, { ...state, nav: result.state });
  return result.replies;
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
export async function replyTo(
  chatId: string,
  text: string,
  username?: string | null,
  tgId?: string | null,
  photoFileId?: string | null,
): Promise<void> {
  const replies = await handleMessage(chatId, text, username, tgId, photoFileId);
  for (const r of replies) await sendTo(chatId, r.text, r.keyboard ?? null);
}

export type { PlayerDraft };
