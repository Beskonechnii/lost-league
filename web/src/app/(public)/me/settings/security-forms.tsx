"use client";

import { useActionState, useId, useState } from "react";
import { savePassword, deleteAccount, unlinkTg, type SecState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { Alert } from "@/components/pouf/feedback";
import { Label, PasswordField } from "@/components/pouf/Input";
import { PASSWORD_MIN, type PasswordContext } from "@/lib/password-rules";

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
export function PasswordForm({ hasPassword, context }: { hasPassword: boolean; context?: PasswordContext }) {
  const [state, action, pending] = useActionState<SecState, FormData>(savePassword, null);
  return (
    <form action={action} className="space-y-4">
      {hasPassword && (
        <Field label="Текущий пароль">
          {/* Без шкалы: текущий пароль уже задан, оценивать его поздно. */}
          <PasswordField name="current" autoComplete="current-password" required />
        </Field>
      )}
      <Field label="Новый пароль">
        <PasswordField
          name="next"
          autoComplete="new-password"
          placeholder={`Минимум ${PASSWORD_MIN} символов`}
          strength
          context={context}
          required
        />
      </Field>
      <Field label="Повторите новый пароль">
        <PasswordField name="confirm" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending} block>
        {pending ? "Сохраняю…" : hasPassword ? "Сменить пароль" : "Задать пароль"}
      </Button>
      {state?.error && <Alert tone="err" block>{state.error}</Alert>}
      {state?.ok && <Alert tone="ok" block>{state.ok}</Alert>}
    </form>
  );
}

/** Отвязать телеграм — тихой кнопкой под плашкой «привязан»: это не главное действие раздела. */
export function UnlinkTelegram() {
  // Обёрткой: у экшена аргументов нет вовсе — отвязка берёт аккаунт из сессии, из формы ей нечего взять.
  const [state, action, pending] = useActionState<SecState, FormData>(() => unlinkTg(), null);
  return (
    <form action={action} className="mt-3 space-y-2">
      <Button type="submit" variant="quiet" size="sm" disabled={pending}>
        {pending ? "Отвязываю…" : "Отвязать телеграм"}
      </Button>
      {/* Об удаче не рапортуем: раздел тут же перерисовывается кнопкой «Привязать телеграм»,
          и плашка «отвязано» осталась бы вторым сообщением о том же. Отказ — другое дело. */}
      {state?.error && <Alert tone="err" block>{state.error}</Alert>}
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
