// Только сервер / скрипт: регистрация игрока в лиге через бота — второй вход в ту же воронку, что
// и анкета на сайте (`/me`). Собранное уезжает в `UserAccount.application` тем же JSON'ом и той же
// проверкой (`normalizeApplication`), очередь и апрув общие — см. `src/lib/account.ts`.
//
// Зачем это боту. До сих пор бот узнавал человека по `@username`, а хендл — не удостоверение: его
// меняют, и освободившийся занимает посторонний. Поэтому боту нельзя было доверить ничего, что
// пишет. Регистрация даёт настоящую привязку `from.id ↔ UserAccount ↔ Player`, и с ней появляются
// адресные уведомления и права («ты капитан этой команды»).
//
// Шаги живут в общей `BotSession` под префиксом `reg_*` — как анкеты (`tg-forms.ts`): диалог у
// человека один, и держать две строки на чат значит однажды показать ему оба сразу. Состояние
// модуль возвращает наружу, а пишет его `tg-quiz.ts`: два писателя в одну строку — две правды о
// том, где человек находится.

import { prisma } from "./prisma";
import type { Reply } from "./telegram";
import {
  EMPTY_INPUT,
  formatApplication,
  normalizeApplication,
  profileLinkProblem,
  type Application,
  type ApplicationInput,
} from "./application";
import { ROLES, roleByAnswer, roleShort } from "./roles";
import { parseBirthday, formatBirthday, normalizeTelegram } from "./profiles";

/** Шаг регистрации. Хранится в том же `BotSession.step`, что и шаги заявки — префикс их разводит. */
export type RegStep =
  | "reg_nick"
  | "reg_name"
  | "reg_city"
  | "reg_country"
  | "reg_birthday"
  | "reg_dotabuff"
  | "reg_steam"
  | "reg_mmr"
  | "reg_position"
  | "reg_achievements"
  | "reg_confirm";

export const isRegStep = (step: string): step is RegStep => step.startsWith("reg_");

/** Собранное на текущий момент — те же ключи, что у веб-формы: анкета одна на оба входа. */
export type RegState = ApplicationInput;

export const REGISTER_BUTTON = "Зарегистрироваться в лиге";

const SKIP = "Пропустить";
const SEND = "Отправить";
const RESTART = "Заполнить заново";

/** Служебные ответы этого сценария — ими нельзя случайно назваться на шаге со свободным текстом. */
export const REG_SERVICE = [SKIP, SEND, RESTART, REGISTER_BUTTON];

/** Порядок вопросов. Сводка (`reg_confirm`) идёт после последнего и в этот список не входит. */
const FLOW: RegStep[] = [
  "reg_nick",
  "reg_name",
  "reg_city",
  "reg_country",
  "reg_birthday",
  "reg_dotabuff",
  "reg_steam",
  "reg_mmr",
  "reg_position",
  "reg_achievements",
];

export const emptyRegistration = (): RegState => ({ ...EMPTY_INPUT });

// ── вопросы ──────────────────────────────────────────────────────────────────
//
// Формулировки здесь, а не в `quiz-config.ts`: тот конфиг про заявку команды, у него свои ключи и
// свой экран в админке. Тексты регистрации отдадим оператору вместе с остальными настройками бота
// (Э6 в BOT-PLAN.md) — до тех пор одно место лучше, чем половина настроек в базе.

/** Кнопки позиции: пятёрка ролей по две в ряд плюс тренер — он тоже человек лиги. */
function positionButtons(): string[][] {
  const core = ROLES.filter((r) => r.position !== null).map((r) => r.short);
  const rows: string[][] = [];
  for (let i = 0; i < core.length; i += 2) rows.push(core.slice(i, i + 2));
  rows.push([roleShort("coach")!]);
  return rows;
}

