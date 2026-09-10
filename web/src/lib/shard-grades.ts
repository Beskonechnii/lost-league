/**
 * Осколки: лестница грейдов и подписи начислений — ЧИСТАЯ часть (ни prisma, ни сессии).
 *
 * Отдельным файлом от `shards.ts` по той же причине, по какой `dota-rank.ts` отделён от
 * `rank-refresh.ts`: эти таблицы тянет атом Кита (`components/pouf/shards.tsx`), а он рисуется
 * в том числе в клиентских деревьях — импорт prisma туда затащил бы половину сервера.
 *
 * **Грейд считается по ВСЕМУ заработанному, а не по остатку** (решение из `RELEASE-PLAN.md` §E2):
 * иначе трата понижала бы статус и тратить никто не стал бы. На что осколки тратятся — на Э22
 * сознательно не решено (решение Стаса 10.09), поэтому здесь нет ни цен, ни баланса: лестница
 * описывает только «сколько человек сделал для лиги».
 */

/** За что начисляют. Строкой в БД (sqlite не умеет enum), канон — здесь. */
export type ShardReason = "welcome" | "steam" | "telegram" | "profile" | "manual";

/** Подпись начисления в витрине — почему осколки пришли. */
export const SHARD_REASONS: Record<ShardReason, string> = {
  welcome: "Заявка одобрена",
  steam: "Steam подтверждён",
  telegram: "Телеграм привязан",
  profile: "Анкета заполнена",
  manual: "Начислено лигой",
};

export const shardReasonLabel = (reason: string): string =>
  SHARD_REASONS[reason as ShardReason] ?? SHARD_REASONS.manual;

/** Ступень: имя, порог по заработанному и тон знака (подушка / грань / надпись). */
export type ShardGrade = {
  level: number;
  name: string;
  /** Начиная со скольких заработанных осколков ступень считается взятой. */
  from: number;
  tone: { disc: string; face: string; ink: string };
};

/**
 * Шесть ступеней. Пороги подобраны так, чтобы полностью прошедший вход игрок (одобрение + Steam +
 * телеграм + заполненная анкета = 125) стоял на второй, а не на предпоследней: дальше лестницу
 * должно тянуть то, что человек делает в лиге ДАЛЬШЕ, а не разовая настройка аккаунта.
 */
export const SHARD_GRADES: ShardGrade[] = [
  { level: 1, name: "Искра", from: 0, tone: { disc: "#cfc8b6", face: "#ece8dc", ink: "#4a463c" } },
  { level: 2, name: "Осколок", from: 100, tone: { disc: "#a8c8b6", face: "#dcefe6", ink: "#22503c" } },
  { level: 3, name: "Кристалл", from: 250, tone: { disc: "#93c2d8", face: "#dbeef6", ink: "#14435a" } },
  { level: 4, name: "Призма", from: 600, tone: { disc: "#a99ad9", face: "#e4dcf6", ink: "#3a2b6b" } },
  { level: 5, name: "Ядро", from: 1200, tone: { disc: "#d98f6a", face: "#f7dfd2", ink: "#5a2c12" } },
  { level: 6, name: "Реликвия", from: 2500, tone: { disc: "#d9b44e", face: "#f7e9c4", ink: "#5e4408" } },
];

/** Текущая ступень по заработанному за всё время. Ниже первой упасть нельзя — это её и делает «0». */
export function shardGrade(earned: number): ShardGrade {
  let grade = SHARD_GRADES[0];
  for (const g of SHARD_GRADES) if (earned >= g.from) grade = g;
  return grade;
}

/** Следующая ступень или null у вершины лестницы. */
export function nextShardGrade(earned: number): ShardGrade | null {
  return SHARD_GRADES.find((g) => earned < g.from) ?? null;
}

/**
 * Прогресс внутри ступени: доля пройденного отрезка и сколько осталось до следующей.
 * На вершине — 100% и `left = 0`: полоса, которая никогда не заполняется, врёт про потолок.
 */
export function shardProgress(earned: number): { pct: number; left: number; next: ShardGrade | null } {
  const grade = shardGrade(earned);
  const next = nextShardGrade(earned);
  if (!next) return { pct: 100, left: 0, next: null };
  const span = next.from - grade.from;
  const pct = span > 0 ? Math.round(((earned - grade.from) / span) * 100) : 0;
  return { pct: Math.max(0, Math.min(100, pct)), left: next.from - earned, next };
}
