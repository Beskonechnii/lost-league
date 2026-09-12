"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { Icon } from "./Icon";

/* Аккордеон — список вопросов, где ответ разворачивается по клику (Кит, `parts/Accordion.html`).
 * Каждый пункт — отдельная подушка, а не строка общей плиты: свёрнутый список читается как
 * колонка карточек, и раскрытие не двигает соседей визуально.
 *
 * Шеврон сидит в ЛУНКЕ и поворачивается на 180°, а не подменяется вторым значком: поворот —
 * то же самое утверждение («здесь спрятано»), но без второй картинки в разметке.
 *
 * Открыт один пункт за раз и его можно закрыть (`type="single" collapsible`). Несколько сразу —
 * заводится пропсом, когда появится экран, которому это нужно; сейчас такого нет.
 */

export function Accordion({
  children,
  defaultValue,
  className = "",
}: {
  children: React.ReactNode;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultValue}
      className={`flex flex-col gap-4 font-pouf ${className}`}
    >
      {children}
    </AccordionPrimitive.Root>
  );
}

export function AccordionItem({
  value,
  title,
  children,
}: {
  value: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AccordionPrimitive.Item value={value} className="rounded-card bg-surface cushion-card">
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-4 rounded-card px-6 py-5 text-left text-[16px] font-black text-ink outline-none focus-visible:[box-shadow:var(--sh-focus)]">
          {title}
          <span className="grid size-[30px] shrink-0 place-items-center rounded-pill bg-bg text-muted cushion-field [transition:transform_160ms_ease] group-data-[state=open]:[transform:rotate(180deg)]">
            <Icon name="expand" size="sm" />
          </span>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="px-6 pb-[22px] text-[14px] font-bold leading-[1.55] text-muted">
        {children}
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
