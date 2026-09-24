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
 * браузер — нативные флажки `sr-only` плюс соседний чип (`.pouf-choice-chip` в
 * pouf.css). Клиентский атом потащил бы за собой клиентскую обёртку всей панели.
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
}) {
  const checked = new Set(defaultValue);
  // id выводим из имени поля, а не из useId: атом серверный, а имя в одной форме и так уникально.
  const describedBy = error ? `${name}-err` : hint ? `${name}-hint` : undefined;

  return (
    <fieldset className="pouf-field flex flex-col gap-(--s2)" disabled={disabled} aria-describedby={describedBy}>
      <legend className="pouf-label mb-(--s2) text-[13px] font-black uppercase tracking-[0.6px] text-ink">
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-[var(--color-err-ink)]">
            *
          </span>
        )}
      </legend>

      {/* Перенос обязателен: семь ролей по 44px не лягут в строку ни на 390, ни в колонке формы. */}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="inline-flex">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={checked.has(o.value)}
              disabled={o.disabled}
              className="peer sr-only"
            />
            {/* min-h-11 — тач-цель 44px на любой ширине: это поле под палец, а не фильтр в ряду
                (UI-GUIDELINES §6), поэтому высота не снимается на мыши, как у пилюль. */}
            <span className={pillClasses({ size: "md", className: "pouf-choice-chip min-h-11 cursor-pointer select-none" })}>
              {o.label}
            </span>
          </label>
        ))}
      </div>

      {hint && !error && (
        <span className="pouf-hint text-[13px] font-bold text-muted" id={`${name}-hint`}>
          {hint}
        </span>
      )}
      {error && <FieldError id={`${name}-err`}>{error}</FieldError>}
    </fieldset>
  );
}
