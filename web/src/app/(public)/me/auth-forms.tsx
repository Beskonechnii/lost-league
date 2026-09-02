"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { register, login, type AuthState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { FormInput, Label } from "@/components/pouf/Input";
import { PillButton, PillTrack } from "@/components/pouf/tabs";

// Формы входа по email + паролю: два режима — «Войти» и «Регистрация». Рядом с соц-входом
// (его рисует страница). Каждый режим — своя server-action через useActionState.
//
// Раскладка — по каноническому макету «Вход»: переключатель режима на вдавленной дорожке Кита
// поверх формы, поля стопкой, широкая кнопка снизу. До Э8 переключатель был свой (`bg-accent`
// с белым текстом — цвет из тёмной темы), а ошибка — своя розовая плашка мимо алертов Кита.
//
// «Забыли пароль» здесь нет намеренно: писем в проекте больше нет (docs/archive/ACCOUNTS-PLAN.md §2.4),
// поэтому восстановление — вход через Google той же почтой либо новый аккаунт.

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
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Почта">
        <FormInput name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required />
      </Field>
      <Field label="Пароль">
        <FormInput name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" loading={pending} size="lg" block>
        {pending ? "Вхожу…" : "Войти"}
      </Button>
      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
    </form>
  );
}

function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Почта">
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
      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
    </form>
  );
}
