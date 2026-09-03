"use server";

import { redirect } from "next/navigation";
import { playerPath } from "@/lib/profiles";
import { revalidatePath } from "next/cache";
import { currentAccountId, clearSessionCookie } from "@/lib/player-session";
import {
  createProfileFor,
  claimExisting,
  registerWithPassword,
  loginWithPassword,
  establishSession,
  submitApplication,
  submitClaim,
} from "@/lib/account";
import type { ApplicationInput } from "@/lib/application";

// Действия кабинета игрока. Все требуют вошедшего аккаунта — id берём из сессии, а не из формы,
// чтобы нельзя было действовать от чужого имени.

/** Выйти из кабинета. */
export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/me");
}

// ── вход/регистрация по email + паролю ─────────────────────────────────────────

// Состояние форм входа: только текст ошибки — успех уводит редиректом, показывать нечего.
export type AuthState = { error?: string } | null;

/** Регистрация: заводим аккаунт и сразу пускаем в кабинет. Писем нет — подтверждать нечего, а до
 *  апрува аккаунт всё равно в воронке (draft) и в лиге ничего не значит. */
export async function register(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const name = String(form.get("name") ?? "");
  if (password !== confirm) return { error: "Пароли не совпадают" };
  const res = await registerWithPassword(email, password, name);
  if (!res.ok) return { error: res.error };
  await establishSession(res.accountId);
  redirect("/me");
}

/** Вход по паролю: успех → сессия и redirect в кабинет. */
export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const res = await loginWithPassword(email, password);
  if (!res.ok) return { error: res.error };
  await establishSession(res.accountId);
  redirect("/me");
}

// ── анкета-заявка (аккаунт в draft/rejected) ───────────────────────────────────

// Состояние форм заявки. Кроме ошибки возвращаем и введённые значения: после submit React сбрасывает
// неуправляемые поля к defaultValue, и без этого длинная анкета очищалась бы на каждой опечатке.
export type ApplyState = { error?: string; values?: ApplicationInput } | null;

/** Отправка анкеты нового игрока. Все проверки — в submitApplication: форму можно и обойти. */
export async function sendApplication(_state: ApplyState, form: FormData): Promise<ApplyState> {
  const id = await currentAccountId();
  if (id == null) return { error: "Сессия истекла — войдите снова" };

  const text = (key: keyof ApplicationInput) => String(form.get(key) ?? "");
  const input: ApplicationInput = {
    nickname: text("nickname"),
    realName: text("realName"),
    birthday: text("birthday"),
    city: text("city"),
    country: text("country"),
    dotabuff: text("dotabuff"),
    stratz: text("stratz"),
    steam: text("steam"),
    telegram: text("telegram"),
    position: text("position"),
    mmr: text("mmr"),
    achievements: text("achievements"),
  };

  const error = await submitApplication(id, input, form.get("policy") != null);
  if (error) return { error, values: input };
  revalidatePath("/me");
  return null;
}

/** Отправка заявки на привязку к профилю из ростера — вторая ветка той же воронки. */
export async function sendClaim(_state: ApplyState, form: FormData): Promise<ApplyState> {
  const id = await currentAccountId();
  if (id == null) return { error: "Сессия истекла — войдите снова" };
  const playerId = Number(form.get("playerId"));
  if (!Number.isFinite(playerId) || playerId <= 0) return { error: "Выберите себя из списка" };

  const error = await submitClaim(id, playerId, form.get("policy") != null);
  if (error) return { error };
  revalidatePath("/me");
  return null;
}

/** Новый игрок завёл профиль по нику — создаём и уводим на его страницу в ростере. */
export async function createProfile(_state: string | null, form: FormData): Promise<string | null> {
  const id = await currentAccountId();
  if (id == null) return "Сессия истекла — войдите снова";
  const nick = String(form.get("nickname") ?? "").trim();
  if (!nick) return "Укажите ник";
  let playerId: number;
  try {
    playerId = await createProfileFor(id, nick);
  } catch (e) {
    return e instanceof Error ? e.message : "Не удалось создать профиль";
  }
  redirect(playerPath(playerId));
}

/** Заявка на существующего игрока — уходит оператору на подтверждение. */
export async function claim(_state: string | null, form: FormData): Promise<string | null> {
  const id = await currentAccountId();
  if (id == null) return "Сессия истекла — войдите снова";
  const playerId = Number(form.get("playerId"));
  if (!Number.isFinite(playerId) || playerId <= 0) return "Выберите себя из списка";
  try {
    await claimExisting(id, playerId);
  } catch (e) {
    return e instanceof Error ? e.message : "Не удалось подать заявку";
  }
  revalidatePath("/me");
  return null;
}
