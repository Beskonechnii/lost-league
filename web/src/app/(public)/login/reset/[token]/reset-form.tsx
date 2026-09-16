"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setNewPassword, type ResetState } from "../actions";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { Label, PasswordField } from "@/components/pouf/Input";
import { PASSWORD_MIN } from "@/lib/password-rules";

// Форма нового пароля по ссылке. Требования к паролю — общие с регистрацией (шкала под полем и
// отказ сервера зовут один `passwordProblem`), отдельного набора правил для сброса нет.
//
// Текущий пароль здесь не спрашивают намеренно: его как раз и забыли, а владение аккаунтом
// доказывает сама ссылка — она пришла в привязанный телеграм либо от организатора.

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(setNewPassword, null);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="ok" block>
          Пароль сменён. Прежние входы в этот аккаунт разлогинены — если в него кто-то сидел с
          вашего старого пароля, его уже выбросило.
        </Alert>
        <Link href="/me" className="block text-center text-sm font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
          Войти с новым паролем →
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Новый пароль">
        <PasswordField
          name="next"
          autoComplete="new-password"
          placeholder={`Минимум ${PASSWORD_MIN} символов`}
          strength
          required
        />
      </Field>
      <Field label="Повторите пароль">
        <PasswordField name="confirm" autoComplete="new-password" required />
      </Field>
      <Button type="submit" loading={pending} size="lg" block>
        {pending ? "Сохраняю…" : "Задать пароль"}
      </Button>
      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
    </form>
  );
}
