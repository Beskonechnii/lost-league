// Чистая часть нодового флоу бота: из чего состоит граф диалога. Ни БД, ни Telegram — только типы
// и мелкие проверки над ними, поэтому файл читают и интерпретатор (`run.ts`), и будущий редактор
// (`BOT-FLOW-PLAN.md`, Э2), и валидатор (Э3).
//
// **Граф управляет навигацией, а не бизнес-логикой.** Нода решает, что бот скажет, какие кнопки
// покажет, куда шагнёт и какие переменные накопит. Тяжёлое (регистрация в лиге, заказ встречи,
// выдача кода входа) остаётся в TS и подключается нодами `action` и `subflow` — с объявленными
// входами и выходами. Полноценный визуальный язык программирования не строим.
//
// **Ключ перехода — текст кнопки.** Клавиатура у бота reply, а не inline: ответ приезжает обычным
// сообщением. Значит ребро подписано ровно тем, что написано на кнопке, — и одинаковые подписи в
// одной ноде это ошибка графа (проверит валидатор Э3), а не мелочь.

/** Идентификатор ноды. Строкой, а не числом: он же лежит в `BotSession.flowNode`. */
export type NodeId = string;

/**
 * Ссылка на значение: `vars.ник`, `ctx.известен`, `settings.menu`. Три области различаются именно
 * префиксом — `vars` собрано этим диалогом, `ctx` вычислено по сообщению (только чтение),
 * `settings` взято из нынешних реестров текстов и таймингов (`quiz-config.ts`, `bot-settings.ts`).
 */
export type FlowRef = string;

/** Что сравниваем. `есть`/`нет` — про пустоту значения, остальное — про само значение. */
export type FlowOp = "=" | "≠" | ">" | "<" | "есть" | "нет";

/** Условие над переменными: им ветвится нода `if` и прячется кнопка. */
export type FlowCondition = {
  left: FlowRef;
  op: FlowOp;
  /** С чем сравниваем. У `есть`/`нет` не нужен. */
  right?: string;
};

/**
 * Кнопка на клавиатуре — она же ребро графа.
 *
 * `next: null` — кнопка показывается, но переход по ней граф не описывает: управление уходит
 * наружу, старому обработчику (`tg-quiz.ts`). Так первый уровень меню живёт в графе до того, как
 * разделы переедут в него нодами (Э4–Э5), и ни одна кнопка по дороге не ломается.
 */
export type FlowButton = {
  label: string;
  next: NodeId | null;
  /** Показывать кнопку, только если условие верно. Нет условия — показываем всегда. */
  when?: FlowCondition | null;
  /** Номер строки на клавиатуре: кнопки с одним номером встают в ряд. Нет номера — своя строка. */
  row?: number;
};

/** Проверка ответа у ноды `ask`. `regex` — своё выражение оператора, остальное — готовые виды. */
export type FlowCheck = {
  kind: "любой" | "число" | "ссылка" | "телеграм" | "regex";
  pattern?: string;
  /** Что сказать, когда ответ не прошёл. Пусто — скажем общей фразой. */
  message?: string;
};

/** Общее у всех нод: id и место на канвасе редактора (Э2). */
type NodeBase = {
  id: NodeId;
  /** Координаты на канвасе. Интерпретатору не нужны, но живут в том же документе. */
  x?: number;
  y?: number;
  /** Подпись ноды в редакторе — человеку, а не боту. */
  title?: string;
};

/** Точка входа. `payload` — значение deeplink'а (`?start=invite`), пусто — обычный /start. */
export type StartNode = NodeBase & { type: "start"; payload?: string | null; next: NodeId | null };

/** Реплика и клавиатура. Ответа не ждёт — шагает дальше сразу. */
export type MessageNode = NodeBase & {
  type: "message";
  text: string;
  buttons?: FlowButton[];
  next: NodeId | null;
};

/** Вопрос: ждёт ответ, кладёт его в переменную `vars.<var>`. */
export type AskNode = NodeBase & {
  type: "ask";
  text: string;
  /** Имя переменной без префикса: `ник` → `vars.ник`. */
  var: string;
  /** Варианты кнопками; у каждого свой выход. Пусто — свободный ответ. */
  buttons?: FlowButton[];
  check?: FlowCheck | null;
  /** Куда идти с любым другим ответом. `null` — переспросить этой же нодой. */
  else: NodeId | null;
};

