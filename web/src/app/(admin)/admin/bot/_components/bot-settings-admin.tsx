"use client";

import { useActionState } from "react";
import type { BotSettingsEditor } from "@/lib/bot-settings";
import { resetSetting, saveSetting, type BotState } from "../actions";

// Вкладка «Настройки» на /admin/bot: тайминги напоминаний и тексты уведомлений о встречах.
// Клиентский по той же причине, что и вкладка вопросов, — показать «сохранено» у той формы,
// которую нажали. Поле всегда показывает то, чем бот пользуется на самом деле: значение оператора
// либо дефолт из кода (`src/lib/bot-settings.ts`), поэтому пустых полей здесь не бывает.

const CARD = "rounded-lg border border-hairline bg-surface-1 p-4";
const INPUT =
  "mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent-bright";

function Note({ state }: { state: BotState }) {
  if (!state) return null;
  return <span className={`text-xs ${state.error ? "text-red-400" : "text-emerald-400"}`}>{state.error ?? state.ok}</span>;
}

function SettingCard({ field }: { field: BotSettingsEditor[number] }) {
  const [state, action, pending] = useActionState(saveSetting, null);
  const rows = Math.min(6, Math.max(2, field.current.split("\n").length + 1));

  return (
    <li className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{field.label}</span>
        {field.edited && (
          <form action={resetSetting}>
            <input type="hidden" name="key" value={field.key} />
            <button type="submit" className="rounded-md border border-hairline px-2 py-0.5 text-xs text-ink-subtle hover:text-ink">
              вернуть исходное
            </button>
          </form>
        )}
      </div>
      {field.hint && <p className="mt-0.5 text-xs text-ink-subtle">{field.hint}</p>}

      <form action={action}>
        <input type="hidden" name="key" value={field.key} />
        {field.kind === "text" ? (
          <textarea name="value" defaultValue={field.current} rows={rows} className={INPUT} />
        ) : field.kind === "choice" ? (
          <select name="value" defaultValue={field.current} className={INPUT}>
            {field.options!.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input name="value" defaultValue={field.current} className={INPUT} />
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-hairline px-3 py-1 text-xs text-ink hover:border-accent-bright disabled:opacity-50"
          >
            Сохранить
          </button>
          {field.vars?.length ? <span className="text-xs text-ink-subtle">подстановки: {field.vars.join(", ")}</span> : null}
          {field.edited && <span className="text-xs text-ink-subtle">изменено</span>}
          <Note state={state} />
        </div>
      </form>
    </li>
  );
}

export function BotSettingsAdmin({ settings }: { settings: BotSettingsEditor }) {
  const timing = settings.filter((f) => f.kind !== "text");
  const texts = settings.filter((f) => f.kind === "text");

  return (
    <>
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-subtle">Тайминги</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        За сколько бот напоминает о встрече, кому пишет и какие времена начала предлагает капитану.
        Правки действуют сразу — перезапускать бота не нужно.
      </p>
      <ul className="mt-3 space-y-3">
        {timing.map((f) => (
          <SettingCard key={f.key} field={f} />
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-subtle">Тексты уведомлений</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        Что бот пишет игрокам о встречах. Разметка — как в остальных сообщениях бота: <code>&lt;b&gt;жирный&lt;/b&gt;</code>.
        Подстановка в фигурных скобках подставляет данные встречи; незнакомая скобка останется текстом.
      </p>
      <ul className="mt-3 space-y-3">
        {texts.map((f) => (
          <SettingCard key={f.key} field={f} />
        ))}
      </ul>
    </>
  );
}
