import type { ReactNode } from "react";
import { FormInput, FormSelect, FormTextarea, Label } from "@/components/pouf/Input";

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
}) {
  const common = {
    name,
    id: `f-${name}`,
    required,
    placeholder,
    defaultValue: value ?? undefined,
  };
  return (
    <div className={span === 3 ? "sm:col-span-3" : span === 2 ? "sm:col-span-2" : undefined}>
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <div className="mt-1.5">
        {children ? (
          <FormSelect {...common} size="sm">
            {children}
          </FormSelect>
        ) : textarea ? (
          <FormTextarea {...common} rows={4} />
        ) : (
          <FormInput {...common} type={type} size="sm" />
        )}
      </div>
      {hint && <span className="mt-1.5 block font-pouf text-[11px] font-bold text-muted">{hint}</span>}
    </div>
  );
}
