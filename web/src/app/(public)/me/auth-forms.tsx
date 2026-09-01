"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { register, login, type AuthState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";

// Формы входа по email + паролю: два режима — «Войти» и «Регистрация». Рядом с Google-кнопкой
// (её рисует страница). Каждый режим — своя server-action через useActionState.
//
// «Забыли пароль» здесь нет намеренно: писем в проекте больше нет (docs/archive/ACCOUNTS-PLAN.md §2.4), поэтому
// восстановление — вход через Google той же почтой либо новый аккаунт.

type Mode = "login" | "register";

// Успех обеих форм — редирект в кабинет, поэтому «зелёного» состояния тут нет: только ошибка.
const box = {
  error: "rounded-md border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-700",
};

export function AuthForms() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="space-y-4">
      {/* Переключатель Войти / Регистрация — как сегмент-контрол */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-hairline bg-surface-2/60 p-1">
        <Seg active={mode === "login"} onClick={() => setMode("login")}>Войти</Seg>
        <Seg active={mode === "register"} onClick={() => setMode("register")}>Регистрация</Seg>
      </div>

      {mode === "login" ? <LoginForm /> : <RegisterForm />}
    </div>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null);
  return (
    <form action={action} className="space-y-3">
      <Field label="Email">
        <FormInput name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required />
      </Field>
      <Field label="Пароль">
        <FormInput name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} block>
        {pending ? "Вхожу…" : "Войти"}
      </Button>
      {state?.error && <p className={box.error}>{state.error}</p>}
    </form>
  );
}

function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, null);
  return (
    <form action={action} className="space-y-3">
      <Field label="Email">
        <FormInput name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required />
      </Field>
      <Field label="Имя (необязательно)">
        <FormInput name="name" autoComplete="name" placeholder="Как к вам обращаться" />
      </Field>
      <Field label="Пароль">
        <FormInput name="password" type="password" autoComplete="new-password" placeholder="Минимум 8 символов" required />
      </Field>
      <Field label="Повторите пароль">
        <FormInput name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending} block>
        {pending ? "Создаю…" : "Зарегистрироваться"}
      </Button>
      <p className="text-center text-xs text-ink-subtle">
        Регистрация — заявка в лигу: дальше нужно заполнить анкету. Отправляя её, вы соглашаетесь с{" "}
        <Link href="/rules" target="_blank" className="text-accent underline underline-offset-2">
          правилами лиги
        </Link>
        .
      </p>
      {state?.error && <p className={box.error}>{state.error}</p>}
    </form>
  );
}
