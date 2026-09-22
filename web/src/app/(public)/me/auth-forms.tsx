"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { register, login, type AuthState } from "./actions";
import type { AuthField } from "@/lib/account";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { Alert } from "@/components/pouf/feedback";
import { Field, FormInput, PasswordField } from "@/components/pouf/Input";
import { PASSWORD_MIN } from "@/lib/password-rules";
import { PillButton, PillTrack } from "@/components/pouf/tabs";

// Формы входа по email + паролю: два режима — «Войти» и «Регистрация». Рядом с соц-входом
// (его рисует страница). Каждый режим — своя server-action через useActionState.
//
// Раскладка — по каноническому макету «Вход»: переключатель режима на вдавленной дорожке Кита
// поверх формы, поля стопкой, широкая кнопка снизу. До Э8 переключатель был свой (`bg-accent`
// с белым текстом — цвет из тёмной темы), а ошибка — своя розовая плашка мимо алертов Кита.
//
// «Забыли пароль?» — ссылкой под формой входа (ТЗ 02). Писем лига по-прежнему не шлёт: ссылка на
// смену уходит в привязанный телеграм, а у кого его нет — её выдаёт организатор из админки.
// Сам экран живёт на `/login/reset`, рядом со входом по коду из бота.

type Mode = "login" | "register";

export function AuthForms() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="space-y-5">
      <PillTrack label="Вход или регистрация">
        <PillButton size="md" variant="quiet" active={mode === "login"} onClick={() => setMode("login")}>
          Вход
        </PillButton>
        <PillButton size="md" variant="quiet" active={mode === "register"} onClick={() => setMode("register")}>
          Регистрация
        </PillButton>
      </PillTrack>

      {mode === "login" ? <LoginForm /> : <RegisterForm />}

      {/* Строка снизу из макета «Вход» — второй, более заметный путь переключить режим,
          рядом с табами наверху. */}
      <p className="text-center text-[13px] font-bold text-muted">
        {mode === "login" ? (
          <>
            Нет аккаунта?{" "}
            <button type="button" onClick={() => setMode("register")} className="font-black text-ink hover:text-[var(--accent-ink)]">
              Регистрация
            </button>
          </>
        ) : (
          <>
            Уже есть аккаунт?{" "}
            <button type="button" onClick={() => setMode("login")} className="font-black text-ink hover:text-[var(--accent-ink)]">
              Войти
            </button>
          </>
        )}
      </p>
    </div>
  );
}

/** «Запомнить меня» — из макета «Вход»: без него кука входа живёт до закрытия браузера.
 *  Флажок Кита управляемый (значение в состоянии React), поэтому ответ сервера его не сбрасывает —
 *  возвращать из AuthState, как почту, тут нечего. */
function RememberMe() {
  const [on, setOn] = useState(false);
  const id = useId();
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} name="remember" checked={on} onCheckedChange={(v) => setOn(v === true)} />
      <label htmlFor={id} className="text-[13px] font-bold text-muted">
        Запомнить меня
      </label>
    </div>
  );
}

function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null);
  return (
    // noValidate: нативный пузырёк — второй язык ошибок поверх плашки Кита (ТЗ 30).
    <form action={action} noValidate className="space-y-4">
      {/* Слот сообщения один и он СВЕРХУ, над полями, к которым относится. Отказ входа адреса
          не имеет («неверная почта или пароль» — намеренно не говорит, что из двух), поэтому
          живёт только здесь. */}
      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
      {/* Почта возвращается из состояния: после отказа React сбрасывает неуправляемые поля
          к defaultValue, и без этого «неверный пароль» стирал заодно правильно набранный адрес.
          Пароль возвращать нечем и незачем — его набирают заново. */}
      <Field label="Почта" required>
        {(id, describedBy) => (
          <FormInput
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            aria-describedby={describedBy}
            defaultValue={state?.values?.email ?? ""}
            placeholder="you@gmail.com"
            required
          />
        )}
      </Field>
      <Field label="Пароль" required>
        {(id, describedBy) => (
          <PasswordField id={id} name="password" autoComplete="current-password" aria-describedby={describedBy} required />
        )}
      </Field>
      {/* «Запомнить меня» и «Забыли пароль?» — одной строкой: оба про вход, и вторая обязана быть
          видна ровно там, где пароль не подошёл, а не в подвале страницы. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RememberMe />
        <Link
          href="/login/reset"
          className="text-[13px] font-bold text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Забыли пароль?
        </Link>
      </div>
      <Button type="submit" loading={pending} size="lg" block>
        {pending ? "Вхожу…" : "Войти"}
      </Button>
    </form>
  );
}

/**
 * Регистрация.
 *
 * Все три поля УПРАВЛЯЕМЫЕ — в этом весь смысл правки (ТЗ 30): после отказа сервера React
 * возвращает неуправляемое поле к defaultValue, и «пароль слишком короткий» стирал оба пароля,
 * заставляя набирать их заново вместо того, чтобы дописать пару знаков. На сервер пароли
 * по-прежнему уходят только с отправкой формы и обратно не возвращаются.
 */
function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Плашка гаснет на первом вводе в отвергнутое поле; сводка сверху держится до следующей отправки.
  // Помним сам ответ, а не флаг: следующий отказ — новый объект, и плашка зажигается сама.
  const [dismissed, setDismissed] = useState<AuthState>(null);
  const plate = (field: AuthField) =>
    state && dismissed !== state && state.field === field ? state.error : undefined;
  const touch = (field: AuthField) => {
    if (state?.field === field) setDismissed(state);
  };

  return (
    <form action={action} noValidate className="space-y-4">
      {state?.error && (
        <Alert tone="err" block>
          {/* Отказ с адресом поля уже стоит плашкой под ним — сводке остаётся сказать, что не приняли. */}
          {state.field ? "Не приняли — поправьте отмеченное поле" : state.error}
        </Alert>
      )}
      <Field label="Почта" required error={plate("email")}>
        {(id, describedBy) => (
          <FormInput
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            aria-describedby={describedBy}
            invalid={!!plate("email")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              touch("email");
            }}
            placeholder="you@gmail.com"
            required
          />
        )}
      </Field>
      <Field label="Пароль" required error={plate("password")}>
        {(id, describedBy) => (
          /* Почту в контекст шкалы не отдаём: она в соседнем поле и здесь её ещё нет —
             совпадение пароля с почтой ловит сервер при отправке. */
          <PasswordField
            id={id}
            name="password"
            autoComplete="new-password"
            aria-describedby={describedBy}
            invalid={!!plate("password")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              touch("password");
            }}
            placeholder={`Минимум ${PASSWORD_MIN} символов`}
            strength
            required
          />
        )}
      </Field>
      <Field label="Повторите пароль" required error={plate("confirm")}>
        {(id, describedBy) => (
          <PasswordField
            id={id}
            name="confirm"
            autoComplete="new-password"
            aria-describedby={describedBy}
            invalid={!!plate("confirm")}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              touch("confirm");
            }}
            required
          />
        )}
      </Field>
      <Button type="submit" loading={pending} size="lg" block>
        {pending ? "Создаю…" : "Зарегистрироваться"}
      </Button>
      <p className="text-center text-[13px] font-bold leading-[1.5] text-muted">
        Регистрация — заявка в лигу: дальше нужно заполнить анкету. Отправляя её, вы соглашаетесь с{" "}
        <Link href="/rules" target="_blank" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
          правилами лиги
        </Link>
        .
      </p>
    </form>
  );
}
