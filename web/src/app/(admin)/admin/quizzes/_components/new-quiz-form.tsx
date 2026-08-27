"use client";

import { useActionState } from "react";
import { create } from "../actions";

// Создание — одно поле: название. Всё остальное правится на странице анкеты, где это видно рядом
// с вопросами; спрашивать статус и срок до того, как есть хоть один вопрос, незачем.

export function NewQuizForm() {
  const [state, action, pending] = useActionState(create, null);

  return (
    <form action={action} className="mt-6 flex flex-wrap items-center gap-2">
      <input
        name="title"
        placeholder="Название новой анкеты"
        required
        className="min-w-0 flex-1 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent-bright"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-hairline px-3 py-2 text-xs text-ink hover:border-accent-bright disabled:opacity-50"
      >
        Создать
      </button>
      {state?.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  );
}
