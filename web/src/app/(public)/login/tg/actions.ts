"use server";

import { redirect } from "next/navigation";
import { redeemLoginCode } from "@/lib/tg-login";
import { establishSession } from "@/lib/account";

// Вход по одноразовому коду из бота. Проверку и гашение кода делает `tg-login.ts` (его же зовёт
// бот при выдаче), а куку ставит `establishSession` — тот самый путь, что у входа по паролю:
// роль и владелец по OWNER_EMAIL решаются в одном месте, а не в каждом входе заново.

export type CodeState = { error?: string } | null;

export async function loginByCode(_state: CodeState, form: FormData): Promise<CodeState> {
  const res = await redeemLoginCode(String(form.get("code") ?? ""));
  if (!res.ok) return { error: res.error };
  await establishSession(res.accountId);
  redirect("/me");
}
