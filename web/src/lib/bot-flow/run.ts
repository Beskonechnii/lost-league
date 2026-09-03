// Только сервер / скрипт: интерпретатор графа диалога. Пришёл текст → взяли ноду, на которой стоит
// сессия → выбрали ребро → шагаем по графу, копя ответы, пока не упрёмся в ждущую ноду (`ask`,
// `menu`, `subflow`) или в конец.
//
// **С Э6 граф — единственный путь бота.** Первый уровень, справки (ноды `action`) и диалоги,
// которые пишут в базу (ноды `subflow` поверх рукописных модулей), ведёт он; то, что раньше
// перехватывалось `if`-ами в начале `handleMessage` — `/start`, `/cancel`, кнопки меню посреди
// анкеты, ответ на предложение соперника, — стало **перехватами уровня флоу** (`intercepts` в
// документе графа). Наружу отдавать больше некому, поэтому у входа `respond` ответ есть всегда.
//
// **С Э7 графов несколько**, у каждого своя точка входа (`BotFlowGraph.entry`): меню, онбординг по
// deeplink'у, сценарий по кнопке из уведомления. Сессия помнит, в каком графе стоит разговор
// (`BotSession.flowKey`), а какой граф ловит сообщение снаружи, считает роутер (`router.ts`).
// Перейти в соседний граф можно нодой `goto` с указанным флоу и концом «вернуть в меню».
//
// **Порядок разбора одного сообщения:**
//   1. собственная кнопка ноды, на которой стоит разговор, — она сильнее всего остального;
//   2. перехват своего флоу, затем перехват главного, затем точка входа любого флоу — если
//      политика ноды их пускает (`ServicePolicy`); `/start`, `/cancel` и вход по ссылке сильнее
//      политики;
//   3. обычный ход ноды;
//   4. нода не взялась (её вырезали из графа, у кнопки нет перехода) — разговор начинается заново.
//
// **Бюджет шагов** — против петли в графе, которую оператор нарисовал мышью. Упёрлись в бюджет,
// не нашли ноду, не нашли действие — это исключение: пишем в лог, человеку отвечаем понятной
// фразой и возвращаем в меню. Молчащий бот хуже бота, который признался.

import type { Reply } from "../telegram";
import { menuKeyboard } from "../tg-menu";
import { prisma } from "../prisma";
import { makeScope, type FlowMessage, type FlowScope } from "./context";
import { FLOW_ACTIONS } from "./actions";
import { FLOW_KEY } from "./default-flow";
import { flowOf, makeSet, matchHook, withFlow, type FlowHook, type FlowSet } from "./router";
import { liveFlows, pinnedFlow, type LoadedFlow } from "./store";
import { FLOW_SUBFLOWS, type SubflowPark, type SubflowResult } from "./subflows";
import {
  buttonsOf,
  nodeById,
  rowsOf,
  sameLabel,
  servicePolicyOf,
  type AskNode,
  type FlowButton,
  type FlowCheck,
  type FlowNode,
  type MenuNode,
  type MessageNode,
  type NodeId,
  type SubflowNode,
} from "./types";

export type { FlowMessage } from "./context";

/**
 * Значение `BotSession.step` у диалога, который ведёт граф. Своего смысла у шага строки больше нет
 * — граф помнит место в `flowNode`, — но признак остаётся: по нему видно строку, оставшуюся от
 * старого квиза (сессии в базе переживают выкладку), и такую строку разбирать нечем.
 */
export const FLOW_STEP = "flow";

/** Сколько нод проходим за одно сообщение, прежде чем счесть граф зациклившимся. */
const STEP_BUDGET = 50;

const TROUBLE = "Что-то пошло не так на моей стороне — вернул в меню. Если повторится, скажите организатору.";

// ── сессия ───────────────────────────────────────────────────────────────────

