"use client";

import { useActionState } from "react";
import { loginByCode, type CodeState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Поле для шести цифр из бота. Успех уводит редиректом в кабинет, поэтому состояние формы — только
// текст ошибки, как у входа по паролю (`/me/auth-forms.tsx`).

export function CodeForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(loginByCode, null);

  return (
    <form action={action} className="space-y-3">
      <Input
        name="code"
        // Цифровая клавиатура на телефоне и никакого автозаполнения: код одноразовый, сохранять его
        // менеджеру паролей незачем. `pattern` не режет ввод — пробел и дефис разбирает сервер.
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={9}
        placeholder="123456"
        aria-label="Код из бота"
        className="h-12 text-center font-mono text-2xl tracking-[0.4em]"
        required
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Проверяю…" : "Войти"}
      </Button>
      {state?.error && (
        <p className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">{state.error}</p>
      )}
    </form>
  );
}
