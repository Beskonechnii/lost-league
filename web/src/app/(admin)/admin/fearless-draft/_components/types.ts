/* Что борду нужно знать о команде и о герое.
 *
 * Отдельный файл (как `types.ts` у архива серий на Э9): справочники собирает серверная
 * страница, а читают их три клиентских куска борда — настройка, сетка последовательности
 * и пул. Держать типы в одном из них значило бы, что соседи импортируют друг друга ради
 * пары строк.
 */

export type TeamRef = { id: number; name: string; color: string; logo: string | null };

export type HeroRef = {
  id: number;
  name: string;
  slug: string;
  img: string;
  attr: "str" | "agi" | "int" | "all";
};

export const ATTR_LABEL: Record<HeroRef["attr"], string> = {
  str: "Сила",
  agi: "Ловкость",
  int: "Интеллект",
  all: "Универсал",
};

export const ATTR_ORDER: HeroRef["attr"][] = ["str", "agi", "int", "all"];

/** Таймеры показываем как «м:сс»: секундами в эфире не считают. */
export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
