"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentAccountId, clearSessionCookie } from "@/lib/player-session";
import {
  registerWithPassword,
  loginWithPassword,
  establishSession,
  submitApplication,
  submitClaimWithApplication,
  storeApplicationDraft,
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

/**
 * Состояние форм входа. Кроме ошибки возвращаем введённое — после submit React сбрасывает
 * неуправляемые поля к defaultValue, и отказ сервера («почта занята», «пароль слишком простой»)
 * стирал заодно и правильно набранную почту (Э15). Пароли сюда не кладём НИКОГДА: их набирают
 * заново — они и так под звёздочками, и гонять их лишний раз через сеть незачем.
 */
export type AuthState = { error?: string; values?: { email: string } } | null;

/** Регистрация: заводим аккаунт и сразу пускаем в кабинет. Писем нет — подтверждать нечего, а до
 *  апрува аккаунт всё равно в воронке (draft) и в лиге ничего не значит. */
export async function register(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password !== confirm) return { error: "Пароли не совпадают", values: { email } };
  const res = await registerWithPassword(email, password);
  if (!res.ok) return { error: res.error, values: { email } };
  await establishSession(res.accountId, form.get("remember") != null);
  redirect("/me");
}

/** Вход по паролю: успех → сессия и redirect в кабинет. */
export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const res = await loginWithPassword(email, password);
  if (!res.ok) return { error: res.error, values: { email } };
  await establishSession(res.accountId, form.get("remember") != null);
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

  const input: ApplicationInput = readApplicationInput(form);

  const error = await submitApplication(id, input, form.get("policy") != null);
  if (error) return { error, values: input };
  revalidatePath("/me");
  return null;
}

/**
 * Черновик квиза: форма зовёт его на каждом переходе вперёд по шагу.
 *
 * Без валидации намеренно — сохраняем ровно то, что человек успел ввести. Без `revalidatePath`:
 * значения уже в полях формы, перерисовывать страницу не из-за чего (а перерисовка сбросила бы
 * незакоммиченный ввод текущего шага). Молчит и при истёкшей сессии: черновик — удобство,
 * ломать им переход на следующий шаг нельзя.
 */
export async function saveApplicationDraft(form: FormData): Promise<void> {
  const id = await currentAccountId();
  if (id == null) return;
  const step = Number(form.get("step"));
  const playerId = Number(form.get("playerId"));
  await storeApplicationDraft(id, {
    values: readApplicationInput(form),
    step: Number.isInteger(step) && step >= 0 ? step : 0,
    playerId: Number.isInteger(playerId) && playerId > 0 ? playerId : null,
    policy: form.get("policy") != null,
  });
}

/** Считать анкету из FormData — общий разбор для «новый игрок» и «я уже участник лиги». */
function readApplicationInput(form: FormData): ApplicationInput {
  const text = (key: keyof ApplicationInput) => String(form.get(key) ?? "");
  return {
    nickname: text("nickname"),
    realName: text("realName"),
    realSurname: text("realSurname"),
    birthday: text("birthday"),
    city: text("city"),
    country: text("country"),
    profileUrl: text("profileUrl"),
    telegram: text("telegram"),
    phone: text("phone"),
    position: text("position"),
    mmr: text("mmr"),
  };
}

/** «Я уже участник лиги»: тот же квиз, но найденный по нику игрок — привязка, а не новый профиль.
 *  Заполненное в квизе дополняет его карточку (submitClaimWithApplication сам решает, что пусто). */
export async function sendClaimWithApplication(_state: ApplyState, form: FormData): Promise<ApplyState> {
  const id = await currentAccountId();
  if (id == null) return { error: "Сессия истекла — войдите снова" };
  const playerId = Number(form.get("playerId"));
  if (!Number.isFinite(playerId) || playerId <= 0) return { error: "Выберите себя из списка ниже" };

  const input = readApplicationInput(form);
  const error = await submitClaimWithApplication(id, playerId, input, form.get("policy") != null);
  if (error) return { error, values: input };
  revalidatePath("/me");
  return null;
}

// Действий «завести профиль по нику» и «подать привязку без анкеты» здесь больше нет (Э18): это был
// второй, обходной вход в лигу — аккаунт без профиля заводил `Player` одним ником, минуя модерацию.
// Вход остался один, через анкету: `sendApplication` и `sendClaimWithApplication` выше.
