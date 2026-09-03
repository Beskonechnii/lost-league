// Чистая часть редактора графа (`/admin/bot/flow`, Э2): выходы ноды, создание ноды, правка связи.
// Ни БД, ни React — поэтому файл читают и клиентский канвас, и серверный экшен сохранения, и
// будущий валидатор (Э3), которому нужен ровно тот же список выходов.
//
// Зачем это отдельно от `types.ts`. Там описано, из чего граф СОСТОИТ, — это читает интерпретатор.
// Здесь описано, как граф ПРАВЯТ: у каждого типа ноды свой набор полей-переходов (`next`, `else`,
// `ok`/`fail`, кнопки), и редактору нужен один общий способ спросить «куда ведут твои выходы» и
// сказать «этот выход теперь ведёт сюда». Без этого канвас и инспектор знали бы про девять типов
// нод каждый по-своему, и новая нода правилась бы в трёх местах.

import type { BotFlowGraph, FlowButton, FlowNode, FlowNodeType, NodeId } from "./types";

/**
 * Выход ноды — то, из чего на канвасе растёт связь.
 *
 * `key` адресует поле в ноде: `next`, `else`, `then`, `ok`, `fail`, `done`, `cancel`, `target`
 * либо `btn:<номер>` у кнопки. Номер, а не подпись: подпись оператор правит прямо в инспекторе,
 * и связь, привязанная к тексту, рвалась бы на каждой опечатке.
 */
export type FlowPort = {
  key: string;
  label: string;
  target: NodeId | null;
  /** Кнопка на клавиатуре или служебный выход ноды — они по-разному выглядят на канвасе. */
  kind: "button" | "flow";
};

const btnPorts = (buttons: FlowButton[] | undefined): FlowPort[] =>
  (buttons ?? []).map((b, i) => ({
    key: `btn:${i}`,
    label: b.label.trim() || "кнопка без подписи",
    target: b.next,
    kind: "button" as const,
  }));

const flowPort = (key: string, label: string, target: NodeId | null): FlowPort => ({ key, label, target, kind: "flow" });

/** Все выходы ноды сверху вниз — в том же порядке они рисуются на канвасе. */
export function portsOf(node: FlowNode): FlowPort[] {
  switch (node.type) {
    case "start":
      return [flowPort("next", "далее", node.next)];
    case "message":
      return [...btnPorts(node.buttons), flowPort("next", "далее", node.next)];
    case "ask":
      return [...btnPorts(node.buttons), flowPort("else", "любой другой ответ", node.else)];
    case "menu":
      return [...btnPorts(node.buttons), flowPort("else", "непонятый ответ", node.else ?? null)];
    case "if":
      return [flowPort("then", "да", node.then), flowPort("else", "нет", node.else)];
    case "action":
      return [flowPort("ok", "ок", node.ok), flowPort("fail", "ошибка", node.fail)];
    case "subflow":
      return [flowPort("done", "готово", node.done), flowPort("cancel", "отменено", node.cancel)];
    case "goto":
      // Переход в другой флоу (Э7) выхода на канвасе не имеет: цель живёт в чужом документе, и
      // рисовать связь некуда. Валидатор проверяет её отдельно — по имени флоу.
      return node.flow?.trim() ? [] : [flowPort("target", "переход", node.target)];
    case "end":
      return [];
  }
}

/**
 * Перевесить выход ноды. Возвращает НОВУЮ ноду — состояние канваса неизменяемое, иначе React не
 * увидит правку. Чужой ключ (кнопку удалили, пока тянули связь) молча оставляет ноду как была:
 * потерять связь не страшно, уронить редактор — страшно.
 */
export function setPort(node: FlowNode, key: string, target: NodeId | null): FlowNode {
  if (key.startsWith("btn:")) {
    const i = Number(key.slice(4));
    if (node.type !== "menu" && node.type !== "ask" && node.type !== "message") return node;
    const buttons = (node.buttons ?? []).map((b, j) => (j === i ? { ...b, next: target } : b));
    if (node.type === "menu") return { ...node, buttons };
    return { ...node, buttons };
  }
  switch (key) {
    case "next":
      if (node.type === "start") return { ...node, next: target };
      if (node.type === "message") return { ...node, next: target };
      return node;
    case "else":
      if (node.type === "ask") return { ...node, else: target };
      if (node.type === "menu") return { ...node, else: target };
      if (node.type === "if") return { ...node, else: target };
      return node;
    case "then":
      return node.type === "if" ? { ...node, then: target } : node;
    case "ok":
      return node.type === "action" ? { ...node, ok: target } : node;
    case "fail":
      return node.type === "action" ? { ...node, fail: target } : node;
    case "done":
      return node.type === "subflow" ? { ...node, done: target } : node;
    case "cancel":
      return node.type === "subflow" ? { ...node, cancel: target } : node;
    case "target":
      return node.type === "goto" ? { ...node, target } : node;
    default:
      return node;
  }
}

