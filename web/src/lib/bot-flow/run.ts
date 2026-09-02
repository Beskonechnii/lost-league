// Только сервер / скрипт: интерпретатор графа диалога. Пришёл текст → взяли ноду, на которой стоит
// сессия → выбрали ребро → шагаем по графу, копя ответы, пока не упрёмся в ждущую ноду (`ask`,
// `menu`, `subflow`) или в конец.
//
// **Наружу можно вернуть `null`** — «граф про это ничего не знает». Пока флоу ведёт только первый
// уровень меню (`default-flow.ts`), всё остальное разбирает рукописный `tg-quiz.ts`, и `null` —
// это шов между ними. По мере переезда разделов (Э4–Э5) `null` будет возвращаться всё реже, а
// после Э6 исчезнет вместе со старым путём.
//
// **Бюджет шагов** — против петли в графе, которую оператор нарисовал мышью. Упёрлись в бюджет,
// не нашли ноду, не нашли действие — это исключение: пишем в лог, человеку отвечаем понятной
// фразой и возвращаем в меню. Молчащий бот хуже бота, который признался.

import type { Reply } from "../telegram";
import { menuKeyboard } from "../tg-menu";
import { prisma } from "../prisma";
import { makeScope, type FlowMessage, type FlowScope } from "./context";
import { FLOW_ACTIONS } from "./actions";
import { pinnedFlow, liveFlow, type LoadedFlow } from "./store";
import {
  buttonsOf,
  nodeById,
  rowsOf,
  sameLabel,
  type AskNode,
  type FlowButton,
  type FlowCheck,
  type MenuNode,
  type MessageNode,
  type NodeId,
} from "./types";

export type { FlowMessage } from "./context";

/**
 * Ведёт ли граф первый уровень бота. Выключен — бот работает ровно как раньше, весь код ниже мёртв;
 * включается переменной окружения `BOT_FLOW=1` у процесса бота (`scripts/bot.ts`) и у сайта.
 *
 * Переменной, а не константой в коде: бот — долгоживущий процесс на ноутбуке, и «попробовать и
 * вернуть как было» должно стоить перезапуска, а не правки исходника (`BOT-FLOW-PLAN.md`, Э1).
 */
export const BOT_FLOW: boolean = process.env.BOT_FLOW === "1";

/**
 * Значение `BotSession.step` у диалога, который ведёт граф. Хранилище у старого и нового пути одно,
 * и старый обработчик по этому признаку понимает, что строка не его (`tg-quiz.ts` → `load`).
 */
export const FLOW_STEP = "flow";

/** Сколько нод проходим за одно сообщение, прежде чем счесть граф зациклившимся. */
const STEP_BUDGET = 50;

const TROUBLE = "Что-то пошло не так на моей стороне — вернул в меню. Если повторится, скажите организатору.";

// ── сессия ───────────────────────────────────────────────────────────────────

/** Где стоит диалог: нода, версия графа (`BotFlow.id`, null — сид из кода) и собранные переменные. */
type Park = { node: NodeId; versionId: number | null; vars: Record<string, string> };

async function loadPark(chatId: string): Promise<Park | null> {
  const row = await prisma.botSession.findUnique({ where: { chatId } });
  // Строка есть, но шаг не наш — её ведёт старый квиз: он же мог затереть поля флоу своим upsert'ом.
  if (!row || row.step !== FLOW_STEP || !row.flowNode) return null;
  let vars: Record<string, string> = {};
  try {
    vars = row.flowVars ? (JSON.parse(row.flowVars) as Record<string, string>) : {};
  } catch {
    // Битые переменные — не повод обрывать разговор: продолжим с пустыми.
    vars = {};
  }
  return { node: row.flowNode, versionId: row.flowVersion, vars };
}

async function savePark(chatId: string, park: Park): Promise<void> {
  const data = {
    step: FLOW_STEP,
    // `state` у графа не используется — он у старого квиза; кладём пустой объект, чтобы строка была
    // читаемой обоими путями.
    state: "{}",
    flowNode: park.node,
    flowVersion: park.versionId,
    flowVars: JSON.stringify(park.vars),
  };
  await prisma.botSession.upsert({ where: { chatId }, create: { chatId, ...data }, update: data });
}

/** Снять сессию — только свою: строку начатого квиза граф не трогает. */
const clearPark = (chatId: string) => prisma.botSession.deleteMany({ where: { chatId, step: FLOW_STEP } });

// ── реплики ──────────────────────────────────────────────────────────────────

