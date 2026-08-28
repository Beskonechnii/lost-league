"use client";

import { useActionState, useState } from "react";
import type { QuizEditor } from "@/lib/quiz-config";
import { saveText, saveCustom, toggleStep, toggleCustom, deleteCustom, moveCustom, type BotState } from "../actions";

// Экран правки вопросов бота. Клиентский ради одного: показать «сохранено» у той формы, которую
// нажали. Всё остальное — обычные формы к server-action.
//
// Поле показывает то, что бот скажет на самом деле (текст оператора либо дефолт), поэтому «пусто»
// здесь не бывает: пустой формулировки у шага нет.

const CARD = "rounded-lg border border-hairline bg-surface-1 p-4";
const INPUT =
  "mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent-bright";

function Note({ state }: { state: BotState }) {
  if (!state) return null;
  return (
    <span className={`text-xs ${state.error ? "text-red-400" : "text-emerald-400"}`}>{state.error ?? state.ok}</span>
  );
}

/** Один встроенный шаг: текст + (у необязательных) выключатель «спрашивать». */
function StepCard({ slot }: { slot: QuizEditor["slots"][number] }) {
  const [state, action, pending] = useActionState(saveText, null);
  const rows = Math.min(6, Math.max(2, slot.value.split("\n").length + 1));

  return (
    <li className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{slot.label}</span>
        {slot.optional && (
          <form action={toggleStep}>
            <input type="hidden" name="key" value={slot.key} />
            <input type="hidden" name="enabled" value={slot.enabled ? "0" : "1"} />
            <button
              type="submit"
              className={`rounded-md border px-2 py-0.5 text-xs ${
                slot.enabled ? "border-emerald-800 text-emerald-400" : "border-hairline text-ink-subtle"
              }`}
            >
              {slot.enabled ? "спрашивать" : "не спрашивать"}
            </button>
          </form>
        )}
      </div>
      {slot.hint && <p className="mt-0.5 text-xs text-ink-subtle">{slot.hint}</p>}

      <form action={action} className={slot.enabled ? "" : "opacity-50"}>
        <input type="hidden" name="key" value={slot.key} />
        <textarea name="text" defaultValue={slot.value} rows={rows} className={INPUT} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-hairline px-3 py-1 text-xs text-ink hover:border-accent-bright disabled:opacity-50"
          >
            Сохранить
          </button>
          {slot.vars?.length ? <span className="text-xs text-ink-subtle">подстановки: {slot.vars.join(", ")}</span> : null}
          {slot.edited && <span className="text-xs text-ink-subtle">изменён</span>}
          <Note state={state} />
        </div>
      </form>
    </li>
  );
}

/** Свой вопрос: тот же вид у правки существующего и у добавления нового. */
function CustomForm({ question, onDone }: { question?: QuizEditor["custom"][number]; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: BotState, form: FormData) => {
    const result = await saveCustom(prev, form);
    if (result?.ok && !question) onDone?.();
    return result;
  }, null);

  return (
    <form action={action}>
      {question && <input type="hidden" name="key" value={question.key} />}
      <label className="block">
        <span className="text-xs text-ink-muted">Вопрос</span>
        <textarea name="text" defaultValue={question?.text ?? ""} rows={2} className={INPUT} required />
      </label>
      <label className="mt-2 block">
        <span className="text-xs text-ink-muted">Варианты ответа — по одному в строке. Пусто: отвечают текстом</span>
        <textarea name="options" defaultValue={question?.options.join("\n") ?? ""} rows={3} className={INPUT} />
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

function CustomCard({ question, first, last }: { question: QuizEditor["custom"][number]; first: boolean; last: boolean }) {
  return (
    <li className={CARD}>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        {!first && (
          <form action={moveCustom}>
            <input type="hidden" name="key" value={question.key} />
            <input type="hidden" name="dir" value="up" />
            <button type="submit" className="rounded-md border border-hairline px-2 py-0.5 text-xs text-ink-subtle hover:text-ink">
              ↑ выше
            </button>
          </form>
        )}
        {!last && (
          <form action={moveCustom}>
            <input type="hidden" name="key" value={question.key} />
            <input type="hidden" name="dir" value="down" />
            <button type="submit" className="rounded-md border border-hairline px-2 py-0.5 text-xs text-ink-subtle hover:text-ink">
              ↓ ниже
            </button>
          </form>
        )}
        <form action={toggleCustom}>
          <input type="hidden" name="key" value={question.key} />
          <input type="hidden" name="enabled" value={question.enabled ? "0" : "1"} />
          <button
            type="submit"
            className={`rounded-md border px-2 py-0.5 text-xs ${
              question.enabled ? "border-emerald-800 text-emerald-400" : "border-hairline text-ink-subtle"
            }`}
          >
            {question.enabled ? "спрашивать" : "не спрашивать"}
          </button>
        </form>
        <form action={deleteCustom}>
          <input type="hidden" name="key" value={question.key} />
          <button type="submit" className="rounded-md border border-hairline px-2 py-0.5 text-xs text-red-400 hover:border-red-800">
            удалить
          </button>
        </form>
      </div>
      <div className={question.enabled ? "" : "opacity-50"}>
        <CustomForm question={question} />
      </div>
    </li>
  );
}

export function BotAdmin({ quiz }: { quiz: QuizEditor }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <p className="mt-6 max-w-2xl text-sm text-ink-muted">
        Что бот спрашивает у капитана в телеграме. Правки действуют сразу — перезапускать бота не нужно.
        Порядок шагов и обязательные вопросы (ник, позиция, ссылка на профиль) не меняются: без них
        заявку нечего одобрять.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-subtle">Шаги квиза</h2>
      <ul className="mt-3 space-y-3">
        {quiz.slots.map((slot) => (
          <StepCard key={slot.key} slot={slot} />
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-subtle">Свои вопросы</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        Задаются в конце, когда состав собран. Ответы приезжают в заявку отдельным блоком и видны на
        странице заявок турнира.
      </p>
      <ul className="mt-3 space-y-3">
        {quiz.custom.map((question, i) => (
          <CustomCard key={question.key} question={question} first={i === 0} last={i === quiz.custom.length - 1} />
        ))}
      </ul>

      {adding ? (
        <div className={`mt-3 ${CARD}`}>
          <CustomForm onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 rounded-md border border-hairline px-3 py-1 text-xs text-ink hover:border-accent-bright"
        >
          + свой вопрос
        </button>
      )}
    </>
  );
}
