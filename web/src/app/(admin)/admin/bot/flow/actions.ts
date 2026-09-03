"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { blankFlow, defaultFlow } from "@/lib/bot-flow/default-flow";
import { brokenGraph } from "@/lib/bot-flow/editor";
import { flowNeighbours, flowRegistries } from "@/lib/bot-flow/registries";
import { makeSet, withFlow } from "@/lib/bot-flow/router";
import { simulate, type SimState, type SimStep } from "@/lib/bot-flow/simulate";
import { copyToDraft, liveFlow, liveFlows, publishVersion, saveDraft } from "@/lib/bot-flow/store";
import { validateFlow, type FlowIssue } from "@/lib/bot-flow/validate";
import { parseGraph, type BotFlowGraph } from "@/lib/bot-flow/types";

// Запись графа диалога бота. Право проверяется здесь, у самой записи, а не только на странице:
// страницу можно и не открывать, а отрисована она могла быть со старыми правами. Право то же, что
// у /admin/bot — отдельного у бота нет.
//
// Экшены принимают аргументы, а не FormData: редактор — живой канвас, граф лежит в состоянии
// клиента целиком, и заворачивать его в скрытое поле формы значило бы держать его в двух местах.
//
// **Что проверяется когда.** У черновика — только читаемость документа (`brokenGraph`): черновик на
// то и черновик, что в нём работа не доделана, и запрещать сохранять недорисованный граф значило бы
// заставлять держать его в голове. У публикации — весь валидатор (`bot-flow/validate.ts`): ошибки
// не пускают в эфир, предупреждения (пустой выход «наружу», см. Э6) — пускают.
//
// Откат — та же публикация, той же проверкой: версия уезжает в эфир, и разницы, откуда она взялась,
// у бота нет. Не проходит — её берут в черновик, чинят и публикуют заново.

const PATH = "/admin/bot/flow";

/**
 * Ответ экшена. `graph` приезжает там, где сервер ПОДМЕНИЛ черновик (взяли старую версию, вернули
 * дефолт): редактор держит граф в своём состоянии, и без документа в ответе экран показывал бы
 * старое, пока его не перезагрузят руками.
 */
export type FlowResult = { ok: string; graph?: string } | { error: string };


/**
 * Отличается ли новый документ от того, что уже в эфире, чем-нибудь кроме расположения нод.
 *
 * Нужно ровно для одной фразы в ответе на публикацию. Случай «перетащил пару нод, нажал „В эфир“ и
 * пошёл смотреть, что изменилось в боте» стоил живой отладки: в эфир ушла версия, поведение у
 * которой прежнее, а редактор об этом ничего не сказал. Координаты выкидываем именно потому, что
 * перетаскивание — не правка поведения.
 */
function sameBehaviour(next: BotFlowGraph, live: BotFlowGraph): boolean {
  const strip = (g: BotFlowGraph) =>
    JSON.stringify({
      ...g,
      nodes: g.nodes.map((n) => {
        const { x, y, ...rest } = n as typeof n & { x?: number; y?: number };
        void x;
        void y;
        return rest;
      }),
    });
  return strip(next) === strip(live);
}

/** Разбор и минимальная проверка присланного документа. */
function readGraph(json: string): { graph: BotFlowGraph } | { error: string } {
  const graph = parseGraph(json);
  if (!graph) return { error: "Документ графа не читается — сохранение отменено" };
  const broken = brokenGraph(graph);
  if (broken) return { error: broken };
  return { graph };
}

/**
 * Пускать ли граф в эфир. Проверка повторяется на сервере, хотя редактор показывает тот же список
 * рядом с кнопкой: экран мог быть отрисован до правки реестров, а в эфир уходит то, что прислали.
 * В ответ кладём первые несколько претензий — весь список у оператора и так перед глазами.
 */
async function blocking(graph: BotFlowGraph): Promise<string | null> {
  const known = { ...flowRegistries(), flows: await flowNeighbours(graph.key) };
  const errors: FlowIssue[] = validateFlow(graph, known).filter((i) => i.level === "error");
  if (!errors.length) return null;
  const head = errors.slice(0, 3).map((e) => (e.node ? `${e.node}: ${e.text}` : e.text));
  const rest = errors.length > head.length ? ` И ещё ${errors.length - head.length}.` : "";
  return `Проверка не пройдена (${errors.length}). ${head.join(" ")}${rest}`;
}

