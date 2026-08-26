// Чистый модуль (без БД и next/headers), как permissions.ts и roles.ts: подписи признаков и форма
// пары. Отдельно от `duplicates.ts` потому, что карточку пары рисует клиентский компонент — а он,
// импортируя что-либо из модуля с prisma, утянул бы клиент Prisma в браузерный бандл (сборка на
// этом падает: driver-adapter требует node:module).

/** Почему двое похожи. Порядок = убывание надёжности признака. */
export type Clue = "account" | "telegram" | "name" | "nickname";

export const CLUE_LABELS: Record<Clue, string> = {
  account: "один account_id в Dota",
  telegram: "один телеграм",
  name: "одно имя и фамилия",
  nickname: "почти одинаковый ник",
};

/** Профиль в очереди дублей: ник плюс то, чем он наполнен — по этому выбирают, какой оставить. */
export type Candidate = {
  id: number;
  nickname: string;
  realName: string | null;
  accountId: string | null;
  telegram: string | null;
  mmr: number | null;
  tp: number;
  spots: number;
  stats: number;
  teams: string[];
};

/** Пара похожих: `a` — тот, у кого больше данных (он же предлагается как «оставить»). */
export type Pair = { a: Candidate; b: Candidate; clues: Clue[] };

/** Что переедет при слиянии и что схлопнется — считает `mergeImpact`, показывает карточка пары. */
export type Impact = { spots: number; stats: number; points: number; dropped: number };