/**
 * Где стоит диалог: флоу и нода в нём, версия графа (`BotFlow.id`, null — сид из кода), собранные
 * переменные и — если разговор внутри ноды `subflow` — состояние самого модуля (`sub`).
 */
type Park = {
  /** Ключ флоу (Э7). У строк, заведённых до Э7, его нет — там был единственный граф, главный. */
  key: string;
  node: NodeId;
  versionId: number | null;
  vars: Record<string, string>;
  /** Шаг и состояние рукописного модуля, которому отдан разговор. `null` — модуля нет. */
  sub: SubflowPark | null;
};

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
  let sub: SubflowPark | null = null;
  try {
    const state = row.state ? (JSON.parse(row.state) as { sub?: SubflowPark }) : null;
    sub = state?.sub ?? null;
  } catch {
    // Битое состояние модуля — тоже не повод обрывать: модуль скажет «диалог потерялся» и вернёт
    // управление графу по выходу «отменено».
    sub = null;
  }
  return { key: row.flowKey ?? FLOW_KEY, node: row.flowNode, versionId: row.flowVersion, vars, sub };
}

async function savePark(chatId: string, park: Park): Promise<void> {
  const data = {
    step: FLOW_STEP,
    flowKey: park.key,
    // В `state` у графа лежит только состояние рукописного модуля, которому отдан разговор
    // (`subflows.ts`): своих данных у графа тут нет — они в `flowNode`/`flowVars`. Поле общее со
    // старым квизом, но одновременно им пользуется кто-то один: шаг строки принадлежит одному пути.
    state: JSON.stringify(park.sub ? { sub: park.sub } : {}),
    flowNode: park.node,
    flowVersion: park.versionId,
    flowVars: JSON.stringify(park.vars),
  };
  await prisma.botSession.upsert({ where: { chatId }, create: { chatId, ...data }, update: data });
}

/** Снять сессию. С Э6 строка диалога у чата одна и принадлежит графу — забирать её больше не у кого. */
const clearPark = (chatId: string) => prisma.botSession.deleteMany({ where: { chatId } });

// ── реплики ──────────────────────────────────────────────────────────────────

/** Кнопки, которые сейчас видно: у скрытой условием кнопки не работает и переход по ней. */
export async function visible(buttons: FlowButton[], scope: FlowScope): Promise<FlowButton[]> {
  const out: FlowButton[] = [];
  for (const b of buttons) if (await scope.test(b.when ?? null)) out.push(b);
  return out;
}

/**
 * Что бот скажет этой нодой: текст с подстановками и клавиатура из видимых кнопок.
 *
 * `rows` — ряды, которые принесло действие перед этой нодой: список турниров или команд граф не
 * знает заранее, его подписи приходят из базы (`actions.ts`). Они встают НАД собственными кнопками
 * ноды: сперва выбор, потом «назад» и «в меню», как в рукописном разделе.
 */
async function speak(
  node: MessageNode | MenuNode | AskNode,
  scope: FlowScope,
  extra?: string,
  rows?: string[][] | null,
): Promise<Reply> {
  const shown = await visible(buttonsOf(node), scope);
  const text = await scope.render(node.text);
  const keyboard = [...(rows ?? []), ...(shown.length ? rowsOf(shown) : [])];
  return { text: extra ? `${extra}\n\n${text}` : text, keyboard: keyboard.length ? keyboard : null };
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
export type Walk = {
  replies: Reply[];
  park: NodeId | null;
  trail: NodeId[];
  /** Состояние модуля, если заснули внутри ноды `subflow`. `null`/нет — модуля в разговоре нет. */
  sub?: SubflowPark | null;
  /**
   * Во флоу, в котором проход **кончился** (Э7): переход `goto` в другой граф и «в меню» из конца
   * уводят разговор в соседний документ, и записать в сессию надо уже его ключ и его версию.
   */
  flow: LoadedFlow;
};

/**
 * Параметры ноды считаются с подстановками: `турнир={vars.турнир_id}` — нода объявляет, чем кормит
 * действие или модуль, а тот не лезет в переменные наугад.
 */
async function paramsOf(raw: Record<string, string> | undefined, scope: FlowScope): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) out[key] = await scope.render(value);
  return out;
}

