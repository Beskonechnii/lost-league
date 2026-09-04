"use server";

import { revalidatePath } from "next/cache";
import { approveRegistration, can, currentAccount, rejectClaim, rejectRegistration } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { approveProfileEdit, fieldLabel, rejectProfileEdit } from "@/lib/profile-edit";
import {
  notifyProfileEditApproved,
  notifyProfileEditRejected,
  notifyRegistrationApproved,
  notifyRegistrationRejected,
} from "@/lib/tg-notify";
import { tellAccount, tellPlayer } from "@/lib/system-chat";

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

  const accountId = accountIdOf(form);
  const res = await approveRegistration(accountId, mmr);
  if (!res.ok) return { error: res.error };
  // Пришедшему из бота говорим решение туда же, откуда он подавал: почты у него нет, и иначе он
  // узнает об одобрении, только заглянув в бота сам.
  const player = await prisma.player.findUnique({ where: { id: res.playerId }, select: { nickname: true } });
  await notifyRegistrationApproved(accountId, player?.nickname ?? "Игрок");
  await tellAccount(
    accountId,
    `Добро пожаловать в лигу, ${player?.nickname ?? "игрок"}. Профиль заведён в ростере — можно заполнять анкету и заявляться в составы.`,
  );
  revalidatePath("/admin/moderation");
  return null;
}

/** Вернуть заявку с причиной — человек увидит её в кабинете и поправит анкету. */
export async function reject(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const accountId = accountIdOf(form);
  const reason = String(form.get("reason") ?? "");
  const error = await rejectRegistration(accountId, reason);
  if (error) return { error };
  await notifyRegistrationRejected(accountId, reason.trim());
  await tellAccount(accountId, `Анкету вернул организатор: ${reason.trim()}\n\nПоправьте её в кабинете и пришлите снова.`);
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

// ── правки профиля из бота ───────────────────────────────────────────────────
// Право здесь своё — roster.edit: это правка ростера, а не решение «пускать в лигу». Гейт стоит в
// экшене, а не только в `profile-edit.ts`: тот модуль зовёт и бот, куда `account.ts` (server-only)
// не грузится вовсе.

const editIdOf = (form: FormData): number => Number(form.get("editId"));

/** Кто решает — уходит в `reviewedById` и одновременно служит проверкой права. */
async function reviewer(): Promise<{ id: number } | { error: string }> {
  if (!(await can("roster.edit"))) return { error: "Нужно право «Правка ростера»" };
  const account = await currentAccount();
  return account ? { id: account.id } : { error: "Сессия потерялась — войдите заново" };
}

export async function approveEdit(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const who = await reviewer();
  if ("error" in who) return who;
  const id = editIdOf(form);
  // Правку читаем ДО апрува: после него это уже история, а сказать надо про поле и игрока.
  const request = await prisma.profileEditRequest.findUnique({ where: { id }, select: { playerId: true, field: true, newValue: true } });
  const error = await approveProfileEdit(id, who.id);
  if (error) return { error };
  await notifyProfileEditApproved(id);
  if (request) {
    await tellPlayer(request.playerId, `Правка принята: «${fieldLabel(request.field)}» теперь ${request.newValue}.`);
  }
  revalidatePath("/admin/moderation");
  return null;
}

export async function rejectEdit(_state: ReviewState, form: FormData): Promise<ReviewState> {
  const who = await reviewer();
  if ("error" in who) return who;
  const id = editIdOf(form);
  const reason = String(form.get("reason") ?? "");
  const request = await prisma.profileEditRequest.findUnique({ where: { id }, select: { playerId: true, field: true } });
  const error = await rejectProfileEdit(id, reason, who.id);
  if (error) return { error };
  await notifyProfileEditRejected(id, reason.trim());
  if (request) {
    await tellPlayer(
      request.playerId,
      `Правку поля «${fieldLabel(request.field)}» вернул организатор: ${reason.trim()}\n\nПоправьте и пришлите снова.`,
    );
  }
  revalidatePath("/admin/moderation");
  return null;
}