/** Набор кнопок с именованными выходами — частный случай `ask` без переменной. */
export type MenuNode = NodeBase & {
  type: "menu";
  text: string;
  buttons: FlowButton[];
  /** Куда идти с непонятым ответом. `null` — отдать наружу, старому обработчику. */
  else?: NodeId | null;
};

/** Развилка по условию. */
export type IfNode = NodeBase & { type: "if"; cond: FlowCondition; then: NodeId | null; else: NodeId | null };

/** Вызов зарегистрированной TS-функции (`actions.ts`). Выходы — `ок` и `ошибка`. */
export type ActionNode = NodeBase & {
  type: "action";
  action: string;
  params?: Record<string, string>;
  ok: NodeId | null;
  fail: NodeId | null;
};

/** Передача управления рукописному модулю целиком, пока тот не скажет `done` (Э5). */
export type SubflowNode = NodeBase & { type: "subflow"; flow: string; done: NodeId | null; cancel: NodeId | null };

/** Переход. Отдельной нодой — чтобы длинную связь на канвасе можно было не тянуть через весь экран. */
export type GotoNode = NodeBase & { type: "goto"; target: NodeId | null };

/** Конец диалога: сказать что-то на прощание и либо вернуть в меню, либо молча закрыть. */
export type EndNode = NodeBase & { type: "end"; text?: string | null; toMenu?: boolean };

export type FlowNode =
  | StartNode
  | MessageNode
  | AskNode
  | MenuNode
  | IfNode
  | ActionNode
  | SubflowNode
  | GotoNode
  | EndNode;

export type FlowNodeType = FlowNode["type"];

/**
 * Граф целиком — то, что лежит JSON'ом в `BotFlow.graph`.
 *
 * `format` — версия формата документа, а не версия графа оператора (та живёт номером строки в БД).
 * Понадобится, когда набор нод поедет: старый документ надо будет прочитать, а не отвергнуть.
 */
export type BotFlowGraph = {
  format: 1;
  /** Какой это флоу; до Э7 единственный — `main`. */
  key: string;
  /** С какой ноды начинается диалог. */
  start: NodeId;
  nodes: FlowNode[];
};

/** Ноды, которые ждут ответа человека: на них диалог останавливается и засыпает в сессии. */
const WAITING: ReadonlySet<FlowNodeType> = new Set<FlowNodeType>(["ask", "menu", "subflow"]);

export const isWaiting = (node: FlowNode): boolean => WAITING.has(node.type);

export const nodeById = (graph: BotFlowGraph, id: NodeId | null | undefined): FlowNode | null =>
  (id ? graph.nodes.find((n) => n.id === id) : null) ?? null;

/** Кнопки ноды — у тех типов, где они бывают. Остальным клавиатуру рисовать нечем. */
export function buttonsOf(node: FlowNode): FlowButton[] {
  if (node.type === "menu") return node.buttons;
  if (node.type === "ask" || node.type === "message") return node.buttons ?? [];
  return [];
}

/**
 * Клавиатура из уже отобранных (видимых) кнопок. Кнопки с одинаковым `row` встают в один ряд —
 * порядок рядов тот, в каком номера впервые встретились; кнопка без номера занимает строку одна.
 * Пусто — `null`: Telegram держит последнюю показанную клавиатуру до отмены, и «нет кнопок» надо
 * сказать явно.
 */
export function rowsOf(buttons: FlowButton[]): string[][] {
  const rows: string[][] = [];
  const byNumber = new Map<number, string[]>();
  for (const b of buttons) {
    if (b.row === undefined || b.row === null) {
      rows.push([b.label]);
      continue;
    }
    const row = byNumber.get(b.row);
    if (row) {
      row.push(b.label);
      continue;
    }
    const fresh = [b.label];
    byNumber.set(b.row, fresh);
    rows.push(fresh);
  }
  return rows;
}

/**
 * Сравнение текста кнопки с тем, что приехало от человека. Регистр и лишние пробелы прощаем: ответ
 * приходит обычным сообщением, и человек мог набрать его руками, а не нажать кнопку.
 */
export const sameLabel = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Разбор JSON-документа графа. `null` — документ не читается: звать бота на нём нельзя. */
export function parseGraph(raw: string): BotFlowGraph | null {
  try {
    const value = JSON.parse(raw) as BotFlowGraph;
    if (!value || typeof value !== "object" || !Array.isArray(value.nodes) || !value.start) return null;
    return value;
  } catch {
    return null;
  }
}
