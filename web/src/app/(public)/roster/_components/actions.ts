"use server";

// Серверные действия управления пулом команд — их зовёт клиентский бар карточки (team-manage-bar).
// Почему действия, а не fetch к API: после мутации нужно ПЕРЕРИСОВАТЬ серверный список и счётчики
// «В пуле / Архив». `revalidatePath('/roster')` внутри действия делает это надёжно; клиентский
// `router.refresh()` после fetch в этом дев-билде Next список не обновлял (RSC приходил, DOM — нет).
// Право и саму операцию держит один модуль team-admin (его же зовёт API-роут).

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import { archiveTeam, purgeTeam, restoreTeam, TeamAdminError } from "@/lib/team-admin";

export type ActionResult = { ok: true } | { error: string };

async function run(op: () => Promise<void>): Promise<ActionResult> {
  try {
    await requirePermission("roster.delete");
    await op();
    revalidatePath("/roster");
    return { ok: true };
  } catch (e) {
    // Понятную ошибку операции показываем как есть, прочее — общей фразой (в лог уйдёт стек).
    if (e instanceof TeamAdminError) return { error: e.message };
    if (e instanceof Error && e.message === "Недостаточно прав") return { error: "Нужно право «Удаление профилей»" };
    console.error("team pool action failed", e);
    return { error: "Не удалось выполнить — попробуйте ещё раз" };
  }
}

// В файле "use server" экспортировать можно только async-функции — не стрелки-константы.
export async function archiveTeamAction(teamId: number) {
  return run(() => archiveTeam(teamId));
}
export async function restoreTeamAction(teamId: number) {
  return run(() => restoreTeam(teamId));
}
export async function purgeTeamAction(teamId: number) {
  return run(() => purgeTeam(teamId));
}
