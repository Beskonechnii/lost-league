// Валидатор графа диалога (`BOT-FLOW-PLAN.md`, Э3): что в графе не так и стоит ли из-за этого
// запрещать публикацию. Чистый модуль — ни БД, ни React: его зовёт и клиентский редактор (показать
// список), и серверный экшен публикации (не пустить в эфир).
//
// **Правило входа и выхода** (решено 03.09.2026): у каждой ноды есть входящий переход и заполненный
// выход. Исключения ровно два и по существу: у `start` нет входа, у `end` нет выхода — иначе граф
// нечем начать и нечем кончить.
//
// **Переходная оговорка.** Пока разделы бота не переехали в граф (Э4–Э5), пустой выход означает не
// дыру, а шов: «граф показал кнопку, дальше разбирается старый обработчик» (`run.ts` → `null`).
// Поэтому до Э6 незаполненный выход — предупреждение с такой пометкой, а не ошибка; на Э6 хватит
// перевести `EMPTY_OUT` в `"error"`, и тот же список станет блокирующим.
//
// Предупреждения публикацию не блокируют — иначе дефолтный граф, у которого все кнопки меню ведут
// наружу, нельзя было бы выпустить в эфир.
//
// Разбор ссылок (`ctx.*`, `settings.*`, имена действий) требует реестров, а они живут в серверных
// модулях, которые тянут prisma. Поэтому реестры приезжают аргументом — так же, как подсказки в
// редакторе: страница знает и то и другое, а валидатор остаётся чистым.

import { brokenGraph, portsOf } from "./editor";
import {
  buttonsOf,
  isWaiting,
  sameLabel,
  type BotFlowGraph,
  type FlowCondition,
  type FlowNode,
  type NodeId,
} from "./types";

/** Ошибка блокирует публикацию, предупреждение — нет. */
export type FlowIssueLevel = "error" | "warn";

export type FlowIssue = {
  level: FlowIssueLevel;
  /** К какой ноде претензия; `null` — к графу целиком. По нему редактор подсвечивает карточку. */
  node: NodeId | null;
  /** Ключ выхода (`next`, `else`, `btn:0`), если виноват конкретный выход. */
  port?: string;
  text: string;
};

/** Реестры, без которых часть проверок невозможна. Не передали — проверка молча пропускается. */
export type FlowRegistries = {
  /** Что бывает после `ctx.` (`bot-flow/context.ts`). */
  ctxKeys?: string[];
  /** Что бывает после `settings.` (реестры текстов и таймингов бота). */
  settingKeys?: string[];
  /** Зарегистрированные действия и переменные, которые они кладут (`bot-flow/actions.ts`). */
  actions?: { name: string; provides?: string[] }[];
  /** Зарегистрированные модули — что можно написать в ноде `subflow` (`bot-flow/subflows.ts`). */
  subflows?: { name: string }[];
};

/**
 * Уровень претензии «выход не заполнен». До Э6 — предупреждение: пустой выход это шов со старым
 * обработчиком, а не дыра. На Э6 разделы переедут в граф, шва не останется — здесь встанет `"error"`,
 * и правило «у каждой ноды заполненный выход» начнёт блокировать публикацию.
 */
const EMPTY_OUT: FlowIssueLevel = "warn";

const OUT_HINT =
  EMPTY_OUT === "warn" ? " После Э6, когда разделы переедут в граф, это станет ошибкой." : "";

/** Все `{…}` в тексте — то, что нода собирается подставить. */
const braces = (text: string | null | undefined): string[] =>
  [...(text ?? "").matchAll(/\{([^}]+)\}/g)].map((m) => m[1].trim());

/** Ссылка и то, как она написана: в фигурных скобках или полем условия. */
type Ref = { ref: string; brace: boolean };

