// Чистая часть многофлоуности (`BOT-FLOW-PLAN.md`, Э7): в какой граф попадает сообщение, если
// человек стоит не там, куда оно ведёт. Ни БД, ни Telegram — только набор загруженных графов и
// текст, поэтому файл читают и интерпретатор (`run.ts`), и симулятор редактора.
//
// **Зачем роутер.** До Э7 флоу был один, и вход у бота был один: `/start` и перехваты `main`.
// Флоу стало несколько, и вопрос «каким сообщением человек попадает именно сюда» стал свойством
// графа (`BotFlowGraph.entry`). Роутер — то место, где эти объявления складываются в один список
// и разбираются тем же порядком, что и перехваты: сперва точное совпадение, потом команда с
// хвостом (`types.ts` → `pickMatch`).
//
// **Порядок списка важен ровно для дублей.** Сначала перехваты флоу, в котором стоит разговор, —
// он ближе всего к человеку; потом перехваты главного флоу (клавиатура первого уровня висит у
// человека всегда, из любого сценария, и «Турниры» посреди онбординга обязаны значить то же, что
// в меню); потом точки входа всех флоу. Точное совпадение при этом сильнее позиции в списке:
// `/start invite` объявлен входом своего флоу и выигрывает у общего `/start` главного.

import type { LoadedFlow } from "./store";
import { pickMatch, type FlowIntercept, type NodeId } from "./types";

/** Куда ведёт сработавшая запись: как перехват, но с указанием флоу — он мог быть и не текущим. */
export type FlowHook = FlowIntercept & { flow: string };

/** Набор живых флоу, в котором работает разговор. Главный — тот, что объявил `entry.main`. */
export type FlowSet = {
  flows: LoadedFlow[];
  /** Главный флоу: `/start`, первое сообщение незнакомца и возврат «в меню». */
  main: LoadedFlow;
};

/**
 * Собрать набор. Главным считаем того, кто объявил `entry.main`; не объявил никто (оператор снял
 * галочку у единственного графа) — берём первый по списку: бот без главного флоу не смог бы
 * ответить вообще никому, а это хуже, чем ответить не тем графом.
 */
export function makeSet(flows: LoadedFlow[]): FlowSet {
  const main = flows.find((f) => f.graph.entry?.main) ?? flows[0];
  return { flows, main };
}

/** Флоу по ключу; нет такого — `null`: звать несуществующий граф нечем. */
export const flowOf = (set: FlowSet, key: string): LoadedFlow | null => set.flows.find((f) => f.key === key) ?? null;

/**
 * Подменить в наборе один флоу — им пользуются и бот (сессия доигрывает на своей версии), и
 * редактор (симулятор гоняет несохранённый граф с экрана, а соседние берёт из эфира).
 */
export const withFlow = (set: FlowSet, flow: LoadedFlow): FlowSet =>
  makeSet([flow, ...set.flows.filter((f) => f.key !== flow.key)]);

/**
 * Точки входа одного флоу в виде записей-перехватов. Команда (`payloads`) — `force`: ею человек
 * приходит по ссылке и вправе бросить начатое, как `/start`. Кнопка — нет: начатую анкету
 * случайное нажатие кнопки, оставшейся на клавиатуре, не роняет (это решает политика ноды).
 */
export function entryHooks(flow: LoadedFlow): FlowHook[] {
  const entry = flow.graph.entry;
  if (!entry) return [];
  const to: NodeId = flow.graph.start;
  const out: FlowHook[] = [];
  for (const payload of entry.payloads ?? []) {
    if (payload.trim()) out.push({ match: `/start ${payload.trim()}`, to, flow: flow.key, force: true });
  }
  for (const label of entry.buttons ?? []) {
    if (label.trim()) out.push({ match: label.trim(), to, flow: flow.key });
  }
  return out;
}

/** Всё, что разбирается раньше ноды, — в том порядке, в каком складывается список (см. шапку). */
export function hooksOf(set: FlowSet, current: string): FlowHook[] {
  const own = flowOf(set, current);
  const mark = (flow: LoadedFlow): FlowHook[] => (flow.graph.intercepts ?? []).map((i) => ({ ...i, flow: flow.key }));
  const out: FlowHook[] = own ? mark(own) : [];
  if (!own || own.key !== set.main.key) out.push(...mark(set.main));
  for (const flow of set.flows) out.push(...entryHooks(flow));
  return out;
}

/** Что ловит этот текст: перехват своего флоу, перехват главного или чужая точка входа. */
export const matchHook = (set: FlowSet, current: string, text: string): FlowHook | null =>
  pickMatch(hooksOf(set, current), text);
