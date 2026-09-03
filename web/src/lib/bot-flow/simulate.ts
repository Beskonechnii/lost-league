// Только сервер: прогон диалога для симулятора редактора (`BOT-FLOW-PLAN.md`, Э3). Тестов в
// проекте нет — симулятор и есть способ проверить граф до живого чата.
//
// **Ничего не пишет.** Диалог идёт поверх того же интерпретатора (`run.ts` → `walk`/`turn`), но
// сессия не сохраняется: где стоит разговор и что уже собрано, помнит экран редактора и присылает
// это следующим вызовом. Значит, ни строки в `BotSession`, ни отправки в Telegram — граф гоняется
// в памяти, а прогон живого человека посреди анкеты не сбивает.
//
// **Граф берётся с экрана, а не из базы.** Проверять нужно ровно то, что оператор сейчас
// нарисовал, — в том числе несохранённый черновик. Соседние флоу при этом берутся из эфира (Э7):
// прогон, дошедший до «вернуть в меню», должен показать то самое меню, которое увидит человек.
//
// Чего симулятор всё-таки касается: `ctx.*` читает настоящую базу (кто написал, знает ли лига,
// открыты ли анкеты) — это чтение, и без него проверка условий была бы игрой в угадайку. По той же
// причине ноды-действия здесь выполняются по-настоящему: иначе прогон показывал бы выдуманные
// экраны. Но им передаётся признак холостого прогона (`ActionInput.dry`), и действие, которое
// пишет в базу, в прогоне не пишет — код входа симулятор не выдаёт.

import { makeScope, type FlowMessage } from "./context";
import { flowOf, matchHook, type FlowSet } from "./router";
import { BUSY, repeat, turn, visible, walk } from "./run";
import { buttonsOf, nodeById, sameLabel, servicePolicyOf, type NodeId } from "./types";

/**
 * Где стоит воображаемый разговор: флоу, нода в нём (`null` — ещё не начат) и собранные переменные.
 * Ключ флоу нужен с Э7: «в меню» и переход `goto` уводят прогон в соседний граф, и следующий ход
 * должен начаться там же, где кончился прошлый.
 */
export type SimState = { flow?: string; node: NodeId | null; vars: Record<string, string> };

/** Одна реплика бота так, как её увидит человек. */
export type SimReply = { text: string; keyboard: string[][] | null };

export type SimStep = {
  replies: SimReply[];
  /** В каком флоу разговор оказался: «в меню» и `goto` уводят прогон в соседний граф (Э7). */
  flow: string;
  /** На какой ноде разговор заснул; `null` — окончен. */
  node: NodeId | null;
  vars: Record<string, string>;
  /** Через какие ноды прошёл этот ход — канвас подсвечивает след. */
  trail: NodeId[];
  /** Нода за ответ не взялась (у кнопки нет перехода, у меню пусто «непонятое») — в живом боте
   *  разговор начался бы заново. С Э6 это дыра в графе: валидатор такой документ не выпускает. */
  outside: boolean;
  /** Ноды, на которой стоял разговор, в графе больше нет (её удалили между шагами). */
  lost: boolean;
  /** Нода упала: в живом боте здесь была бы фраза «что-то пошло не так» и возврат в меню. */
  error?: string;
};

/** Ход симулятора: то же, что сделал бы бот, но без записи сессии и без Telegram. */
export async function simulate(set: FlowSet, edited: string, state: SimState, msg: FlowMessage): Promise<SimStep> {
  // Флоу, в котором стоит разговор: начатый помнит свой (Э7), новый начинается в редактируемом.
  const flow = flowOf(set, state.flow ?? edited) ?? set.main;
  const vars: Record<string, string> = { ...state.vars };
  const scope = makeScope(msg, vars);
  const blank = { replies: [], flow: flow.key, node: state.node, vars, trail: [], outside: false, lost: false };

  try {
    const at = state.node ? nodeById(flow.graph, state.node) : null;
    // Порядок тот же, что у живого бота (`run.ts` → `reply`): своя кнопка ноды, потом перехваты и
    // точки входа (`router.ts`), потом ход ноды. Иначе прогон показывал бы не то, что человек
    // увидит в телеграме.
    const own = at ? (await visible(buttonsOf(at), scope)).some((b) => sameLabel(b.label, msg.text)) : false;
    const hit = own ? null : matchHook(set, flow.key, msg.text);
    if (hit) {
      if (at && !hit.force && servicePolicyOf(at) === "повторить") {
        const again = await repeat(at, scope, null);
        return { ...blank, replies: [{ text: BUSY, keyboard: null }, ...again.map(reply)], trail: [at.id] };
      }
      const said = hit.text ? [{ text: hit.text, keyboard: null }] : [];
      const target = flowOf(set, hit.flow);
      if (!hit.to || !target) return { ...blank, replies: said, node: null };
      const done = await walk(set, target, hit.to, scope, msg, true);
      return { ...blank, replies: [...said, ...done.replies.map(reply)], flow: done.flow.key, node: done.park, trail: done.trail };
    }

    if (state.node === null) {
      const done = await walk(set, flow, flow.graph.start, scope, msg, true);
      return { ...blank, replies: done.replies.map(reply), flow: done.flow.key, node: done.park, trail: done.trail };
    }
    const done = await turn(set, flow, state.node, scope, msg, true);
    if (done.kind === "lost") return { ...blank, node: null, outside: true, lost: true };
    if (done.kind === "outside") return { ...blank, outside: true };
    return { ...blank, replies: done.replies.map(reply), flow: done.flow.key, node: done.park, trail: done.trail };
  } catch (e) {
    return { ...blank, error: e instanceof Error ? e.message : "нода упала" };
  }
}

const reply = (r: { text: string; keyboard?: string[][] | null }): SimReply => ({
  text: r.text,
  keyboard: r.keyboard ?? null,
});
