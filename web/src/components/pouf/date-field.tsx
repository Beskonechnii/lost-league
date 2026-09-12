"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Icon } from "./Icon";
import { inputClasses } from "./Input";
import { Calendar } from "./calendar";

/* Поле даты со СВОИМ календарём.
 *
 * Зачем не `<input type="date">`. Нативное поле рисует календарь браузера: в Chrome он серо-синий,
 * в Safari другой, и ни один не знает ни про подушки Кита, ни про акцент. На анкете это единственное
 * место, где всплывает чужой интерфейс. Плюс для даты рождения нативный календарь неудобен принципиально —
 * он листает по месяцу, а до 1998 года листать двести раз.
 *
 * Устройство. Само значение живёт в обычном текстовом поле (`name`, `required`, `reportValidity`
 * работают как раньше) в формате «21.04.1998» — сервер такой и ждёт (`parseBirthday`). Календарь —
 * попап справа от поля: год и месяц выбираются списками, день — сеткой. Значит, дату можно и набрать
 * руками, и выбрать мышью, а форма остаётся неуправляемой, как все формы серверных экшенов.
 */

/** Значение поля → части даты. Понимает и «21.04.1998», и «1998-04-21» (в БД лежит ISO). */
function parse(raw: string): { y: number; m: number; d: number } | null {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const dotted = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(s);
  if (!iso && !dotted) return null;
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : [Number(dotted![3]), Number(dotted![2]), Number(dotted![1])];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // 31.02 нужно отбить: Date молча уедет на 3 марта.
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d ? { y, m, d } : null;
}

const format = (y: number, m: number, d: number) =>
  `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;

export type DateFieldProps = {
  name: string;
  defaultValue?: string;
  required?: boolean;
  id?: string;
  disabled?: boolean;
  /** Диапазон лет в списке. По умолчанию — «взрослый человек»: от 1950 до текущего года. */
  years?: [from: number, to: number];
};

export function DateField({ name, defaultValue = "", required, id, disabled, years }: DateFieldProps) {
  const [text, setText] = React.useState(() => {
    const parsed = parse(defaultValue);
    return parsed ? format(parsed.y, parsed.m, parsed.d) : defaultValue;
  });
  const [open, setOpen] = React.useState(false);
  const value = parse(text);

  const [from, to] = years ?? [1950, new Date().getFullYear()];
  const list = React.useMemo(
    () => Array.from({ length: to - from + 1 }, (_, i) => to - i),
    [from, to],
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div className="relative">
        <input
          id={id}
          name={name}
          value={text}
          onChange={(e) => setText(e.target.value)}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          placeholder="дд.мм.гггг"
          // Пустое поле ловит `required`, заполненное — этот шаблон: «21.4.98» дальше не пройдёт.
          pattern="\d{1,2}[./-]\d{1,2}[./-]\d{4}"
          title="Дата в виде 21.04.1998"
          className={`${inputClasses({})} pr-12`}
        />
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Открыть календарь"
            disabled={disabled}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-pill text-muted transition-colors hover:text-ink disabled:opacity-55"
          >
            <Icon name="calendar" size="sm" />
          </button>
        </PopoverPrimitive.Trigger>
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} className="pouf-popover">
          <Calendar
            className="w-[286px]"
            value={value}
            years={list}
            onPick={(y, m, d) => {
              setText(format(y, m, d));
              setOpen(false);
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