/** Сохранить черновик. Эфира не касается: бот продолжает говорить опубликованной версией. */
export async function saveFlowDraft(json: string, note: string): Promise<FlowResult> {
  try {
    await requirePermission("tournaments.edit");
    const read = readGraph(json);
    if ("error" in read) return read;
    const version = await saveDraft(read.graph, note.trim(), read.graph.key);
    revalidatePath(PATH);
    return { ok: `Черновик сохранён (версия ${version.version})` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить" };
  }
}

/**
 * Сохранить и сразу выпустить в эфир. Одним экшеном, а не «сохрани, потом опубликуй»: иначе
 * опубликовать можно было бы не то, что на экране, — и заметить это было бы нечем.
 */
export async function publishFlowDraft(json: string, note: string): Promise<FlowResult> {
  try {
    await requirePermission("tournaments.edit");
    const read = readGraph(json);
    if ("error" in read) return read;
    const stop = await blocking(read.graph);
    // Черновик всё равно сохраняем: работу оператора терять нельзя, а в эфир не пускаем.
    if (stop) {
      await saveDraft(read.graph, note.trim(), read.graph.key);
      revalidatePath(PATH);
      return { error: stop };
    }
    // Что было в эфире ДО публикации: сравнить надо с ним, поэтому читаем заранее.
    const before = await liveFlow(read.graph.key);
    const version = await saveDraft(read.graph, note.trim(), read.graph.key);
    await publishVersion(version.id, read.graph.key);
    revalidatePath(PATH);
    return {
      ok: sameBehaviour(read.graph, before.graph)
        ? `Версия ${version.version} в эфире. В боте ничего не изменится: от прежней версии этот граф отличается разве что расположением нод.`
        : `Версия ${version.version} в эфире`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось опубликовать" };
  }
}

/** Откат: выпустить в эфир уже существующую версию. Копии не делаем — версии не удаляются. */
export async function rollbackFlow(id: number): Promise<FlowResult> {
  try {
    await requirePermission("tournaments.edit");
    const row = await prisma.botFlow.findUnique({ where: { id }, select: { key: true, version: true, graph: true } });
    if (!row) return { error: "Версия не найдена" };
    const graph = parseGraph(row.graph);
    if (!graph) return { error: "Эта версия не читается — выпускать её в эфир нельзя" };
    const stop = await blocking(graph);
    if (stop) return { error: `Версия ${row.version} не проходит проверку. ${stop}` };
    await publishVersion(id, row.key);
    revalidatePath(PATH);
    return { ok: `В эфире снова версия ${row.version}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось откатить" };
  }
}

/** Взять версию в черновик, чтобы править от неё. Эфир при этом не меняется. */
export async function editFlowVersion(id: number): Promise<FlowResult> {
  try {
    await requirePermission("tournaments.edit");
    const graph = await copyToDraft(id);
    if (!graph) return { error: "Версия не найдена или не читается" };
    revalidatePath(PATH);
    return { ok: "Версия скопирована в черновик", graph: JSON.stringify(graph) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось скопировать" };
  }
}

/** Вернуть черновику дефолтный граф из кода — тот самый, с которым работает пустая база. */
export async function resetFlowDraft(key: string): Promise<FlowResult> {
  try {
    await requirePermission("tournaments.edit");
    // У флоу, заведённого оператором, дефолта в коде нет — возвращаем пустую заготовку: «сбросить»
    // должно работать в любом графе, иначе кнопка врёт через раз.
    const graph = defaultFlow(key) ?? blankFlow(key);
    await saveDraft(graph, "дефолт из кода", key);
    revalidatePath(PATH);
    return { ok: "Черновик заменён дефолтным графом", graph: JSON.stringify(graph) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось вернуть дефолт" };
  }
}

/**
 * Ход симулятора: прогон того же интерпретатора по графу с экрана (`bot-flow/simulate.ts`).
 *
 * Состояние разговора приходит и уходит аргументом — на сервере от прогона не остаётся ничего:
 * ни строки в `BotSession`, ни отправки в Telegram. Поэтому симулятор можно гонять хоть на живом
 * боте: человека посреди анкеты он не собьёт.
 */
export async function simulateFlow(
  json: string,
  state: SimState,
  text: string,
  /** От чьего имени пишем: по нему считается `ctx.*` — знает ли лига этого человека. */
  who: { chatId: string; username?: string },
): Promise<{ step: SimStep } | { error: string }> {
  try {
    await requirePermission("tournaments.edit");
    const graph = parseGraph(json);
    if (!graph) return { error: "Документ графа не читается" };
    const broken = brokenGraph(graph);
    if (broken) return { error: broken };
    // Правимый граф — с экрана, соседние — из эфира (Э7): прогон, дошедший до «вернуть в меню»,
    // должен показать то самое меню, которое человек увидит в телеграме.
    const set = withFlow(makeSet(await liveFlows()), { id: null, key: graph.key, version: 0, graph });
    const step = await simulate(set, graph.key, state, {
      chatId: who.chatId.trim() || "sim",
      text,
      username: who.username?.trim() || null,
      tgId: null,
    });
    return { step };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Симулятор не смог сделать ход" };
  }
}
