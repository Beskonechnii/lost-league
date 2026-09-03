"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentAccountId, clearSessionCookie } from "@/lib/player-session";
import { changePassword, deleteOwnAccount } from "@/lib/account";

// Управление своим входом из кабинета. Все действия берут id аккаунта из сессии, а не из формы.

export type SecState = { error?: string; ok?: string } | null;

/** Сменить или задать пароль. */
export async function savePassword(_state: SecState, form: FormData): Promise<SecState> {
  const accountId = await currentAccountId();
  if (accountId == null) return { error: "Сессия истекла — войдите снова" };

  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next !== confirm) return { error: "Пароли не совпадают" };

  const error = await changePassword(accountId, current, next);
  if (error) return { error };

  revalidatePath("/me/settings");
  revalidatePath("/me");
  return { ok: "Пароль сохранён." };
}

/** Удалить свой аккаунт: рвём вход, гасим сессию, уводим на страницу входа. Профиль игрока остаётся. */
export async function deleteAccount(): Promise<void> {
  const accountId = await currentAccountId();
  if (accountId != null) await deleteOwnAccount(accountId);
  await clearSessionCookie();
  redirect("/me");
}
