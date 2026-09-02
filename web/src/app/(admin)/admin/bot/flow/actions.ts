"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { FLOW_KEY, defaultFlow } from "@/lib/bot-flow/default-flow";
import { brokenGraph } from "@/lib/bot-flow/editor";
import { flowRegistries } from "@/lib/bot-flow/registries";
import { simulate, type SimState, type SimStep } from "@/lib/bot-flow/simulate";
import { copyToDraft, publishVersion, saveDraft } from "@/lib/bot-flow/store";
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
function blocking(graph: BotFlowGraph): string | null {
  const errors: FlowIssue[] = validateFlow(graph, flowRegistries()).filter((i) => i.level === "error");
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
    const version = await saveDraft(read.graph, note.trim());
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
    const stop = blocking(read.graph);
    // Черновик всё равно сохраняем: работу оператора терять нельзя, а в эфир не пускаем.
    if (stop) {
      await saveDraft(read.graph, note.trim());
      revalidatePath(PATH);
      return { error: stop };
    }
    const version = await saveDraft(read.graph, note.trim());
    await publishVersion(version.id);
    revalidatePath(PATH);
    return { ok: `Версия ${version.version} в эфире` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось опубликовать" };
  }
}

/** Откат: выпустить в эфир уже существующую версию. Копии не делаем — версии не удаляются. */
export async function rollbackFlow(id: number): Promise<FlowResult> {
  try {
    await requirePermission("tournaments.edit");
    const row = await prisma.botFlow.findUnique({ where: { id }, select: { key: true, version: true, graph: true } });
    if (!row || row.key !== FLOW_KEY) return { error: "Версия не найдена" };
    const graph = parseGraph(row.graph);
    if (!graph) return { error: "Эта версия не читается — выпускать её в эфир нельзя" };
    const stop = blocking(graph);
    if (stop) return { error: `Версия ${row.version} не проходит проверку. ${stop}` };
    await publishVersion(id);
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
export async function resetFlowDraft(): Promise<FlowResult> {
  try {
    await requirePermission("tournaments.edit");
    const graph = defaultFlow();
    await saveDraft(graph, "дефолт из кода");
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
    const step = await simulate(graph, state, {
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