/** Вопрос шага. Им же отвечаем на непонятый ответ и на возврат из меню (`askCurrent` в tg-quiz.ts). */
export function askReg(step: RegStep, state: RegState): Reply {
  switch (step) {
    case "reg_nick":
      return { text: "<b>Ник</b>, под которым вас будут видеть в лиге:", keyboard: null };
    case "reg_name":
      return { text: "<b>Имя и фамилия</b> — их видит только организатор:", keyboard: null };
    case "reg_city":
      return { text: "<b>Город</b>, в котором живёте:", keyboard: null };
    case "reg_country":
      // Кнопки — подсказка, а не список: страну можно и набрать, ответ приезжает тем же текстом.
      return { text: "<b>Страна</b>:", keyboard: [["Россия", "Беларусь"], ["Казахстан", "Украина"]] };
    case "reg_birthday":
      return { text: "<b>Дата рождения</b> — как 21.04.1998:", keyboard: null };
    case "reg_dotabuff":
      return {
        text: "<b>Ссылка на Dotabuff</b> — по ней лига находит ваши матчи:\nhttps://www.dotabuff.com/players/123456",
        keyboard: null,
      };
    case "reg_steam":
      return { text: "<b>Ссылка на Steam</b>, если есть:", keyboard: [[SKIP]] };
    case "reg_mmr":
      return { text: "<b>MMR</b> — числом. Он заявленный, его проверит организатор:", keyboard: null };
    case "reg_position":
      return { text: "<b>Основная позиция</b>:", keyboard: positionButtons() };
    case "reg_achievements":
      return { text: "<b>Достижения</b> — в лиге и вне её, одной строкой. Нет — пропустите:", keyboard: [[SKIP]] };
    case "reg_confirm":
      return summary(state);
  }
}

/** Сводка: последний шанс увидеть опечатку до очереди модерации. */
function summary(state: RegState): Reply {
  const rows: [string, string][] = [
    ["Ник", state.nickname],
    ["Имя", state.realName],
    ["Город", [state.city, state.country].filter(Boolean).join(", ")],
    // В состоянии дата лежит как yyyy-mm-dd (её понимает <input type=date> на сайте), а человеку
    // показываем в том же виде, в каком спрашивали.
    ["Дата рождения", state.birthday ? formatBirthday(parseBirthday(state.birthday)!) : ""],
    ["Dotabuff", state.dotabuff],
    ["Steam", state.steam],
    ["MMR", state.mmr],
    ["Позиция", roleShort(state.position) ?? state.position],
    ["Телеграм", state.telegram ? `@${state.telegram}` : ""],
    ["Достижения", state.achievements],
  ];
  return {
    text: [
      "<b>Анкета игрока</b>",
      "",
      ...rows.filter(([, v]) => v).map(([k, v]) => `<b>${k}:</b> ${v}`),
      "",
      "Отправляем? Организатор посмотрит и заведёт вас в ростер.",
    ].join("\n"),
    keyboard: [[SEND], [RESTART]],
  };
}

// ── приём ответов ────────────────────────────────────────────────────────────
//
// Проверяем на месте, пока человек ещё в диалоге и может поправить. Итоговая правда всё равно за
// `normalizeApplication` перед отправкой — здесь только то, что позволяет не гнать человека до
// сводки с заведомо негодным ответом.

/** Претензия к ответу либо null. Ответ уже записан в состояние вызывающим. */
function problem(step: RegStep, text: string): string | null {
  switch (step) {
    case "reg_nick":
      return text ? null : "Ник пустой. Как вас звать в лиге?";
    case "reg_name":
      return text ? null : "Напишите имя и фамилию.";
    case "reg_city":
      return text ? null : "Напишите город.";
    case "reg_country":
      return text ? null : "Напишите страну.";
    case "reg_birthday":
      return parseBirthday(text) ? null : `Дата «${text}» не разобрана — ждём 21.04.1998.`;
    case "reg_dotabuff":
      return text ? profileLinkProblem("dotabuff", text) : "Без ссылки на Dotabuff вас не найти в матчах лиги.";
    case "reg_steam":
      return profileLinkProblem("steam", text);
    case "reg_mmr": {
      const n = Number(text.replace(/\s+/g, ""));
      return Number.isInteger(n) && n >= 0 ? null : "MMR — целое число, например 4200.";
    }
    case "reg_position":
      return roleByAnswer(text) ? null : "Не разобрал позицию — выберите кнопкой.";
    default:
      return null;
  }
}

