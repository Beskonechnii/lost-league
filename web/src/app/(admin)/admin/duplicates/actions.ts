"use server";

import { revalidatePath } from "next/cache";
import { currentAccount, requirePermission } from "@/lib/account";
import { dismissPair, mergePlayers, renamePlayer } from "@/lib/duplicates";

// Решения по похожим профилям. Право проверяется здесь, у самой записи: страницу можно и не
// открывать (docs/archive/ACCOUNTS-PLAN.md §2.2).
//
// Слияние требует ещё и `roster.delete`: один профиль после него физически исчезает, а удаление
// профилей в реестре прав вынесено отдельно именно потому, что необратимо.

const PATH = "/admin/duplicates";

export type DupState = { error?: string; ok?: string } | null;

export async function merge(_prev: DupState, form: FormData): Promise<DupState> {
  try {
    await requirePermission("roster.edit");
    await requirePermission("roster.delete");
    const winner = Number(form.get("winnerId"));
    const loser = Number(form.get("loserId"));
    const player = await mergePlayers(winner, loser);
    revalidatePath(PATH);
    revalidatePath("/roster/players");
    return { ok: `Объединено в «${player?.nickname ?? "профиль"}»` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось объединить" };
  }
}

export async function rename(_prev: DupState, form: FormData): Promise<DupState> {
  try {
    await requirePermission("roster.edit");
    const player = await renamePlayer(Number(form.get("id")), String(form.get("nickname") ?? ""));
    revalidatePath(PATH);
    revalidatePath("/roster/players");
    return { ok: `Теперь «${player.nickname}»` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось переименовать" };
  }
}

export async function dismiss(form: FormData): Promise<void> {
  await requirePermission("roster.edit");
  const me = await currentAccount();
  await dismissPair(Number(form.get("aId")), Number(form.get("bId")), me?.id ?? null);
  revalidatePath(PATH);
}