/** Кнопки, которые сейчас видно: у скрытой условием кнопки не работает и переход по ней. */
async function visible(buttons: FlowButton[], scope: FlowScope): Promise<FlowButton[]> {
  const out: FlowButton[] = [];
  for (const b of buttons) if (await scope.test(b.when ?? null)) out.push(b);
  return out;
}

/** Что бот скажет этой нодой: текст с подстановками и клавиатура из видимых кнопок. */
async function speak(node: MessageNode | MenuNode | AskNode, scope: FlowScope, extra?: string): Promise<Reply> {
  const shown = await visible(buttonsOf(node), scope);
  const text = await scope.render(node.text);
  return { text: extra ? `${extra}\n\n${text}` : text, keyboard: shown.length ? rowsOf(shown) : null };
}

/**
 * Проверка свободного ответа. Возвращает претензию или `null`, если ответ годится. Сломанное
 * выражение оператора считаем отсутствующей проверкой: диалог из-за опечатки в админке стоять не должен.
 */
function checkAnswer(check: FlowCheck | null | undefined, text: string): string | null {
  const value = text.trim();
  const fail = (why: string) => check?.message?.trim() || why;
  switch (check?.kind) {
    case "число":
      return /^-?\d+$/.test(value) ? null : fail("Нужно число.");
    case "ссылка":
      return /^https?:\/\/\S+$/i.test(value) || /^[^\s]+\.[^\s]{2,}$/.test(value) ? null : fail("Нужна ссылка.");
    case "телеграм":
      return /^@?[a-z0-9_]{3,}$/i.test(value) ? null : fail("Нужен хендл вида @nickname.");
    case "regex": {
      try {
        return new RegExp(check.pattern ?? "").test(value) ? null : fail("Так не подходит, попробуйте иначе.");
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}

// ── ход по графу ─────────────────────────────────────────────────────────────

/**
 * Чем кончился проход: что сказать, на какой ноде заснуть (`null` — диалог окончен) и через что
 * прошли по дороге. `trail` интерпретатору не нужен — его читает симулятор редактора (Э3), чтобы
 * подсветить на канвасе пройденный путь.
 */
export type Walk = { replies: Reply[]; park: NodeId | null; trail: NodeId[] };

export async function walk(flow: LoadedFlow, from: NodeId | null, scope: FlowScope, msg: FlowMessage): Promise<Walk> {
  const replies: Reply[] = [];
  const trail: NodeId[] = [];
  let id = from;

  for (let step = 0; step < STEP_BUDGET; step++) {
    if (!id) return { replies, park: null, trail };
    const node = nodeById(flow.graph, id);
    if (!node) throw new Error(`нода «${id}» в графе не найдена`);
    trail.push(node.id);

    switch (node.type) {
      case "start":
        id = node.next;
        break;
      case "goto":
        id = node.target;
        break;
      case "message":
        replies.push(await speak(node, scope));
        id = node.next;
        break;
      case "menu":
      case "ask":
        // Ждущая нода: спросили — и заснули до следующего сообщения.
        replies.push(await speak(node, scope));
        return { replies, park: node.id, trail };
      case "if":
        id = (await scope.test(node.cond)) ? node.then : node.else;
        break;
      case "action": {
        const action = FLOW_ACTIONS[node.action];
        if (!action) throw new Error(`действие «${node.action}» не зарегистрировано`);
        const done = await action.run({ msg, params: node.params ?? {}, vars: scope.vars });
        replies.push(...(done.replies ?? []));
        Object.assign(scope.vars, done.vars ?? {});
        id = done.ok ? node.ok : node.fail;
        break;
      }
      case "subflow":
        // Обёртка над рукописными модулями — Э5; до неё такой ноды в графе быть не должно.
        throw new Error(`нода subflow («${node.flow}») пока не поддерживается`);
      case "end":
        if (node.text) replies.push({ text: await scope.render(node.text), keyboard: null });
        id = node.toMenu ? flow.graph.start : null;
        break;
    }
  }
  throw new Error(`граф не дошёл до ждущей ноды за ${STEP_BUDGET} шагов — похоже на петлю`);
}

/**
 * Чем кончился ход графа по одному сообщению.
 *
 * Отдельным типом, потому что ход и его последствия — разные работы: записать сессию и отправить в
 * телеграм умеет бот, а симулятор редактора (Э3) гоняет тот же ход в памяти и не пишет никуда.
 */
export type Turn =
  | ({ kind: "flow" } & Walk)
  /** Граф про этот ответ ничего не знает: разбирается старый обработчик, сессия остаётся как была. */
  | { kind: "outside" }
  /** Ноду вырезали из графа, пока человек на ней стоял: сессию снять, ответ отдать наружу. */
  | { kind: "lost" };

/**
 * Ход графа с ноды, на которой стоит разговор. Ни БД, ни телеграма: сюда же ходит симулятор
 * редактора — он подставляет свой граф и свои переменные, а результат никуда не сохраняет.
 */
export async function turn(flow: LoadedFlow, at: NodeId, scope: FlowScope, msg: FlowMessage): Promise<Turn> {
  const node = nodeById(flow.graph, at);
  if (!node) return { kind: "lost" };

  const hit = (await visible(buttonsOf(node), scope)).find((b) => sameLabel(b.label, msg.text));

  // Кнопка есть, а перехода у неё нет — граф её только показал: дальше разбирается старый код.
  if (hit && !hit.next) return { kind: "outside" };

  let next: NodeId | null = null;
  if (hit) {
    if (node.type === "ask") scope.vars[node.var] = hit.label;
    next = hit.next;
  } else if (node.type === "ask") {
    const problem = checkAnswer(node.check, msg.text);
    // Ответ не прошёл проверку — переспрашиваем той же нодой, ничего не записывая.
    if (problem) return { kind: "flow", replies: [await speak(node, scope, problem)], park: node.id, trail: [node.id] };
    scope.vars[node.var] = msg.text.trim();
    // Выхода «иначе» нет — значит вопрос ждёт кнопку: повторяем его.
    if (!node.else) return { kind: "flow", replies: [await speak(node, scope)], park: node.id, trail: [node.id] };
    next = node.else;
  } else if (node.type === "menu") {
    if (!node.else) return { kind: "outside" };
    next = node.else;
  } else {
    // Ждём субфлоу (Э5) — его ответ придёт не отсюда.
    return { kind: "outside" };
  }

  return { kind: "flow", ...(await walk(flow, next, scope, msg)) };
}

/** Записать, где остановились, и отдать ответы. */
async function settle(chatId: string, flow: LoadedFlow, done: Walk, scope: FlowScope): Promise<Reply[]> {
  if (done.park) await savePark(chatId, { node: done.park, versionId: flow.id, vars: scope.vars });
  else await clearPark(chatId);
  return done.replies;
}

/** Падение ноды не должно оставлять человека без ответа: пишем в лог, отвечаем и возвращаем в меню. */
async function guard(chatId: string, run: () => Promise<Reply[] | null>): Promise<Reply[] | null> {
  try {
    return await run();
  } catch (error) {
    console.error(`[bot-flow] ${chatId}:`, error);
    await clearPark(chatId).catch(() => {});
    const keyboard = await menuKeyboard().catch(() => null);
    return [{ text: TROUBLE, keyboard }];
  }
}

// ── вход ─────────────────────────────────────────────────────────────────────

/** Разговор с начала графа. Берём версию, которая в эфире: новый диалог идёт на свежем графе. */
async function begin(msg: FlowMessage): Promise<Reply[]> {
  const flow = await liveFlow();
  const scope = makeScope(msg, {});
  return settle(msg.chatId, flow, await walk(flow, flow.graph.start, scope, msg), scope);
}

/**
 * Начать диалог заново — это `/start`: что бы человек ни делал до того, разговор начинается с
 * первой ноды.
 */
export function startFlow(msg: FlowMessage): Promise<Reply[] | null> {
  return guard(msg.chatId, () => begin(msg));
}

/**
 * Ответ графа на очередное сообщение: продолжить начатое, а если начатого нет — начать с первой
 * ноды (сегодня бот на непонятый текст отвечает ровно меню).
 *
 * `null` — граф не знает, что делать с этим ответом: разбирается старый обработчик (`tg-quiz.ts`),
 * а сессия остаётся там же, где стояла.
 *
 * Версию берём ту, на которой диалог начался (`BotSession.flowVersion`): публикация новой не должна
 * выбрасывать человека из середины анкеты.
 */
export function flowReply(msg: FlowMessage): Promise<Reply[] | null> {
  return guard(msg.chatId, async () => {
    const park = await loadPark(msg.chatId);
    if (!park) return begin(msg);

    const flow = await pinnedFlow(park.versionId);
    const scope = makeScope(msg, park.vars);
    const done = await turn(flow, park.node, scope, msg);

    // Ноду вырезали из графа, пока человек на ней стоял. Начинать за него новый диалог не будем —
    // отдаём наружу и снимаем сессию: следующее сообщение начнётся с меню.
    if (done.kind === "lost") {
      await clearPark(msg.chatId);
      return null;
    }
    if (done.kind === "outside") return null;
    return settle(msg.chatId, flow, done, scope);
  });
}
