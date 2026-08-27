"use client";

import { useActionState, useState } from "react";
import { saveQuestion, removeQuestion, moveQ, type QuizState } from "../../actions";

// Вопросы анкеты: та же форма у правки существующего и у добавления нового — различаются только
// скрытым id и подписью кнопки.

const FIELD =
  "mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent-bright";
const BTN = "rounded-md border border-hairline px-2 py-0.5 text-xs text-ink-subtle hover:text-ink";

type Question = { id: number; text: string; options: string[]; required: boolean };

function Note({ state }: { state: QuizState }) {
  if (!state) return null;
  return <span className={`text-xs ${state.error ? "text-red-400" : "text-emerald-400"}`}>{state.error ?? state.ok}</span>;
}

function QuestionForm({
  slug,
  quizId,
  question,
  onDone,
}: {
  slug: string;
  quizId: number;
  question?: Question;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: QuizState, form: FormData) => {
    const result = await saveQuestion(prev, form);
    if (result?.ok && !question) onDone?.();
    return result;
  }, null);

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="quizId" value={quizId} />
      {question && <input type="hidden" name="id" value={question.id} />}

      <label className="block">
        <span className="text-xs text-ink-muted">Вопрос</span>
        <textarea name="text" defaultValue={question?.text ?? ""} rows={2} className={FIELD} required />
      </label>
      <label className="mt-2 block">
        <span className="text-xs text-ink-muted">Варианты ответа — по одному в строке. Пусто: отвечают текстом</span>
        <textarea name="options" defaultValue={question?.options.join("\n") ?? ""} rows={3} className={FIELD} />
      </label>
      <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
        <input type="checkbox" name="required" defaultChecked={question?.required ?? true} className="size-3.5" />
        Обязательный — без него анкету не отправить
      </label>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-hairline px-3 py-1 text-xs text-ink hover:border-accent-bright disabled:opacity-50"
        >
          {question ? "Сохранить" : "Добавить вопрос"}
        </button>
        <Note state={state} />
      </div>
    </form>
  );
}

export function QuestionList({ slug, quizId, questions }: { slug: string; quizId: number; questions: Question[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <ul className="mt-3 space-y-3">
        {questions.map((question, i) => (
          <li key={question.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
              {i > 0 && (
                <form action={moveQ}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={question.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button type="submit" className={BTN}>↑ выше</button>
                </form>
              )}
              {i < questions.length - 1 && (
                <form action={moveQ}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={question.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button type="submit" className={BTN}>↓ ниже</button>
                </form>
              )}
              <form action={removeQuestion}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={question.id} />
                <button type="submit" className="rounded-md border border-hairline px-2 py-0.5 text-xs text-red-400 hover:border-red-800">
                  удалить
                </button>
              </form>
            </div>
            <QuestionForm slug={slug} quizId={quizId} question={question} />
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-3 rounded-lg border border-hairline bg-surface-1 p-4">
          <QuestionForm slug={slug} quizId={quizId} onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 rounded-md border border-hairline px-3 py-1 text-xs text-ink hover:border-accent-bright"
        >
          + вопрос
        </button>
      )}
    </>
  );
}
