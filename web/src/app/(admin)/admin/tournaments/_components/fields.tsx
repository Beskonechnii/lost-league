import type { ReactNode } from "react";
import { FormInput, FormSelect, FormTextarea, Label } from "@/components/pouf/Input";
import { DateField } from "@/components/pouf/date-field";

// Общие куски форм админки турниров: подпись + поле. Формы здесь простые (server actions, без
// клиентского состояния), поэтому вместо компонента-обёртки на каждый случай — одно поле на все.
//
// Подпись — китовая (`Label`): до Э9 здесь стоял свой `<span className="text-xs text-ink-muted">`,
// то есть третий голос подписи поля на сайте рядом с `Field` и `Label` из Кита.

export function Field({
  name,
  label,
  value,
  placeholder,
  type = "text",
  required = false,
  textarea = false,
  hint,
  children,
  span,
  options,
  inputMode,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  hint?: string;
  /** Варианты `<option>` — поле становится выпадающим списком. */
  children?: ReactNode;
  /** Занять несколько колонок сетки формы. */
  span?: 2 | 3;
  /** Подсказка уже заведённых значений при вводе (`<datalist>`) — поле остаётся свободным. */
  options?: string[];
  inputMode?: "numeric";
}) {
  const common = {
    name,
    id: `f-${name}`,
    required,
    placeholder,
    defaultValue: value ?? undefined,
  };
  const now = new Date();

  return (
    <div className={span === 3 ? "sm:col-span-3" : span === 2 ? "sm:col-span-2" : undefined}>
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <div className="mt-1.5">
        {/* Даты — календарём Кита, а не нативным `<input type="date">`: иначе посреди подушек
            всплывает серо-синий календарь браузера. Разворот здесь, а не по месту вызова, — тогда
            мастер и карточка турнира одинаковы по построению, а не по договорённости. */}
        {type === "date" ? (
          <DateField
            name={name}
            id={common.id}
            required={required}
            size="sm"
            defaultValue={value == null ? "" : String(value)}
            // Турнир живёт в ближайших годах, а не с 1950-го, как дата рождения, и пустое поле
            // открывается на нынешнем месяце — «Старт» ставят рядом с сегодня, а не через два года.
            years={[now.getFullYear() - 1, now.getFullYear() + 5]}
            openAt={{ y: now.getFullYear(), m: now.getMonth() + 1 }}
          />
        ) : children ? (
          <FormSelect {...common} size="sm">
            {children}
          </FormSelect>
        ) : textarea ? (
          <FormTextarea {...common} rows={4} />
        ) : (
          <>
            <FormInput
              {...common}
              type={type}
              size="sm"
              inputMode={inputMode}
              list={options ? `${common.id}-list` : undefined}
            />
            {options && (
              <datalist id={`${common.id}-list`}>
                {options.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            )}
          </>
        )}
      </div>
      {hint && <span className="mt-1.5 block font-pouf text-[11px] font-bold text-muted">{hint}</span>}
    </div>
  );
}