/**
 * Ход рукописного модуля: вход в него (`park` не передан) либо очередной шаг внутри.
 *
 * В холостом прогоне (симулятор редактора) модуль не запускается вовсе — `null`. Действия там
 * выполняются по-настоящему, а модули нет, и это не непоследовательность: действие показывает
 * экран и сразу возвращает управление, а модуль забирает разговор себе и на выходе пишет в базу —
 * заявку в очередь, предложение сопернику, ответ на анкету. Прогон, который это делает, не проверка,
 * а вторая жизнь бота.
 */
async function stepSubflow(
  node: SubflowNode,
  scope: FlowScope,
  msg: FlowMessage,
  park: SubflowPark | null,
  dry: boolean,
): Promise<SubflowResult | null> {
  const sub = FLOW_SUBFLOWS[node.flow];
  if (!sub) throw new Error(`модуль «${node.flow}» не зарегистрирован`);
  if (dry) return null;
  const input = { msg, params: await paramsOf(node.params, scope), vars: scope.vars };
  return park ? sub.step({ ...input, park }) : sub.start(input);
}

/** Что показывает симулятор вместо модуля: почему экрана нет и куда граф пойдёт дальше. */
const dryNote = (node: SubflowNode): Reply => ({
  text:
    `[прогон] Здесь разговор забирает модуль «${FLOW_SUBFLOWS[node.flow]?.label ?? node.flow}». ` +
    `В прогоне он не запускается — граф идёт дальше по выходу «готово».`,
  keyboard: null,
});

