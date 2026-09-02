// Только сервер / скрипт: откуда берётся граф диалога. Дефолт — сид в коде, поверх — версии,
// сохранённые оператором (`BotFlow`). Правки редактора приезжают сюда на Э2, чтение нужно уже
// сейчас: без него интерпретатору не с чем работать.

import { prisma } from "../prisma";
import { defaultFlow, FLOW_KEY } from "./default-flow";
import { parseGraph, type BotFlowGraph } from "./types";

/**
 * Граф вместе с тем, откуда он взят. `id` — строка `BotFlow`, на которую ссылается сессия
 * (`BotSession.flowVersion`); `null` — сид из кода: строки в базе ещё нет, ссылаться не на что.
 */
export type LoadedFlow = { id: number | null; version: number; graph: BotFlowGraph };

const seed = (): LoadedFlow => ({ id: null, version: 0, graph: defaultFlow() });

/**
 * Граф, который сейчас в эфире: опубликованная версия, а нет её — сид из кода. Битый JSON в базе
 * тоже отправляет к сиду: бот, который молчит из-за сломанного документа, хуже бота с дефолтным
 * меню — и оператор увидит в логе, что именно не прочиталось.
 */
export async function liveFlow(key: string = FLOW_KEY): Promise<LoadedFlow> {
  const row = await prisma.botFlow.findFirst({
    where: { key, status: "published" },
    orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
  });
  if (!row) return seed();
  const graph = parseGraph(row.graph);
  if (!graph) {
    console.error(`[bot-flow] версия ${row.version} флоу ${key} не читается — беру дефолтный граф`);
    return seed();
  }
  return { id: row.id, version: row.version, graph };
}

/**
 * Версия, на которой диалог начался. Публикация новой не выбрасывает человека из середины анкеты —
 * он доигрывает на своей; поэтому версии и не удаляются. Строки нет (её всё-таки снесли руками) —
 * возвращаем то, что в эфире: продолжить на живом графе лучше, чем оборвать разговор.
 */
export async function pinnedFlow(id: number | null, key: string = FLOW_KEY): Promise<LoadedFlow> {
  if (id === null) return seed();
  const row = await prisma.botFlow.findUnique({ where: { id } });
  const graph = row ? parseGraph(row.graph) : null;
  if (!row || !graph) return liveFlow(key);
  return { id: row.id, version: row.version, graph };
}
