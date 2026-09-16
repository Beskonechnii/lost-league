"use server";

import { requestReset, redeemReset } from "@/lib/password-reset";

// Экшены сброса пароля. Вся логика — в `lib/password-reset.ts`: здесь только разбор формы, чтобы
// один и тот же сброс из публичной формы и из админки шёл одним кодом.

export type RequestState = { sent?: boolean; error?: string } | null;

/**
 * Запрос ссылки по почте. Успех — всегда `sent: true`, независимо от того, нашёлся аккаунт или нет
 * и есть ли у него телеграм: разный ответ превратил бы форму в проверялку чужих почт. Единственный
 * отличимый исход — лимит частоты, и он считается ДО поиска аккаунта, поэтому тоже ничего не выдаёт.
 */
export async function askReset(_state: RequestState, form: FormData): Promise<RequestState> {
  const res = await requestReset(String(form.get("email") ?? ""));
  return res.ok ? { sent: true } : { error: res.error };
}

export type ResetState = { ok?: boolean; error?: string } | null;

/** Новый пароль по ссылке. Токен — скрытым полем: он уже в адресе, из формы его брать удобнее,
 *  чем протаскивать параметры маршрута в клиентский компонент. */
export async function setNewPassword(_state: ResetState, form: FormData): Promise<ResetState> {
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { error: "Пароли не совпадают" };

  const res = await redeemReset(String(form.get("token") ?? ""), next);
  if (res.ok) return { ok: true };
  // «Ссылка протухла прямо в процессе» — тот же текст, что на экране входа по ссылке: страница
  // уже отрисована, перерисовывать её из-за редкого случая незачем.
  return {
    error:
      "error" in res
        ? res.error
        : "Ссылка больше не действует — она одноразовая. Запросите новую на странице «Забыли пароль?».",
  };
}