/** Куда положить ответ шага. Позиция превращается в ключ роли: в анкете хранится он, а не подпись. */
function remember(step: RegStep, text: string, state: RegState): void {
  switch (step) {
    case "reg_nick": state.nickname = text; break;
    case "reg_name": state.realName = text; break;
    case "reg_city": state.city = text; break;
    case "reg_country": state.country = text; break;
    case "reg_birthday": state.birthday = parseBirthday(text)!.toISOString().slice(0, 10); break;
    case "reg_dotabuff": state.dotabuff = text; break;
    case "reg_steam": state.steam = text; break;
    case "reg_mmr": state.mmr = text.replace(/\s+/g, ""); break;
    case "reg_position": state.position = roleByAnswer(text)!; break;
    case "reg_achievements": state.achievements = text; break;
    default: break;
  }
}

/** Можно ли пропустить шаг — необязательных всего два, и у них есть кнопка. */
const optional = (step: RegStep): boolean => step === "reg_steam" || step === "reg_achievements";

// ── запись в очередь модерации ───────────────────────────────────────────────
//
// Пишем сами, а не через `account.ts`: тот помечен `server-only` и в процесс бота (обычный node,
// `scripts/bot.ts`) не грузится вовсе. Ровно та же причина, по которой заявку команды из бота
// принимает `team-application.ts`. Дублирования нет: «пустить в лигу» по-прежнему одно
// (`approveRegistration`), здесь только приём анкеты.
//
// Отличий от веб-регистрации ровно два: почты нет (и не спрашиваем — вход такому человеку тоже
// телеграмный) и ключом аккаунта служит `tgId`. Анкета проверена тем же `normalizeApplication`,
// статус `pending`, очередь и апрув общие.

/** Аккаунт по телеграм-id — то, чем бот узнаёт человека после регистрации. */
const accountByTgId = (tgId: string) =>
  prisma.userAccount.findUnique({ where: { tgId }, select: { id: true, playerId: true, status: true } });

/** Принять анкету: завести аккаунт (или обновить его же повторную попытку) и поставить в очередь. */
async function saveApplication(
  app: Application,
  ctx: { chatId: string; tgId: string; username: string | null },
): Promise<string | null> {
  const existing = await accountByTgId(ctx.tgId);
  if (existing?.playerId) return "Вы уже в лиге — анкету заново подавать не нужно.";

  const now = new Date();
  const data = {
    tgUsername: ctx.username,
    name: app.realName || app.nickname,
    application: formatApplication(app),
    status: "pending",
    submittedAt: now,
    // Прошлое решение к новой редакции не относится — снимаем, как и веб-анкета (submitApplication).
    rejectedReason: null,
    reviewedAt: null,
    reviewedById: null,
  };
  const account = existing
    ? await prisma.userAccount.update({ where: { id: existing.id }, data })
    : await prisma.userAccount.create({ data: { ...data, tgId: ctx.tgId, source: "telegram" } });

  // Чат закрепляем за аккаунтом: по нему уйдёт решение организатора, и по нему же бот узнает
  // человека, если хендл сменится.
  await prisma.tgChat.updateMany({ where: { chatId: ctx.chatId }, data: { accountId: account.id } });
  return null;
}

// ── вход в сценарий ──────────────────────────────────────────────────────────

/**
 * Почему регистрацию нельзя начать — текстом, либо null. Причин две: человек уже в лиге и его
 * анкета уже ждёт решения. Обе стоит сказать вслух: молча начатая вторая анкета создаёт оператору
 * дубль, который потом разводить руками.
 */
