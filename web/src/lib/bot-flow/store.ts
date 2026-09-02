// Только сервер / скрипт: откуда берётся граф диалога и как он версионируется. Дефолт — сид в
// коде, поверх — версии, сохранённые оператором (`BotFlow`).
//
// Верх файла — чтение для бота (`liveFlow`, `pinnedFlow`), низ — работа редактора (`/admin/bot/flow`,
// Э2): черновик, публикация, откат. Порядок версий устроен так:
//
//   · черновик — не больше одной строки со `status: "draft"` на ключ. Правки редактора едут в неё;
//   · публикация переводит черновик в `published`, а прежнюю живую версию — в `archived`.
//     Номер версии при этом НЕ меняется: он выдан при заведении черновика и по нему на версию
//     ссылаются сессии;
//   · откат — это публикация уже существующей строки, а не копия. Версии не удаляются никогда:
//     сессия доигрывает на своей (`BotSession.flowVersion`), и снос строки оборвал бы разговор.

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

/* ── Редактор: версии, черновик, публикация ─────────────────────────────────────────────────── */

/** Строка списка версий на `/admin/bot/flow`: по чему её узнать и что с ней можно сделать. */
export type FlowVersion = {
  id: number;
  version: number;
  status: string;
  note: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

/** Все версии ключа, новейшая сверху. Список короткий (счёт идёт на десятки), режем на сотне. */
export async function listVersions(key: string = FLOW_KEY): Promise<FlowVersion[]> {
  const rows = await prisma.botFlow.findMany({
    where: { key },
    orderBy: { version: "desc" },
    take: 100,
    select: { id: true, version: true, status: true, note: true, publishedAt: true, updatedAt: true },
  });
  return rows;
}

/**
 * Что открыть в редакторе: черновик, если он есть, иначе живой граф (а нет и его — сид из кода).
 *
 * Открывать редактор на живой версии, а не на пустом месте, важно: правка почти всегда начинается
 * с «как сейчас». Строку в базе при этом не заводим — черновик появится от первого сохранения.
 */
export async function editorFlow(key: string = FLOW_KEY): Promise<{
  graph: BotFlowGraph;
  /** Откуда взят граф — редактор говорит это вслух, чтобы «сохранить» не было сюрпризом. */
  source: "draft" | "live" | "seed";
  /** Строка черновика, если она уже есть. */
  draft: FlowVersion | null;
  note: string;
}> {
  const row = await prisma.botFlow.findFirst({ where: { key, status: "draft" }, orderBy: { version: "desc" } });
  if (row) {
    const graph = parseGraph(row.graph);
    const { id, version, status, note, publishedAt, updatedAt } = row;
    if (graph) return { graph, source: "draft", draft: { id, version, status, note, publishedAt, updatedAt }, note: note ?? "" };
  }
  const live = await liveFlow(key);
  return { graph: live.graph, source: live.id === null ? "seed" : "live", draft: null, note: "" };
}

/** Следующий свободный номер версии. Номера не переиспользуются — по ним читается история. */
async function nextVersion(key: string): Promise<number> {
  const last = await prisma.botFlow.findFirst({ where: { key }, orderBy: { version: "desc" }, select: { version: true } });
  return (last?.version ?? 0) + 1;
}

/**
 * Сохранить черновик. Граф приходит уже разобранным — проверять документ должен тот, кто его
 * получил снаружи (экшен редактора), а не хранилище: сюда попадает только читаемый JSON.
 */
export async function saveDraft(graph: BotFlowGraph, note: string, key: string = FLOW_KEY): Promise<FlowVersion> {
  const text = JSON.stringify(graph);
  const existing = await prisma.botFlow.findFirst({ where: { key, status: "draft" }, orderBy: { version: "desc" } });
  const row = existing
    ? await prisma.botFlow.update({ where: { id: existing.id }, data: { graph: text, note: note || null } })
    : await prisma.botFlow.create({
        data: { key, version: await nextVersion(key), status: "draft", graph: text, note: note || null },
      });
  const { id, version, status, note: saved, publishedAt, updatedAt } = row;
  return { id, version, status, note: saved, publishedAt, updatedAt };
}

/**
 * Выпустить версию в эфир: она становится `published`, прежняя живая уходит в `archived`.
 * Одним и тем же путём идут и публикация черновика, и откат на старую версию — разница только в
 * том, какую строку выбрали. Транзакция нужна, чтобы между двумя апдейтами не оказалось двух живых
 * версий разом: `liveFlow` берёт первую попавшуюся из них.
 */
export async function publishVersion(id: number, key: string = FLOW_KEY): Promise<void> {
  await prisma.$transaction([
    prisma.botFlow.updateMany({ where: { key, status: "published", id: { not: id } }, data: { status: "archived" } }),
    prisma.botFlow.update({ where: { id }, data: { status: "published", publishedAt: new Date() } }),
  ]);
}

/**
 * Взять старую версию в черновик — чтобы править от неё, а не с нуля. Отдельно от отката: откат
 * меняет то, что бот говорит прямо сейчас, а это правка «в столе».
 */
export async function copyToDraft(id: number, key: string = FLOW_KEY): Promise<BotFlowGraph | null> {
  const row = await prisma.botFlow.findUnique({ where: { id } });
  const graph = row ? parseGraph(row.graph) : null;
  if (!graph) return null;
  await saveDraft(graph, row?.note ?? "", key);
  return graph;
}
