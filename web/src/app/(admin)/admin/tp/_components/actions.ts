"use server";

// Серверные действия вкладки «Команды» на /admin/tp: начислить TP команде и отменить строку.
// Почему действия, а не API-роут: после записи надо перерисовать и журнал, и витрину пула —
// `revalidatePath` внутри действия делает это одним местом (тот же приём, что у бара управления
// пулом, `(public)/roster/_components/actions.ts`).
//
// Право — существующее `tp.edit`: действие то же самое, зачёт тот же, нового права этап не заводит.
// Гейт страницы не заменяет гейта здесь: страницу можно и не открывать.

import { revalidatePath } from "next/cache";
import { requirePermission, type Account } from "@/lib/account";
import { awardTeamTp, revertTeamTp } from "@/lib/team-rating";

export type ActionResult = { ok: true } | { error: string };

/** Кто начислил — в журнале должно стоять имя, а не id: строку читает человек. */
const who = (acc: Account) => acc.name || acc.player?.nickname || acc.email || `аккаунт #${acc.id}`;

async function run(op: (by: string) => Promise<unknown>): Promise<ActionResult> {
  try {
    const acc = await requirePermission("tp.edit");
    await op(who(acc));
    revalidatePath("/admin/tp");
    revalidatePath("/roster");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Недостаточно прав") return { error: "Нужно право «Начисление TP»" };
    console.error("team tp action failed", e);
    return { error: "Не удалось выполнить — попробуйте ещё раз" };
  }
}

export async function awardTeamTpAction(teamId: number, amount: number, note: string): Promise<ActionResult> {
  if (!Number.isInteger(amount) || amount === 0) return { error: "Начисление — целое число, не ноль" };
  return run((by) => awardTeamTp(teamId, amount, { note, by }));
}

export async function revertTeamTpAction(entryId: number): Promise<ActionResult> {
  return run((by) => revertTeamTp(entryId, { by }));
}
