"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentAccountId, clearSessionCookie } from "@/lib/player-session";
import { changePassword, deleteOwnAccount } from "@/lib/account";
import { unlinkTelegram } from "@/lib/tg-link";

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

/**
 * Отвязать телеграм (Э19). Единственный вход отдавать нельзя: у пришедшего из бота нет ни почты,
 * ни пароля (`tg-register.ts`), и снятая привязка заперла бы его снаружи собственного аккаунта.
 * Поэтому сперва считаем, останется ли чем войти.
 */
export async function unlinkTg(): Promise<SecState> {
  const accountId = await currentAccountId();
  if (accountId == null) return { error: "Сессия истекла — войдите снова" };

  const account = await prisma.userAccount.findUnique({
    where: { id: accountId },
    select: { tgId: true, email: true, passwordHash: true, googleSub: true, steamId: true },
  });
  if (!account?.tgId) return { error: "Телеграм и так не привязан" };

  const otherWayIn = (!!account.email && !!account.passwordHash) || !!account.googleSub || !!account.steamId;
  if (!otherWayIn) {
    return { error: "Это ваш единственный вход. Сперва задайте пароль или привяжите Google — иначе войти будет нечем." };
  }

  await unlinkTelegram(accountId);
  revalidatePath("/me/settings");
  revalidatePath("/me");
  return { ok: "Телеграм отвязан." };
}

/** Удалить свой аккаунт: рвём вход, гасим сессию, уводим на страницу входа. Профиль игрока остаётся. */
export async function deleteAccount(): Promise<void> {
  const accountId = await currentAccountId();
  if (accountId != null) await deleteOwnAccount(accountId);
  await clearSessionCookie();
  redirect("/me");
}
