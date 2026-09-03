"use server";

import { revalidatePath } from "next/cache";
import { currentAccount } from "@/lib/account";
import { respondToInvite } from "@/lib/team-invites";

// Ответ на приглашение в состав. Игрока берём из сессии, а не из формы: id строки в форме виден
// всем, и без этого чужим приглашением можно было бы ответить за другого (сверку делает
// respondToInvite — гейт стоит там, чтобы его нельзя было обойти мимо этой страницы).

export type InviteState = { error?: string; ok?: string } | null;

async function respond(form: FormData, answer: "accepted" | "declined"): Promise<InviteState> {
  const account = await currentAccount();
  if (!account?.player) return { error: "Сессия истекла — войдите снова" };

  const id = Number(form.get("memberId"));
  if (!Number.isInteger(id)) return { error: "Приглашение не найдено" };

  const error = await respondToInvite(account.player.id, id, answer);
  if (error) return { error };

  revalidatePath("/me/invites");
  return { ok: answer === "accepted" ? "Участие подтверждено" : "Вы отказались от участия" };
}

// Обе — именно `async function`: в модуле с «use server» экспортироваться могут только
// асинхронные функции, стрелка-константа компилятору серверных экшенов не годится.
export async function acceptInvite(_state: InviteState, form: FormData): Promise<InviteState> {
  return respond(form, "accepted");
}

export async function declineInvite(_state: InviteState, form: FormData): Promise<InviteState> {
  return respond(form, "declined");
}
