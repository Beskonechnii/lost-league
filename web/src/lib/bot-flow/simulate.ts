// Только сервер: прогон диалога для симулятора редактора (`BOT-FLOW-PLAN.md`, Э3). Тестов в
// проекте нет — симулятор и есть способ проверить граф до живого чата.
//
// **Ничего не пишет.** Диалог идёт поверх того же интерпретатора (`run.ts` → `walk`/`turn`), но
// сессия не сохраняется: где стоит разговор и что уже собрано, помнит экран редактора и присылает
// это следующим вызовом. Значит, ни строки в `BotSession`, ни отправки в Telegram — граф гоняется
// в памяти, а прогон живого человека посреди анкеты не сбивает.
//
// **Граф берётся с экрана, а не из базы.** Проверять нужно ровно то, что оператор сейчас
// нарисовал, — в том числе несохранённый черновик.
//
// Чего симулятор всё-таки касается: `ctx.*` читает настоящую базу (кто написал, знает ли лига,
// открыты ли анкеты) — это чтение, и без него проверка условий была бы игрой в угадайку. Когда на
// Э4 в реестре появятся действия, их ноды здесь будут выполняться по-настоящему: реестр пока пуст,
// но нодам-действиям понадобится уговор о холостом прогоне.

import { makeScope, type FlowMessage } from "./context";
import { turn, walk } from "./run";
import type { LoadedFlow } from "./store";
import type { BotFlowGraph, NodeId } from "./types";

/** Где стоит воображаемый разговор: нода (`null` — ещё не начат) и собранные переменные. */
export type SimState = { node: NodeId | null; vars: Record<string, string> };

/** Одна реплика бота так, как её увидит человек. */
export type SimReply = { text: string; keyboard: string[][] | null };

export type SimStep = {
  replies: SimReply[];
  /** На какой ноде разговор заснул; `null` — окончен. */
  node: NodeId | null;
  vars: Record<string, string>;
  /** Через какие ноды прошёл этот ход — канвас подсвечивает след. */
  trail: NodeId[];
  /** Граф отдал ответ наружу, старому обработчику: дальше сегодня работает `tg-quiz.ts`. */
  outside: boolean;
  /** Ноды, на которой стоял разговор, в графе больше нет (её удалили между шагами). */
  lost: boolean;
  /** Нода упала: в живом боте здесь была бы фраза «что-то пошло не так» и возврат в меню. */
  error?: string;
};

/** Ход симулятора: то же, что сделал бы бот, но без записи сессии и без Telegram. */
export async function simulate(graph: BotFlowGraph, state: SimState, msg: FlowMessage): Promise<SimStep> {
  const flow: LoadedFlow = { id: null, version: 0, graph };
  const vars: Record<string, string> = { ...state.vars };
  const scope = makeScope(msg, vars);
  const blank = { replies: [], node: state.node, vars, trail: [], outside: false, lost: false };

  try {
    if (state.node === null) {
      const done = await walk(flow, graph.start, scope, msg);
      return { ...blank, replies: done.replies.map(reply), node: done.park, trail: done.trail };
    }
    const done = await turn(flow, state.node, scope, msg);
    if (done.kind === "lost") return { ...blank, node: null, outside: true, lost: true };
    if (done.kind === "outside") return { ...blank, outside: true };
    return { ...blank, replies: done.replies.map(reply), node: done.park, trail: done.trail };
  } catch (e) {
    return { ...blank, error: e instanceof Error ? e.message : "нода упала" };
  }
}

const reply = (r: { text: string; keyboard?: string[][] | null }): SimReply => ({
  text: r.text,
  keyboard: r.keyboard ?? null,
});
