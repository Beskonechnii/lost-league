import "server-only";

import { prisma } from "./prisma";
import { fetchDotaProfile } from "./enrich";
import { playerAccountId } from "./profiles";
import { rankDelta } from "./dota-rank";

// Массовое обновление рангов по лиге (RELEASE-PLAN §E, Э20).
//
// **Почему отдельно от импорта составов.** `enrich.ts` тянет ранг один раз — в момент разбора
// таблицы сезона. Через месяц эта цифра врёт у половины ростера, а повторно гонять импорт ради
// неё нельзя: он пишет составы. Здесь операция ровно одна — сверить ранг и запомнить прошлый.
//
// **Ключ у OpenDota не нужен** — `/api/players/<account_id>` открыт. `STEAM_API_KEY` требуется
// только именным ссылкам steamcommunity.com/id/<name> (`resolveVanity`), а тут мы уже знаем
// account_id: у кого его нет — того просто не обновляем, и оператор видит это в отчёте.
//
// **Идём по одному, с паузой.** Бесплатный OpenDota — 60 запросов в минуту, дальше 429 вместо
// данных. Отсюда `SPACING_MS` и порционная работа: страница просит по горсти игроков за раз и
// показывает прогресс, вместо одного запроса на три с половиной минуты, который упрётся в таймаут
// и не оставит после себя ничего.

/** Пауза между запросами к OpenDota: 60/мин — их потолок, идём чуть медленнее. */
const SPACING_MS = 1100;

/** Насколько ранг считается свежим: сверенный сегодня второй раз за день не проверяем. */
const FRESH_MS = 24 * 60 * 60 * 1000;

/** Сколько игроков берём за один заход страницы. ~11 секунд работы — видимый шаг прогресса. */
export const RANK_CHUNK = 10;

export type RankTarget = { id: number; nickname: string; accountId: string };

export type RankOutcome =
  /** Ранг сменился — записали новый, прошлый уехал в `rankPrev`. */
  | "changed"
  /** Ранг тот же — обновили только дату сверки. */
  | "same"
  /** Ранг появился впервые. */
  | "first"
  /** OpenDota не отдала профиль или в нём нет `rank_tier` (закрытый профиль) — не трогаем. */
  | "unknown";

export type RankResult = {
  id: number;
  nickname: string;
  outcome: RankOutcome;
  rank: number | null;
  prev: number | null;
};

/**
 * Кого обновлять. `account_id` берём через `playerAccountId`: у части ростера он не в своём поле,
 * а выводится из ссылки на Dotabuff — такие игроки обновляемы ровно так же.
 *
 * `stale` — пропустить тех, кого сверяли меньше суток назад. Это режим по умолчанию: полный прогон
 * по 190 игрокам занимает минуты, и повторять его из-за одного нового профиля незачем.
 */
export async function rankTargets({ stale = true }: { stale?: boolean } = {}): Promise<RankTarget[]> {
  const players = await prisma.player.findMany({
    select: { id: true, nickname: true, accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true, rankAt: true },
    orderBy: { id: "asc" },
  });
  const edge = Date.now() - FRESH_MS;
  const targets: RankTarget[] = [];
  for (const p of players) {
    if (stale && p.rankAt && p.rankAt.getTime() > edge) continue;
    const accountId = playerAccountId(p);
    if (!accountId) continue;
    targets.push({ id: p.id, nickname: p.nickname, accountId });
  }
  return targets;
}

/** Сколько игроков вообще нечем обновлять — цифра для отчёта оператору. */
export async function playersWithoutAccountId(): Promise<number> {
  const players = await prisma.player.findMany({
    select: { accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true },
  });
  return players.filter((p) => !playerAccountId(p)).length;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Обновить ранги горстки игроков. Порядок внутри горсти последовательный, между запросами — пауза.
 *
 * Что пишем:
 *   • ранг сменился → новый в `rank`, старый в `rankPrev`, дата сверки;
 *   • ранг тот же → только дата сверки. `rankPrev` НЕ трогаем: иначе первый же холостой прогон
 *     затёр бы дельту («было Легенда 2»), ради которой этап и делался;
 *   • ранга не отдали (закрытый профиль, сеть) → не пишем вообще ничего. Затирать известный ранг
 *     пустотой из-за молчания OpenDota — худшее, что здесь можно сделать.
 */
export async function refreshRanksChunk(targets: RankTarget[]): Promise<RankResult[]> {
  const out: RankResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (i > 0) await wait(SPACING_MS);

    const profile = await fetchDotaProfile(t.accountId);
    const current = await prisma.player.findUnique({ where: { id: t.id }, select: { rank: true, rankPrev: true } });
    if (!current) continue; // профиль слили, пока шёл прогон — не наша забота, просто пропускаем

    const next = profile?.rank ?? null;
    if (next === null) {
      out.push({ id: t.id, nickname: t.nickname, outcome: "unknown", rank: current.rank, prev: current.rankPrev });
      continue;
    }

    const changed = current.rank !== next;
    await prisma.player.update({
      where: { id: t.id },
      data: changed ? { rank: next, rankPrev: current.rank, rankAt: new Date() } : { rankAt: new Date() },
    });
    out.push({
      id: t.id,
      nickname: t.nickname,
      outcome: changed ? (current.rank === null ? "first" : "changed") : "same",
      rank: next,
      prev: changed ? current.rank : current.rankPrev,
    });
  }
  return out;
}

/** Сводка прогона строкой — «12 сменили ранг, 40 без изменений, 3 без ответа». */
export function summarize(results: RankResult[]): string {
  const n = (o: RankOutcome) => results.filter((r) => r.outcome === o).length;
  const bits = [
    n("changed") > 0 ? `${n("changed")} сменили ранг` : null,
    n("first") > 0 ? `${n("first")} получили ранг впервые` : null,
    n("same") > 0 ? `${n("same")} без изменений` : null,
    n("unknown") > 0 ? `${n("unknown")} без ответа` : null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(", ") : "обновлять было нечего";
}

/** Игроки, у которых ранг менялся, — то, ради чего страница и существует. Свежие сверху. */
export async function playersWithRankChange(limit = 200) {
  const players = await prisma.player.findMany({
    where: { NOT: { rank: null } },
    select: { id: true, slug: true, nickname: true, photo: true, rank: true, rankPrev: true, rankAt: true },
    orderBy: [{ rankAt: "desc" }, { nickname: "asc" }],
    take: limit,
  });
  return players.map((p) => ({ ...p, delta: rankDelta(p.rank, p.rankPrev) }));
}
