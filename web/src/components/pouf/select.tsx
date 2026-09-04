"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"

/* Выпадающий список. Поведение (клавиатура, портал, позиционирование, ARIA) —
 * radix, как и было; вид — Кит: триггер носит вдавленную подушку поля, список
 * лежит на приподнятой, выбранный пункт залит акцентом.
 *
 * До Э3 файл жил в `components/ui/` и красился слотами shadcn (--color-popover,
 * --color-border, --radius-md). Слоты сняты вместе со второй библиотекой,
 * поэтому классы здесь адресуют .pouf-popover / .pouf-option из pouf.css —
 * те же правила, что у меню и комбобокса, один вид на все всплывающие списки.
 */

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

/** Триггер = поле ввода, которое нельзя набрать: та же вдавленная подушка,
 *  тот же радиус и фокус-кольцо, что у Input — иначе строка формы из поля и
 *  селекта читается как два разных элемента управления. */
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-size={size}
      className={[
        "flex w-full items-center justify-between gap-2 rounded-control bg-bg px-5 font-pouf text-[15px] font-bold text-ink",
        size === "sm" ? "min-h-[42px] py-[9px]" : "min-h-[52px] py-[13px]",
        "cushion-field outline-none focus:[box-shadow:var(--pouf-field-focus)]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "data-[placeholder]:text-muted [&_svg]:pointer-events-none [&_svg]:shrink-0",
        // Значение — единственный тянущийся ребёнок: без min-w-0 длинный ник распирал
        // триггер и выдавливал шеврон за скруглённый край поля.
        "[&>span]:min-w-0 [&>span]:truncate [&>span]:text-left",
        className ?? "",
      ].join(" ")}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 text-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={`pouf-popover pouf-popover--select ${className ?? ""}`}
        position={position}
        sideOffset={6}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="flex flex-col gap-(--s1)">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={`px-[14px] pb-1 pt-2 font-pouf text-[12px] font-extrabold uppercase tracking-[1px] text-muted ${className ?? ""}`}
      {...props}
    />
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={`pouf-option data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className ?? ""}`}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      {/* Галочка справа и всегда занимает место: без резерва ширины выбранный
          пункт прыгает относительно остальных. */}
      <span className="ml-auto flex size-4 shrink-0 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={`pointer-events-none my-(--s1) h-px bg-line-strong ${className ?? ""}`}
      {...props}
    />
  )
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={`flex cursor-default items-center justify-center py-1 text-muted ${className ?? ""}`}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={`flex cursor-default items-center justify-center py-1 text-muted ${className ?? ""}`}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
