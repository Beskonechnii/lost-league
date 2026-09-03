"use client";

import { useActionState, useId, useState } from "react";
import { savePassword, deleteAccount, type SecState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { Alert } from "@/components/pouf/feedback";
import { FormInput, Label } from "@/components/pouf/Input";

// Формы вкладки «Вход и защита»: смена/задание пароля и удаление аккаунта.
// Сообщения — алерты Кита (Э7): свои `rounded-md border border-rose-200` тут стояли третьей
// версией одной и той же плашки.

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Смена пароля, а для входивших только через Google — задание пароля впервые (без «текущего»). */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<SecState, FormData>(savePassword, null);
  return (
    <form action={action} className="space-y-4">
      {hasPassword && (
        <Field label="Текущий пароль">
          <FormInput name="current" type="password" autoComplete="current-password" required />
        </Field>
      )}
      <Field label="Новый пароль">
        <FormInput name="next" type="password" autoComplete="new-password" placeholder="Минимум 8 символов" required />
      </Field>
      <Field label="Повторите новый пароль">
        <FormInput name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending} block>
        {pending ? "Сохраняю…" : hasPassword ? "Сменить пароль" : "Задать пароль"}
      </Button>
      {state?.error && <Alert tone="err" block>{state.error}</Alert>}
      {state?.ok && <Alert tone="ok" block>{state.ok}</Alert>}
    </form>
  );
}

/** Удаление аккаунта — за подтверждением галочкой, чтобы не снести вход случайно. */
export function DeleteAccount() {
  const [confirmed, setConfirmed] = useState(false);
  const confirmId = useId();
  return (
    <form action={deleteAccount} className="space-y-3">
      {/* Флажок Кита (лунка → акцентная плитка), а не нативный с accent-color: подтверждение
          сноса аккаунта должно читаться как элемент этой системы, а не как системный квадратик. */}
      {/* Подпись соседним <label for>, а не обёрткой: флажок Кита — <button>, и клик по тексту
          доходит до него только через `for` (button — labelable-элемент). */}
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={confirmId}
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(v === true)}
          className="mt-0.5"
        />
        <label htmlFor={confirmId} className="text-[13px] font-bold leading-[1.5] text-muted">
          Понимаю: вход к профилю оборвётся. Профиль игрока и статистика в лиге останутся.
        </label>
      </div>
      <Button type="submit" disabled={!confirmed} block tone="down">
        Удалить аккаунт
      </Button>
    </form>
  );
}
