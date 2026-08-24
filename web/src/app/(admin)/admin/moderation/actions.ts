"use server";

import { revalidatePath } from "next/cache";
import { approveRegistration, rejectClaim, rejectRegistration } from "@/lib/account";

// Решения по обеим очередям модерации — анкеты и привязки к профилю. Право accounts.approve
// проверяет сам lib/account.ts — гейт стоит там, чтобы его нельзя было обойти, дойдя до апрува
// мимо этой страницы.

// Состояние форм карточки: только текст ошибки — при успехе строка уходит из очереди.
export type ReviewState = { error?: string } | null;

const accountIdOf = (form: FormData): number => Number(form.get("accountId"));

/** Одобрить заявку. MMR — поле оператора: в анкете он заявленный, в лиге считается настоящим. */
export async function approve(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const raw = String(form.get("mmr") ?? "").trim();
  let mmr: number | null = null;
  if (raw) {
    const n = Number(raw.replace(/\s+/g, ""));
    if (!Number.isInteger(n) || n < 0) return { error: "MMR — целое число или пусто" };
    mmr = n;
  }

  const res = await approveRegistration(accountIdOf(form), mmr);
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin/moderation");
  return null;
}

/** Вернуть заявку с причиной — человек увидит её в кабинете и поправит анкету. */
export async function reject(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const error = await rejectRegistration(accountIdOf(form), String(form.get("reason") ?? ""));
  if (error) return { error };
  revalidatePath("/admin/moderation");
  return null;
}

// ── привязка к профилю ───────────────────────────────────────────────────────
// Одобрение у привязки то же самое, что у анкеты: approveRegistration ставит playerId из claimId и
// открывает аккаунт — второй реализации «пустить в лигу» быть не должно. MMR не передаём: профиль
// уже заведён, его цифры лига не пересматривает. Отказ разный (см. rejectClaim), поэтому свой экшен.

export async function approveLink(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const res = await approveRegistration(accountIdOf(form), null);
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin/moderation");
  return null;
}

export async function rejectLink(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const error = await rejectClaim(accountIdOf(form), String(form.get("reason") ?? ""));
  if (error) return { error };
  revalidatePath("/admin/moderation");
  return null;
}