/** Палитра: что можно положить на канвас. Подпись и одна фраза «зачем» — прямо в палитре. */
export const NODE_KINDS: { type: FlowNodeType; label: string; hint: string }[] = [
  { type: "start", label: "Вход", hint: "Точка входа: /start и первое сообщение незнакомца." },
  { type: "message", label: "Реплика", hint: "Бот говорит и идёт дальше, ответа не ждёт." },
  { type: "ask", label: "Вопрос", hint: "Ждёт ответ и кладёт его в переменную." },
  { type: "menu", label: "Меню", hint: "Кнопки: каждая — свой выход." },
  { type: "if", label: "Развилка", hint: "Условие над переменными и контекстом." },
  { type: "action", label: "Действие", hint: "Зовёт функцию из реестра: один экран и сразу назад в граф." },
  { type: "subflow", label: "Модуль", hint: "Отдаёт разговор рукописному модулю на несколько ходов." },
  { type: "goto", label: "Переход", hint: "Чтобы не тянуть длинную связь через весь канвас — или чтобы уйти в другой флоу." },
  { type: "end", label: "Конец", hint: "Попрощаться и вернуть в меню либо закрыть диалог." },
];

/** Свежая нода с полями по умолчанию — сразу пригодная для показа, но пустая по смыслу. */
export function makeNode(type: FlowNodeType, id: NodeId, x: number, y: number): FlowNode {
  const base = { id, x, y };
  switch (type) {
    case "start":
      return { ...base, type, title: "Вход", next: null };
    case "message":
      return { ...base, type, title: "Реплика", text: "", next: null };
    case "ask":
      return { ...base, type, title: "Вопрос", text: "", var: "ответ", buttons: [], check: null, else: null };
    case "menu":
      return { ...base, type, title: "Меню", text: "", buttons: [], else: null };
    case "if":
      return { ...base, type, title: "Развилка", cond: { left: "ctx.известен", op: "=", right: "да" }, then: null, else: null };
    case "action":
      return { ...base, type, title: "Действие", action: "", params: {}, ok: null, fail: null };
    case "subflow":
      return { ...base, type, title: "Модуль", flow: "", params: {}, done: null, cancel: null };
    case "goto":
      return { ...base, type, title: "Переход", target: null, flow: null };
    case "end":
      return { ...base, type, title: "Конец", text: "", toMenu: true };
  }
}

/** Свободный идентификатор вида `ask-3`: имя ноды видно в `BotSession.flowNode`, поэтому читаемое. */
export function freeNodeId(graph: BotFlowGraph, type: FlowNodeType): NodeId {
  const taken = new Set(graph.nodes.map((n) => n.id));
  for (let i = 1; ; i += 1) {
    const id = `${type}-${i}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * Убрать ноду и все связи в неё. Отдельной функцией, потому что «удалить» — это две работы:
 * висящая связь в никуда роняла бы диалог на ровном месте, и валидатор (Э3) на неё бы ругался.
 */
export function removeNode(graph: BotFlowGraph, id: NodeId): BotFlowGraph {
  const nodes = graph.nodes
    .filter((n) => n.id !== id)
    .map((n) => portsOf(n).reduce((acc, p) => (p.target === id ? setPort(acc, p.key, null) : acc), n));
  return { ...graph, nodes };
}

/**
 * Минимальная защита от заведомо битого документа при сохранении. Это НЕ валидатор графа (он на
 * Э3 и будет ругаться на недостижимые ноды, тупики и дубли подписей) — здесь только то, без чего
 * документ вообще нельзя читать: интерпретатор на таком не стартует, а редактор потом не откроется.
 * Возвращает первую беду словами либо `null`.
 */
export function brokenGraph(graph: BotFlowGraph): string | null {
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) return "В графе нет ни одной ноды";
  const known = new Set(NODE_KINDS.map((k) => k.type as string));
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (!node?.id || typeof node.id !== "string") return "У ноды нет идентификатора";
    if (seen.has(node.id)) return `Две ноды с одним идентификатором: ${node.id}`;
    seen.add(node.id);
    if (!known.has(node.type)) return `Неизвестный тип ноды: ${String(node.type)}`;
  }
  if (!graph.start || !seen.has(graph.start)) return "Стартовая нода не найдена в графе";
  return null;
}
