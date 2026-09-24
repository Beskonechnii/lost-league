import { Fragment } from "react";
import { FieldError } from "./Input";
import { pillClasses } from "./tabs";

/* Чипы выбора — артборд Кита «Атомы» (ряд чипов множественного выбора).
 *
 * Зачем атомом. Множественный выбор из короткого словаря (желаемые роли на записи
 * в турнир, ТЗ 38) собрать было не из чего: `Checkbox` — только коробочка 20px без
 * ряда и подписи, `PillButton`/`PillTrack` — навигационный разрез, а не поле формы
 * со значением, `Segmented` — ровно один выбранный и клиентский.
 *
 * Без "use client" намеренно: формы, которые его зовут, отправляются серверным
 * экшеном и читают значения из FormData по `name`. Состояние отмеченности рисует
 * браузер — нативные флажки `sr-only` плюс соседняя подпись с чипом
 * (`.pouf-choice-chip` в pouf.css). Клиентский атом потащил бы за собой клиентскую обёртку всей панели.
 *
 * Своя подпись и своя ошибка, без обёртки в `Field`: группа флажков — это
 * `<fieldset>` + `<legend>`, а `Field` рисует `<label for>` на один контрол.
 * Разметка внутри повторяет `Field` (`pouf-field` / `pouf-label` / `pouf-hint` /
 * `FieldError`), поэтому в стопке формы группа стоит вровень с обычными полями.
 */

export type ChoiceOption = { value: string; label: string; disabled?: boolean };

export function ChoiceChips({
  name,
  label,
  options,
  defaultValue = [],
  hint,
  error,
  required,
  disabled,
  max,
}: {
  /** Имя поля формы: отмеченные уходят несколькими значениями одного имени
   *  (`formData.getAll(name)`). */
  name: string;
  label: string;
  options: ChoiceOption[];
  defaultValue?: string[];
  hint?: string;
  error?: string;
  required?: boolean;
  /** Выключить всю группу. */
  disabled?: boolean;
  /** Сколько чипов можно отметить. Лимит достигнут — неотмеченные гаснут и не нажимаются
   *  (рисует браузер, `:has()` в pouf.css). Это удобство, а не гарантия: лишнее ловит сервер. */
  max?: number;
}) {
  const checked = new Set(defaultValue);
  // id выводим из имени поля, а не из useId: атом серверный, а имя в одной форме и так уникально.
  const describedBy = error ? `${name}-err` : hint ? `${name}-hint` : undefined;

  return (
    <fieldset
      className="pouf-field pouf-chips flex flex-col gap-(--s2)"
      data-max={max}
      disabled={disabled}
      aria-describedby={describedBy}
    >
      <legend className="pouf-label mb-(--s2) text-[13px] font-black uppercase tracking-[0.6px] text-ink">
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-[var(--color-err-ink)]">
            *
          </span>
        )}
      </legend>

      {/* Перенос обязателен: семь ролей по 44px не лягут в строку ни на 390, ни в колонке формы.
          Флажок стоит РЯДОМ со своей подписью, а не внутри неё (связь по `for`): так все флажки
          ряда — соседи, и браузер умеет сосчитать отмеченные (`input:checked ~ input:checked`
          в pouf.css). Вложенные друг в друга `:has()` запрещены, а другого счётчика в CSS нет.
          Сам флажок `sr-only` — он absolute и в раскладке ряда не участвует. */}
      <div className="pouf-chips-row flex flex-wrap gap-2">
        {options.map((o) => (
          <Fragment key={o.value}>
            <input
              type="checkbox"
              id={`${name}-${o.value}`}
              name={name}
              value={o.value}
              defaultChecked={checked.has(o.value)}
              disabled={o.disabled}
              className="sr-only"
            />
            <label htmlFor={`${name}-${o.value}`} className="inline-flex">
              {/* min-h-11 — тач-цель 44px на любой ширине: это поле под палец, а не фильтр в ряду
                  (UI-GUIDELINES §6), поэтому высота не снимается на мыши, как у пилюль. */}
              <span className={pillClasses({ size: "md", className: "pouf-choice-chip min-h-11 cursor-pointer select-none" })}>
                {o.label}
              </span>
            </label>
          </Fragment>
        ))}
      </div>

      {hint && !error && (
        <span className="pouf-hint text-[13px] font-bold text-muted" id={`${name}-hint`}>
          {hint}
        </span>
      )}
      {/* Почему третий чип не нажимается — текстом, а не догадкой. Строка есть в разметке всегда,
          показывает её тот же `:has()`, что гасит чипы: живого счётчика у серверного атома быть
          не может, а несчитающийся счётчик хуже его отсутствия. */}
      {max != null && (
        <span className="pouf-chips-limit text-[13px] font-bold text-muted">
          Выбрано {max} из {max}: снимите одну, чтобы выбрать другую
        </span>
      )}
      {error && <FieldError id={`${name}-err`}>{error}</FieldError>}
    </fieldset>
  );
}