export async function registrationBlock(tgId: string | null): Promise<string | null> {
  if (!tgId) return null;
  const account = await accountByTgId(tgId);
  if (!account) return null;
  if (account.playerId) return "Вы уже в лиге — регистрироваться заново не нужно.";
  if (account.status === "pending") return "Ваша анкета уже у организатора. Как решит — напишу сюда.";
  return null;
}

export type RegResult = { replies: Reply[]; step?: RegStep; state: RegState; done?: boolean };

/**
 * Начать анкету. Хендл обязателен: телеграм в анкете — единственный контакт человека, а взять его
 * можно только из апдейта — попросить «напишите свой хендл» значит поверить на слово в том, что и
 * так приезжает от Telegram.
 */
export async function startRegistration(tgId: string | null, username: string | null): Promise<RegResult> {
  const handle = normalizeTelegram(username ?? "");
  if (!tgId || !handle) {
    return {
      replies: [
        {
          text: "У вас не задан телеграм-хендл (@nickname) — без него организатору не с кем связаться. " +
            "Поставьте его в настройках Telegram и напишите мне снова.",
        },
      ],
      state: emptyRegistration(),
      done: true,
    };
  }

  const blocked = await registrationBlock(tgId);
  if (blocked) return { replies: [{ text: blocked }], state: emptyRegistration(), done: true };

  const state = emptyRegistration();
  state.telegram = handle; // спрашивать то, что приехало в апдейте, незачем
  return {
    replies: [
      { text: "Заводим вас в лигу. Десять вопросов — и анкета уйдёт организатору. Прервать — /cancel." },
      askReg(FLOW[0], state),
    ],
    step: FLOW[0],
    state,
  };
}

/** Шаг регистрации. Возвращает состояние наружу — пишет его вызывающий (`tg-quiz.ts`). */
export async function handleRegister(
  step: RegStep,
  state: RegState,
  text: string,
  ctx: { chatId: string; tgId: string | null; username: string | null | undefined },
): Promise<RegResult> {
  if (step === "reg_confirm") {
    if (text === RESTART) {
      const fresh = emptyRegistration();
      fresh.telegram = state.telegram;
      return { replies: [askReg(FLOW[0], fresh)], step: FLOW[0], state: fresh };
    }
    if (text !== SEND) return { replies: [summary(state)], step: "reg_confirm", state };
    return send(state, ctx);
  }

  // Необязательный шаг пропускается кнопкой; пустой ответ на обязательном — повод переспросить.
  if (optional(step) && text === SKIP) {
    remember(step, "", state);
  } else {
    const claim = problem(step, text);
    if (claim) return { replies: [{ text: claim }, askReg(step, state)], step, state };
    remember(step, text, state);
  }

  const next = FLOW[FLOW.indexOf(step) + 1] ?? "reg_confirm";
  return { replies: [askReg(next, state)], step: next, state };
}

/** Отправка: последняя проверка — та же, что у веб-анкеты, и запись в очередь модерации. */
async function send(
  state: RegState,
  ctx: { chatId: string; tgId: string | null; username: string | null | undefined },
): Promise<RegResult> {
  const checked = normalizeApplication(state);
  if (!checked.ok) return { replies: [{ text: `Не выходит отправить: ${checked.error}` }, summary(state)], step: "reg_confirm", state };
  if (!ctx.tgId) return { replies: [{ text: "Не понял, от кого анкета. Напишите /start и попробуйте снова." }], state, done: true };

  const failed = await saveApplication(checked.value, {
    chatId: ctx.chatId,
    tgId: ctx.tgId,
    username: normalizeTelegram(ctx.username ?? ""),
  });
  if (failed) return { replies: [{ text: failed }], state, done: true };

  return {
    replies: [
      {
        text: "Анкета отправлена организатору. Как решит — напишу сюда.\n\n" +
          "Пока ждёте: заявку команды на турнир можно подать здесь же, а состав должен состоять из игроков лиги.",
      },
    ],
    state,
    done: true,
  };
}
