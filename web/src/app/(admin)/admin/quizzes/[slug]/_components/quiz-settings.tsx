"use client";

import { useActionState, useState } from "react";
import { saveSettings, removeQuiz } from "../../actions";

// Настройки анкеты. Статус и срок рядом: «открыта» со вчерашним сроком — то же, что закрыта, и
// видеть эти два поля нужно вместе.

const FIELD =
  "mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent-bright";

type Quiz = { id: number; slug: string; title: string; description: string | null; status: string; closeAt: string | null };

export function QuizSettings({ quiz }: { quiz: Quiz }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  const [armed, setArmed] = useState(false);

  // <input type="datetime-local"> ждёт «yyyy-MM-ddTHH:mm» без зоны и секунд.
  const closeAt = quiz.closeAt ? new Date(quiz.closeAt).toISOString().slice(0, 16) : "";

  return (
    <div className="mt-4 rounded-lg border border-hairline bg-surface-1 p-4">
      <form action={action}>
        <input type="hidden" name="id" value={quiz.id} />
        <input type="hidden" name="slug" value={quiz.slug} />

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs text-ink-muted">Название — им подписана кнопка в боте</span>
            <input name="title" defaultValue={quiz.title} className={FIELD} required />
          </label>
          <label className="block">
            <span className="text-xs text-ink-muted">Статус</span>
            <select name="status" defaultValue={quiz.status} className={FIELD}>
              <option value="draft">Черновик — не видит никто</option>
              <option value="open">Открыта — бот предлагает</option>
              <option value="closed">Закрыта — ответы остаются</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs text-ink-muted">Описание — показывается перед первым вопросом</span>
            <textarea name="description" defaultValue={quiz.description ?? ""} rows={2} className={FIELD} />
          </label>
          <label className="block">
            <span className="text-xs text-ink-muted">Приём до — пусто: пока не закроете руками</span>
            <input type="datetime-local" name="closeAt" defaultValue={closeAt} className={FIELD} />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-hairline px-3 py-1 text-xs text-ink hover:border-accent-bright disabled:opacity-50"
          >
            Сохранить
          </button>
          {state && (
            <span className={`text-xs ${state.error ? "text-red-400" : "text-emerald-400"}`}>
              {state.error ?? state.ok}
            </span>
          )}
        </div>
      </form>

      <div className="mt-4 border-t border-hairline pt-3">
        {armed ? (
          <form action={removeQuiz} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={quiz.id} />
            <span className="text-xs text-ink-muted">Анкета удалится вместе со всеми ответами.</span>
            <button type="submit" className="rounded-md border border-red-800 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40">
              Удалить
            </button>
            <button type="button" onClick={() => setArmed(false)} className="text-xs text-ink-subtle hover:text-ink">
              отмена
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setArmed(true)} className="text-xs text-ink-subtle hover:text-red-400">
            Удалить анкету
          </button>
        )}
      </div>
    </div>
  );
}