/** На какие значения смотрит нода: подстановки в текстах и левые части условий. */
function refsOf(node: FlowNode): Ref[] {
  const out: Ref[] = [];
  const text = (t?: string | null) => braces(t).forEach((ref) => out.push({ ref, brace: true }));
  const cond = (c?: FlowCondition | null) => {
    if (c?.left?.trim()) out.push({ ref: c.left.trim(), brace: false });
  };
  const buttons = () => buttonsOf(node).forEach((b) => cond(b.when));

  switch (node.type) {
    case "message":
    case "menu":
    case "ask":
      text(node.text);
      buttons();
      break;
    case "if":
      cond(node.cond);
      break;
    case "action":
    case "subflow":
      Object.values(node.params ?? {}).forEach(text);
      break;
    case "end":
      text(node.text);
      break;
    default:
      break;
  }
  return out;
}

/** Куда нода передаёт управление. `end` с возвратом в меню шагает на стартовую — это тоже переход. */
function targetsOf(graph: BotFlowGraph, node: FlowNode): NodeId[] {
  const out = portsOf(node)
    .map((p) => p.target)
    .filter((t): t is NodeId => !!t);
  if (node.type === "end" && node.toMenu) out.push(graph.start);
  return out;
}

/** Что означает незаполненный выход у этой ноды — претензию надо объяснять, а не констатировать. */
function emptyOutMeaning(node: FlowNode, portKey: string): string {
  if (portKey.startsWith("btn:") || (node.type === "menu" && portKey === "else")) {
    return "управление уйдёт наружу, старому обработчику (`tg-quiz.ts`).";
  }
  return "разговор оборвётся молча: бот скажет своё и замолчит.";
}

/**
 * Разбор графа. Возвращает всё найденное: ошибки сверху, предупреждения снизу — так список читается
 * как «что чинить сейчас» и «что учесть потом».
 */