export async function walk(
  set: FlowSet,
  flow: LoadedFlow,
  from: NodeId | null,
  scope: FlowScope,
  msg: FlowMessage,
  dry = false,
): Promise<Walk> {
  const replies: Reply[] = [];
  let trail: NodeId[] = [];
  // Клавиатура, которую принесло действие: она достаётся ближайшей ждущей ноде. Дальше первого
  // экрана не едет — список турниров не должен всплыть под карточкой команды.
  let rows: string[][] | null = null;
  let id = from;
  let current = flow;

  /** Уйти в соседний граф (Э7): дальше шагаем по его нодам и с его стартовой. */
  const jump = (key: string): NodeId => {
    const next = flowOf(set, key);
    if (!next) throw new Error(`флоу «${key}» не найден`);
    // След — для канваса редактора, а канвас показывает один граф: ноды чужого документа на нём
    // подсветили бы совпавшие по имени. Поэтому при смене графа след начинается заново.
    if (next.key !== current.key) trail = [];
    current = next;
    return next.graph.start;
  };

  for (let step = 0; step < STEP_BUDGET; step++) {
    if (!id) return { replies, park: null, trail, flow: current };
    const node = nodeById(current.graph, id);
    if (!node) throw new Error(`нода «${id}» в графе не найдена`);
    trail.push(node.id);

    switch (node.type) {
      case "start":
        id = node.next;
        break;
      case "goto":
        id = node.flow ? jump(node.flow) : node.target;
        break;
      case "message":
        replies.push(await speak(node, scope, undefined, rows));
        rows = null;
        id = node.next;
        break;
      case "menu":
      case "ask":
        // Ждущая нода: спросили — и заснули до следующего сообщения.
        replies.push(await speak(node, scope, undefined, rows));
        return { replies, park: node.id, trail, flow: current };
      case "if":
        id = (await scope.test(node.cond)) ? node.then : node.else;
        break;
      case "action": {
        const action = FLOW_ACTIONS[node.action];
        if (!action) throw new Error(`действие «${node.action}» не зарегистрировано`);
        const done = await action.run({ msg, params: await paramsOf(node.params, scope), vars: scope.vars, dry });
        replies.push(...(done.replies ?? []));
        Object.assign(scope.vars, done.vars ?? {});
        if (done.keyboard) rows = done.keyboard;
        id = done.ok ? node.ok : node.fail;
        break;
      }
      case "subflow": {
        // Вход в модуль. Клавиатуру, принесённую действием, дальше не тащим: модуль говорит своими
        // репликами и своей клавиатурой, и приклеивать к ним чужой список было бы враньём.
        rows = null;
        const done = await stepSubflow(node, scope, msg, null, dry);
        if (!done) {
          replies.push(dryNote(node));
          id = node.done;
          break;
        }
        replies.push(...done.replies);
        // Модуль взялся за разговор — дальше по графу не идём: следующее сообщение придёт ему.
        if (done.kind === "wait") return { replies, park: node.id, trail, sub: done.park, flow: current };
        id = done.kind === "done" ? node.done : node.cancel;
        break;
      }
      case "end":
        if (node.text) replies.push({ text: await scope.render(node.text), keyboard: null });
        // «Вернуть в меню» — это главный флоу, а не начало своего (Э7): у онбординга по ссылке и
        // ответа сопернику меню нет вовсе, а вернуть человека надо туда же, куда и всех.
        id = node.toMenu ? jump(set.main.key) : null;
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
  /** Нода за ответ не взялась: у кнопки нет перехода, у меню пусто «непонятое». Разговор начнётся
   *  заново — с Э6 отдавать наружу больше некому, а валидатор такой граф в эфир не пускает. */
  | { kind: "outside" }
  /** Ноду вырезали из графа, пока человек на ней стоял: сессию снять, ответ отдать наружу. */
  | { kind: "lost" };

/**
 * Ход графа с ноды, на которой стоит разговор. Ни БД, ни телеграма: сюда же ходит симулятор
 * редактора — он подставляет свой граф и свои переменные, а результат никуда не сохраняет.
 */
export async function turn(
  set: FlowSet,
  flow: LoadedFlow,
  at: NodeId,
  scope: FlowScope,
  msg: FlowMessage,
  dry = false,
  /** Состояние модуля, если разговор стоит на ноде `subflow` (`BotSession.state` → `sub`). */
  sub: SubflowPark | null = null,
): Promise<Turn> {
  const node = nodeById(flow.graph, at);
  if (!node) return { kind: "lost" };

  const hit = (await visible(buttonsOf(node), scope)).find((b) => sameLabel(b.label, msg.text));

  // Кнопка есть, а перехода у неё нет — дыра в графе (валидатор такое не выпускает). Не молчим:
  // разговор начнётся заново.
  if (hit && !hit.next) return { kind: "outside" };

  let next: NodeId | null = null;
  if (hit) {
    if (node.type === "ask") scope.vars[node.var] = hit.label;
    next = hit.next;
  } else if (node.type === "ask") {
    const problem = checkAnswer(node.check, msg.text);
    // Ответ не прошёл проверку — переспрашиваем той же нодой, ничего не записывая. Клавиатуру
    // ноды при этом показываем её собственную: список из действия принесёт то действие, которое
    // на эту ноду ведёт, а здесь мы никуда не шагали.
    if (problem) return { kind: "flow", replies: [await speak(node, scope, problem)], park: node.id, trail: [node.id], flow };
    scope.vars[node.var] = msg.text.trim();
    // Выхода «иначе» нет — значит вопрос ждёт кнопку: повторяем его.
    if (!node.else) return { kind: "flow", replies: [await speak(node, scope)], park: node.id, trail: [node.id], flow };
    next = node.else;
  } else if (node.type === "menu") {
    if (!node.else) return { kind: "outside" };
    next = node.else;
  } else if (node.type === "subflow") {
    const done = await stepSubflow(node, scope, msg, sub, dry);
    // Холостой прогон на ноде модуля не останавливается (`walk` идёт мимо), так что сюда он не
    // приходит; если всё же пришёл — отдаём наружу, чем врать про несделанный ход.
    if (!done) return { kind: "outside" };
    // Модуль ещё ведёт разговор: остаёмся на той же ноде, меняется только его состояние.
    if (done.kind === "wait") {
      return { kind: "flow", replies: done.replies, park: node.id, trail: [node.id], sub: done.park, flow };
    }
    // Модуль отработал — возвращаемся в граф по «готово» либо «отменено», и его прощальные реплики
    // идут перед тем, что скажет граф дальше.
    const rest = await walk(set, flow, done.kind === "done" ? node.done : node.cancel, scope, msg, dry);
    return {
      kind: "flow",
      replies: [...done.replies, ...rest.replies],
      park: rest.park,
      // След чужого графа сюда не приезжает: `walk` начинает его заново при переходе во флоу —
      // а нода модуля осталась в этом. Приклеиваем её только к следу своего же графа.
      trail: rest.flow.key === flow.key ? [node.id, ...rest.trail] : rest.trail,
      sub: rest.sub ?? null,
      flow: rest.flow,
    };
  } else {
    // Нода не ждущая — стоять на ней разговор не мог; отдаём наружу, а не гадаем.
    return { kind: "outside" };
  }

  return { kind: "flow", ...(await walk(set, flow, next, scope, msg, dry)) };
}

/** Записать, где остановились, и отдать ответы. */
async function settle(chatId: string, done: Walk, scope: FlowScope): Promise<Reply[]> {
  // Флоу берём тот, в котором проход КОНЧИЛСЯ: `goto` в соседний граф и «в меню» из конца уводят
  // разговор в другой документ, и записать надо его ключ и его версию (Э7).
  //
  // `sub` пишем ровно тот, что вернул ход: заснули не на модуле — в строке его состояния и не
  // будет, иначе брошенная анкета всплыла бы через неделю на другой ноде.
  if (done.park) {
    await savePark(chatId, {
      key: done.flow.key,
      node: done.park,
      versionId: done.flow.id,
      vars: scope.vars,
      sub: done.sub ?? null,
    });
  } else await clearPark(chatId);
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

/** Что бот отвечает на служебную кнопку там, где начатое бросать нельзя. */
export const BUSY = "Сначала закончим начатое — или наберите /cancel, чтобы бросить.";

/**
 * Повторить вопрос, на котором стоит разговор. Нужен политике «повторить» (`ServicePolicy`): без
 * повтора человек остаётся с ответом на другой вопрос и без понимания, чего от него ждут.
 *
 * У ноды графа вопрос свой, у ноды-модуля его знает только модуль (`Subflow.ask`). Модуль без
 * `ask` молчит — лучше одна фраза «закончим начатое», чем выдуманный вопрос.
 */
export async function repeat(node: FlowNode, scope: FlowScope, sub: SubflowPark | null): Promise<Reply[]> {
  if (node.type === "ask" || node.type === "menu") return [await speak(node, scope)];
  if (node.type === "subflow" && sub) {
    const again = await FLOW_SUBFLOWS[node.flow]?.ask?.(sub);
    if (again) return [again];
  }
  return [];
}

/**
 * Разговор с начала указанной ноды на живом графе. Перехват и непонятый текст начинают его заново,
 * поэтому и версию берут свежую: доигрывать прежнюю человеку больше нечего (в отличие от
 * продолжения — там версия закреплена сессией, `store.ts`).
 */
async function begin(msg: FlowMessage, set: FlowSet, flow: LoadedFlow, from: NodeId | null): Promise<Reply[]> {
  const scope = makeScope(msg, {});
  const at = from && nodeById(flow.graph, from) ? from : flow.graph.start;
  return settle(msg.chatId, await walk(set, flow, at, scope, msg), scope);
}

/**
 * Сработавший перехват или точка входа чужого флоу: сказать своё, бросить начатое и увести туда,
 * куда ведёт. Флоу берём из самой записи (`FlowHook.flow`) — с Э7 она может уводить в соседний граф.
 */
async function fire(msg: FlowMessage, set: FlowSet, hit: FlowHook): Promise<Reply[]> {
  const said: Reply[] = hit.text ? [{ text: hit.text, keyboard: null }] : [];
  const flow = flowOf(set, hit.flow);
  if (!hit.to || !flow) {
    await clearPark(msg.chatId);
    return said;
  }
  return [...said, ...(await begin(msg, set, flow, hit.to))];
}

/**
 * Ответ бота на одно сообщение. Единственный вход: старого обработчика за графом больше нет,
 * поэтому ответ есть всегда — даже если нода упала (`guard` вернёт извинение и меню).
 */
export async function respond(msg: FlowMessage): Promise<Reply[]> {
  return (await guard(msg.chatId, () => reply(msg))) ?? [];
}

async function reply(msg: FlowMessage): Promise<Reply[]> {
  const park = await loadPark(msg.chatId);
  // Живой набор графов целиком (Э7): роутеру нужны точки входа ВСЕХ флоу — `/start invite` и
  // кнопка из уведомления обязаны попадать куда объявлено, где бы человек ни стоял.
  const live = makeSet(await liveFlows());
  // Версия закрепляется ровно на то время, пока разговор держит МОДУЛЬ (`park.sub`): у анкеты,
  // регистрации и заказа встречи наполовину введённые данные живут в состоянии самого модуля, и
  // подмена графа под ними — это и есть «выбросить человека из середины» (`DECISIONS`, 03.09).
  //
  // Раньше закреплялась любая стоянка, а стоянка есть всегда: главное меню — тоже ждущая нода.
  // Человек, стоявший на экране, оставался на своей версии навсегда, и публикация до него просто
  // не доезжала — «в эфир вышло, а в боте ничего не поменялось». Нода на живом графе ищется по
  // тому же id; не нашлась (её вырезали) — разговор начинается заново, это ниже.
  const set = park?.versionId && park.sub ? withFlow(live, await pinnedFlow(park.versionId, park.key)) : live;
  const flow = park ? flowOf(set, park.key) : null;
  const node = park && flow ? nodeById(flow.graph, park.node) : null;
  const scope = makeScope(msg, park?.vars ?? {});

  // Собственная кнопка ноды сильнее перехвата: «Турниры» на экране турнира обязана вести туда,
  // куда нарисована связь, а не туда, куда та же подпись уводит с первого уровня.
  const own = node ? (await visible(buttonsOf(node), scope)).some((b) => sameLabel(b.label, msg.text)) : false;
  const hit = own ? null : matchHook(set, flow?.key ?? set.main.key, msg.text);

  if (hit) {
    // Нода велела начатое не бросать — отвечаем и повторяем её вопрос. `/start`, `/cancel` и вход
    // по ссылке сильнее: ими человек и бросает начатое, другого способа выйти у него нет.
    if (node && !hit.force && servicePolicyOf(node) === "повторить") {
      return [{ text: BUSY, keyboard: null }, ...(await repeat(node, scope, park?.sub ?? null))];
    }
    // Перехват начинает разговор заново — и на живых версиях: доигрывать прежнюю уже нечего.
    return fire(msg, live, hit);
  }

  if (node && flow) {
    const done = await turn(set, flow, park!.node, scope, msg, false, park!.sub);
    if (done.kind === "flow") return settle(msg.chatId, done, scope);
    // Нода не взялась: её вырезали из графа, пока человек стоял на ней, либо у кнопки нет перехода
    // (с Э6 это уже ошибка валидатора). Начинаем разговор заново, а не молчим.
  }

  return begin(msg, live, live.main, null);
}
