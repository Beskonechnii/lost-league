"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentAccountId, clearSessionCookie } from "@/lib/player-session";
import {
  registerWithPassword,
  loginWithPassword,
  establishSession,
  submitApplication,
  submitClaimWithApplication,
  storeApplicationDraft,
  type AuthField,
} from "@/lib/account";
import { readMixCupIntentSlug, clearMixCupIntent, registerForMixCup } from "@/lib/mixcup";
import { noticeNewProfile, noticeProfileClaim } from "@/lib/queue-notify";
import type { ApplicationField, ApplicationInput } from "@/lib/application";

// Действия кабинета игрока. Все требуют вошедшего аккаунта — id берём из сессии, а не из формы,
// чтобы нельзя было действовать от чужого имени.

/** Выйти из кабинета. */
export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/me");
}

// ── вход/регистрация по email + паролю ─────────────────────────────────────────

/**
 * Состояние форм входа. Кроме ошибки возвращаем адрес поля (`field`) — форма кладёт текст в
 * плашку именно этого поля, а сводка сверху говорит, что форма не принята. Отказ без адреса
 * («неверная почта или пароль») живёт только сводкой.
 *
 * Пароли сюда не кладём НИКОГДА: набранное держит сама форма (поля управляемые, ТЗ 30), и гонять
 * пароль лишний раз через сеть незачем. Почта остаётся ради форм, где поле неуправляемое.
 */
export type AuthState = { error?: string; field?: AuthField; values?: { email: string } } | null;

/** Регистрация: заводим аккаунт и сразу пускаем в кабинет. Писем нет — подтверждать нечего, а до
 *  апрува аккаунт всё равно в воронке (draft) и в лиге ничего не значит. */
export async function register(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  // Расходится именно «повторите пароль» — плашка у него, а не общей сводкой.
  if (password !== confirm) return { error: "Пароли не совпадают", field: "confirm", values: { email } };
  const res = await registerWithPassword(email, password);
  if (!res.ok) return { error: res.error, field: res.field, values: { email } };
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
export type ApplyState = { error?: string; field?: ApplicationField; values?: ApplicationInput } | null;

/** Отправка анкеты нового игрока. Все проверки — в submitApplication: форму можно и обойти. */
export async function sendApplication(_state: ApplyState, form: FormData): Promise<ApplyState> {
  const id = await currentAccountId();
  if (id == null) return { error: "Сессия истекла — войдите снова" };

  const input: ApplicationInput = readApplicationInput(form);

  const refusal = await submitApplication(id, input, form.get("policy") != null);
  if (refusal) return { ...refusal, values: input };
  // Уведомление оператору — своим шагом после записи: анкета уже в очереди, и ронять её из-за
  // несостоявшегося сообщения нельзя (`queue-notify.ts` молчит сам, но порядок важен).
  await noticeNewProfile(input.nickname.trim(), id);
  await finishAfterApplication(id);
  return null;
}

/**
 * Общий хвост обеих форм анкеты: анкета отправлена — самое время реализовать исключение Mix Cup
 * (ТЗ 34, «в пул до апрува») и увести человека обратно на событие, если он шёл сюда через его
 * дверь (кука-намерение). Обычный путь (без намерения) не меняется — только revalidatePath.
 */
async function finishAfterApplication(accountId: number): Promise<void> {
  const slug = await readMixCupIntentSlug();
  if (slug) {
    const event = await prisma.mixCupEvent.findUnique({ where: { slug }, select: { id: true } });
    const res = event ? await registerForMixCup(accountId, event.id) : null;
    if (res?.ok) {
      await clearMixCupIntent();
      redirect(`/mixcup/${slug}`);
    }
  }
  revalidatePath("/me");
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
  if (!Number.isFinite(playerId) || playerId <= 0) return { error: "Выберите себя из списка ниже", field: "nickname" };

  const input = readApplicationInput(form);
  const refusal = await submitClaimWithApplication(id, playerId, input, form.get("policy") != null);
  if (refusal) return { ...refusal, values: input };
  await noticeProfileClaim(playerId, id);
  await finishAfterApplication(id);
  return null;
}

// Действий «завести профиль по нику» и «подать привязку без анкеты» здесь больше нет (Э18): это был
// второй, обходной вход в лигу — аккаунт без профиля заводил `Player` одним ником, минуя модерацию.
// Вход остался один, через анкету: `sendApplication` и `sendClaimWithApplication` выше.

// ── намерение Mix Cup (ТЗ 34) ───────────────────────────────────────────────────

/**
 * Разобрать куку-намерение с /mixcup/<slug> (см. lib/mixcup.ts): если вошедшему аккаунту уже
 * хватает профиля для записи — записывает и возвращает путь на событие, кука гасится. Не хватает
 * (анкеты ещё нет) — молчит и оставляет куку: вызовут снова, когда анкета будет отправлена
 * (see MixCupIntentConsumer, retryKey = submittedAt).
 */
export async function consumeMixCupIntent(): Promise<string | null> {
  const accountId = await currentAccountId();
  if (accountId == null) return null;
  const slug = await readMixCupIntentSlug();
  if (!slug) return null;

  const event = await prisma.mixCupEvent.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!event) {
    await clearMixCupIntent();
    return null;
  }

  const res = await registerForMixCup(accountId, event.id);
  if (!res.ok) {
    if (res.reason === "closed") await clearMixCupIntent(); // событие закрылось, пока шли — ждать больше нечего
    return null; // no-profile: попробуем снова после анкеты
  }
  await clearMixCupIntent();
  return `/mixcup/${slug}`;
}