export function validateFlow(graph: BotFlowGraph, known: FlowRegistries = {}): FlowIssue[] {
  // Документ не читается — остальные проверки врали бы: они ходят по id и типам нод.
  const broken = brokenGraph(graph);
  if (broken) return [{ level: "error", node: null, text: broken }];

  const issues: FlowIssue[] = [];
  const add = (level: FlowIssueLevel, node: NodeId | null, text: string, port?: string) =>
    issues.push({ level, node, text, port });
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  /* ── Выходы: пустые, битые и особые случаи ноды «вопрос» ─────────────────────────────────── */

  for (const node of graph.nodes) {
    for (const port of portsOf(node)) {
      if (port.target && !byId.has(port.target)) {
        add("error", node.id, `Выход «${port.label}» ведёт на ноду «${port.target}», которой в графе нет.`, port.key);
        continue;
      }
      if (port.target) continue;

      // У вопроса пустое «иначе» значит не дыру, а «жду кнопку — переспрошу тем же вопросом»
      // (`run.ts`). Но если кнопок нет, переспрашивать бот будет вечно: из ноды не выйти.
      if (node.type === "ask" && port.key === "else") {
        if (!buttonsOf(node).length) {
          add(
            "error",
            node.id,
            "Вопрос без кнопок и без выхода «любой другой ответ»: что бы человек ни ответил, бот будет спрашивать снова.",
            port.key,
          );
        }
        continue;
      }
      add(EMPTY_OUT, node.id, `Выход «${port.label}» не заполнен: ${emptyOutMeaning(node, port.key)}${OUT_HINT}`, port.key);
    }
  }

  /* ── Кнопки: подпись это ключ перехода ──────────────────────────────────────────────────── */

  for (const node of graph.nodes) {
    const seen: string[] = [];
    buttonsOf(node).forEach((b, i) => {
      const label = b.label.trim();
      const port = `btn:${i}`;
      if (!label) {
        add("error", node.id, `У кнопки №${i + 1} нет подписи: такую клавиатуру Telegram не покажет.`, port);
        return;
      }
      if (seen.some((s) => sameLabel(s, label))) {
        add("error", node.id, `Две кнопки с подписью «${label}»: ответ приезжает текстом, и различить их нечем.`, port);
        return;
      }
      seen.push(label);
    });
  }

  /* ── Вход: на ноду должен вести переход, и она должна быть достижима ────────────────────── */

  const incoming = new Set<NodeId>();
  for (const node of graph.nodes) for (const t of targetsOf(graph, node)) if (byId.has(t)) incoming.add(t);

  const reachable = new Set<NodeId>([graph.start]);
  const queue: NodeId[] = [graph.start];
  while (queue.length) {
    const node = byId.get(queue.pop() as NodeId);
    if (!node) continue;
    for (const t of targetsOf(graph, node)) {
      if (byId.has(t) && !reachable.has(t)) {
        reachable.add(t);
        queue.push(t);
      }
    }
  }

  for (const node of graph.nodes) {
    // Стартовая нода входа не требует по определению: в неё входят снаружи, из телеграма.
    if (node.id === graph.start) continue;
    if (!incoming.has(node.id)) {
      add(
        "error",
        node.id,
        node.type === "start"
          ? "Вторая нода-вход: диалог начинается не с неё, а переходов сюда нет — попасть в неё нечем."
          : "На ноду не ведёт ни один переход — попасть в неё нечем.",
      );
    } else if (!reachable.has(node.id)) {
      add("error", node.id, "Нода недостижима из стартовой: переходы на неё есть, но сами они из недостижимого куска.");
    }
  }

  /* ── Петли: цикл, в котором бот ни о чём не спрашивает ──────────────────────────────────── */

  // Диалог останавливается только на ждущей ноде (`ask`, `menu`, `subflow`) — она и обрывает разбор.
  // Цикл из одних проходных нод интерпретатор пройдёт до бюджета шагов и оборвёт исключением.
  const looped = new Set<NodeId>();
  const state = new Map<NodeId, 1 | 2>();
  const path: NodeId[] = [];
  const seek = (id: NodeId): void => {
    const node = byId.get(id);
    if (!node || isWaiting(node)) return;
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      for (const step of path.slice(path.indexOf(id))) looped.add(step);
      return;
    }
    state.set(id, 1);
    path.push(id);
    for (const t of targetsOf(graph, node)) seek(t);
    path.pop();
    state.set(id, 2);
  };
  for (const node of graph.nodes) seek(node.id);

  for (const id of looped) {
    add("error", id, "Нода в цикле, где бот ни о чём не спрашивает: диалог не дойдёт до вопроса и оборвётся на 50-м шаге.");
  }

  /* ── Тупики: из ноды не выйти ни в вопрос, ни в конец, ни наружу ────────────────────────── */

  // Пока держится переходная оговорка, пустой выход — законный выход наружу, и настоящий тупик
  // получается только вместе с петлёй (о ней уже сказано выше). Проверка оживёт на Э6, когда
  // пустых выходов не останется: тогда «некуда идти» перестанет быть шумом.
  const escapes = new Map<NodeId, boolean>();
  const canLeave = (id: NodeId): boolean => {
    const memo = escapes.get(id);
    if (memo !== undefined) return memo;
    const node = byId.get(id);
    if (!node) return false;
    // На время разбора считаем ноду тупиковой: так цикл не уходит в бесконечность, а честный
    // выход всё равно найдётся по другой ветке.
    escapes.set(id, false);
    const ports = portsOf(node);
    const out =
      node.type === "end" ||
      isWaiting(node) ||
      (EMPTY_OUT === "warn" && ports.some((p) => !p.target)) ||
      targetsOf(graph, node).some(canLeave);
    escapes.set(id, out);
    return out;
  };
  for (const node of graph.nodes) {
    if (!reachable.has(node.id) || looped.has(node.id)) continue;
    if (!canLeave(node.id)) add("error", node.id, "Тупик: отсюда не добраться ни до вопроса, ни до конца диалога.");
  }

  /* ── Ссылки: переменные, контекст, настройки ────────────────────────────────────────────── */

  const provided = new Set<string>();
  for (const node of graph.nodes) if (node.type === "ask" && node.var.trim()) provided.add(node.var.trim());
  for (const a of known.actions ?? []) for (const v of a.provides ?? []) provided.add(v);

  const ctxKeys = known.ctxKeys ? new Set(known.ctxKeys) : null;
  const settingKeys = known.settingKeys ? new Set(known.settingKeys) : null;

  for (const node of graph.nodes) {
    if (node.type === "ask" && !node.var.trim()) {
      add("error", node.id, "У вопроса не задано имя переменной: ответу человека некуда лечь.");
    }
    for (const { ref, brace } of refsOf(node)) {
      const at = ref.indexOf(".");
      if (at < 0) {
        // Подстановка без области — не ошибка: незнакомая скобка остаётся в тексте как есть
        // (`context.ts`), и опечатка оператора не роняет диалог. А вот условие без области не
        // сработает никогда — это уже ошибка.
        if (brace) add("warn", node.id, `Подстановка {${ref}} не похожа на ссылку — останется в тексте как есть.`);
        else add("error", node.id, `Условие смотрит в «${ref}»: нужна область — vars, ctx или settings.`);
        continue;
      }
      const area = ref.slice(0, at).trim();
      const name = ref.slice(at + 1).trim();
      if (area === "vars") {
        if (!provided.has(name)) {
          add("error", node.id, `Переменная vars.${name} нигде не заполняется: ни один вопрос её не собирает.`);
        }
      } else if (area === "ctx") {
        if (ctxKeys && !ctxKeys.has(name)) add("error", node.id, `Контекста ctx.${name} не существует.`);
      } else if (area === "settings") {
        if (settingKeys && !settingKeys.has(name)) add("error", node.id, `Настройки settings.${name} не существует.`);
      } else {
        add("error", node.id, `Неизвестная область ссылки «${area}»: бывают vars, ctx и settings.`);
      }
    }
  }

  /* ── Ноды, которые зовут код: имя должно быть в реестре ─────────────────────────────────── */

  const actionNames = known.actions ? new Set(known.actions.map((a) => a.name)) : null;
  const subflowNames = known.subflows ? new Set(known.subflows.map((s) => s.name)) : null;
  for (const node of graph.nodes) {
    if (node.type === "action") {
      if (!node.action.trim()) add("error", node.id, "Действие не выбрано: ноде нечего звать.");
      else if (actionNames && !actionNames.has(node.action.trim())) {
        add("error", node.id, `Действие «${node.action}» не зарегистрировано — интерпретатор упадёт на этой ноде.`);
      }
    }
    if (node.type === "subflow") {
      if (!node.flow.trim()) add("error", node.id, "Модуль не выбран: ноде некому отдать разговор.");
      else if (subflowNames && !subflowNames.has(node.flow.trim())) {
        add("error", node.id, `Модуль «${node.flow}» не зарегистрирован — интерпретатор упадёт на этой ноде.`);
      }
    }
  }

  // Ошибки вперёд: чинят их, а предупреждения читают.
  return [...issues.filter((i) => i.level === "error"), ...issues.filter((i) => i.level === "warn")];
}

/** Есть ли то, что блокирует публикацию. */
export const hasErrors = (issues: FlowIssue[]): boolean => issues.some((i) => i.level === "error");

/** Худшая претензия к ноде — канвас метит карточку одним значком, а не списком. */
export function marksByNode(issues: FlowIssue[]): Map<NodeId, FlowIssueLevel> {
  const marks = new Map<NodeId, FlowIssueLevel>();
  for (const issue of issues) {
    if (!issue.node) continue;
    if (issue.level === "error" || !marks.has(issue.node)) marks.set(issue.node, issue.level);
  }
  return marks;
}
