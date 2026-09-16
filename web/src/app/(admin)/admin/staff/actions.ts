"use server";

import { revalidatePath } from "next/cache";
import { deleteAccount, setAccountPermissions, setAccountRole } from "@/lib/account";
import { issueOperatorReset } from "@/lib/password-reset";

// Экшены панели команды лиги. Право accounts.admins и запрет трогать себя/владельца проверяются
// внутри setAccountRole/setAccountPermissions — там, где идёт запись: до экшена можно дойти и мимо
// страницы, а страница уже могла быть отрисована со старыми правами.

export async function makeAdmin(form: FormData): Promise<void> {
  await setAccountRole(Number(form.get("accountId")), "admin");
  revalidatePath("/admin/staff");
}

export async function removeAdmin(form: FormData): Promise<void> {
  await setAccountRole(Number(form.get("accountId")), "player");
  revalidatePath("/admin/staff");
}

export async function savePermissions(form: FormData): Promise<void> {
  // Чекбоксы: браузер шлёт только отмеченные, снятые просто не приходят — значит набор целиком.
  const keys = form.getAll("perm").map(String);
  await setAccountPermissions(Number(form.get("accountId")), keys);
  revalidatePath("/admin/staff");
}

export async function removeAccount(form: FormData): Promise<void> {
  await deleteAccount(Number(form.get("accountId")));
  revalidatePath("/admin/staff");
}

export type ResetLinkState = { url?: string; error?: string } | null;

/** Выдать ссылку сброса пароля (ТЗ 02). Право, владелец и «не себе» проверяет issueOperatorReset —
 *  там же, где выдаётся токен: до экшена можно дойти и мимо страницы. Отказ показываем словами,
 *  а не роняем экран: «владельцу нельзя» — это ответ оператору, а не сбой. */
export async function issueReset(_state: ResetLinkState, form: FormData): Promise<ResetLinkState> {
  try {
    return { url: await issueOperatorReset(Number(form.get("accountId"))) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось выдать ссылку" };
  }
}
