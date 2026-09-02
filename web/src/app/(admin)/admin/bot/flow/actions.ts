"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { FLOW_KEY, defaultFlow } from "@/lib/bot-flow/default-flow";
import { brokenGraph } from "@/lib/bot-flow/editor";
import { copyToDraft, publishVersion, saveDraft } from "@/lib/bot-flow/store";
import { parseGraph, type BotFlowGraph } from "@/lib/bot-flow/types";

// Запись графа диалога бота. Право проверяется здесь, у самой записи, а не только на странице:
// страницу можно и не открывать, а отрисована она могла быть со старыми правами. Право то же, что
// у /admin/bot — отдельного у бота нет.
//
// Экшены принимают аргументы, а не FormData: редактор — живой канвас, граф лежит в состоянии
// клиента целиком, и заворачивать его в скрытое поле формы значило бы держать его в двух местах.
//
// **Что проверяется при сохранении.** Только читаемость документа (`brokenGraph`): JSON разбирается,
// у нод есть уникальные id, тип известен, стартовая нода на месте. Это не валидатор графа —
// недостижимые ноды, тупики и дубли подписей кнопок приедут на Э3 и там же начнут блокировать
// публикацию. Здесь ровно та защита, без которой редактор потом не откроется.

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
    if (!parseGraph(row.graph)) return { error: "Эта версия не читается — выпускать её в эфир нельзя" };
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
