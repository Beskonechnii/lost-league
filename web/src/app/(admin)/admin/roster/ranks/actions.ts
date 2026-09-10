"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import {
  RANK_CHUNK,
  rankTargets,
  refreshRanksChunk,
  type RankResult,
  type RankTarget,
} from "@/lib/rank-refresh";

// Обновление рангов ПОРЦИЯМИ, а не одним экшеном на весь ростер.
//
// Причина арифметическая: OpenDota держит 60 запросов в минуту, ростер — под две сотни игроков,
// то есть полный прогон это ~3.5 минуты непрерывной сети. Один серверный экшен такой длины упрётся
// в таймаут прокси и не оставит после себя ничего — ни данных, ни объяснения. Порциями работа
// продвигается кусками: каждая горсть записана в базу до того, как страница попросит следующую,
// и прогон, оборванный посередине, всё равно обновил тех, до кого дошёл.
//
// Список целей считается ОДИН раз, на старте, и дальше страница носит его с собой. Считать его
// заново на каждой горсти нельзя: мы же сами помечаем игроков свежими, и «взять следующих
// несвежих» на втором круге вернуло бы тех, кого ещё не трогали, вперемешку — с непредсказуемым
// концом цикла.

export type RankPlan = { targets: RankTarget[]; chunk: number };

/** Кого будем обновлять. `stale=false` — принудительно всех, даже сверенных сегодня. */
export async function planRankRefresh(stale: boolean): Promise<RankPlan> {
  await requirePermission("roster.edit");
  return { targets: await rankTargets({ stale }), chunk: RANK_CHUNK };
}

/** Обновить одну горсть. Порция приходит от страницы — из плана, выданного выше. */
export async function runRankChunk(targets: RankTarget[]): Promise<RankResult[]> {
  await requirePermission("roster.edit");
  // Обрезаем на своей стороне: размер порции — наша защита от лимита OpenDota, и он не должен
  // зависеть от того, что прислал клиент.
  const results = await refreshRanksChunk(targets.slice(0, RANK_CHUNK));
  revalidatePath("/admin/roster/ranks");
  return results;
}
