// Ранг Доты: rank_tier OpenDota → человеческая подпись, разбор на медаль/звезду и сравнение двух
// рангов. Чистый модуль — годится и на клиенте (его же тянет атом медали в Ките).
//
// Формат Valve: десятки — медаль (1 Рекрут … 7 Божество), единицы — звезда 1–5. 80 и выше —
// Immortal, у него звёзд нет, зато бывает место в лидерборде.

const MEDALS = ["Рекрут", "Страж", "Рыцарь", "Герой", "Легенда", "Властелин", "Божество"];

/** Номер медали Immortal: у Valve он идёт восьмым, но в tier записан как 80 без звёзд. */
export const IMMORTAL = 8;

/** «55» → «Властелин 5»; «80» → «Иммортал»; мусор и 0 → null (ранга просто нет). */
export function rankLabel(tier: number | null | undefined): string | null {
  if (!tier || tier < 10) return null;
  if (tier >= 80) return "Иммортал";
  const medal = MEDALS[Math.floor(tier / 10) - 1];
  if (!medal) return null;
  const star = tier % 10;
  return star ? `${medal} ${star}` : medal;
}

export type RankParts = {
  /** 1 Рекрут … 7 Божество, 8 — Immortal. */
  medal: number;
  /** Звёзд на медали, 0–5. У Immortal звёзд не бывает — там 0. */
  star: number;
  /** Название медали без звезды: «Легенда», «Иммортал». */
  name: string;
};

/**
 * Разбор tier на медаль и звёзды — то, что рисует иконка. Отдельно от `rankLabel`, потому что
 * подпись и картинка нужны в разных местах: в таблице стоит и то и другое, в шапке профиля —
 * только картинка с подписью-тултипом.
 */
export function rankParts(tier: number | null | undefined): RankParts | null {
  if (!tier || tier < 10) return null;
  if (tier >= 80) return { medal: IMMORTAL, star: 0, name: "Иммортал" };
  const medal = Math.floor(tier / 10);
  const name = MEDALS[medal - 1];
  if (!name) return null;
  // Звезду за пределами 1–5 Valve не выдаёт; всё, что пришло сверх, — мусор в данных, режем.
  return { medal, star: Math.min(Math.max(tier % 10, 0), 5), name };
}

/**
 * Ранг одним числом «сколько звёзд от нуля» — 11 → 1, 25 → 10, 80 → 36. Нужен ровно затем, чтобы
 * сравнивать два ранга и считать шаги между ними: сами tier'ы для этого не годятся, между 15 и 21
 * один шаг, а разница чисел — шесть.
 */
export function rankSteps(tier: number | null | undefined): number | null {
  const p = rankParts(tier);
  if (!p) return null;
  if (p.medal === IMMORTAL) return 7 * 5 + 1; // Immortal — ступенька сразу над «Божество 5»
  return (p.medal - 1) * 5 + p.star;
}

export type RankDelta = { dir: "up" | "down"; steps: number };

/**
 * Насколько изменился ранг между `prev` и `now`. `null` — сравнивать не с чем (не было прошлого
 * значения) или ранг не менялся. Знак и величина в звёздах, а не в tier'ах: «поднялся на 3» должно
 * значить три звезды, включая переход через медаль.
 */
export function rankDelta(now: number | null | undefined, prev: number | null | undefined): RankDelta | null {
  const a = rankSteps(now);
  const b = rankSteps(prev);
  if (a === null || b === null || a === b) return null;
  return { dir: a > b ? "up" : "down", steps: Math.abs(a - b) };
}
