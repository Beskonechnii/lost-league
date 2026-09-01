"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { buttonClasses, type ButtonSize } from "./Button"
import type { Tone } from "./tone"

/* Диалог подтверждения — «точно удалить?». Поведение radix (фокус-ловушка,
 * Esc, aria-modal); вид — Кит: затемнение .pouf-overlay, карточка .pouf-dialog.
 * Обе описаны в pouf.css и общие с боковой панелью и меню, поэтому всплывающее
 * в проекте выглядит одинаково независимо от того, что его открыло.
 *
 * Почему radix, а не window.confirm(): нативный диалог глохнет во встроенном
 * браузере телеграма — половина админов жмёт «удалить» именно оттуда.
 *
 * До Э3 файл лежал в `components/ui/` и красился слотами shadcn. Слоты сняты
 * вместе со второй библиотекой; API (набор экспортов) оставлен прежним —
 * менять пять экранов подтверждения ради переименования нечего.
 */

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return <AlertDialogPrimitive.Overlay className={`pouf-overlay ${className ?? ""}`} {...props} />
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & { size?: "default" | "sm" }) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-size={size}
        className={`pouf-dialog font-pouf gap-(--s4) ${size === "default" ? "sm:[width:min(560px,calc(100vw-32px))]" : ""} ${className ?? ""}`}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={`flex flex-col gap-(--s2) ${className ?? ""}`} {...props} />
}

/** Кнопки в подвале: на телефоне столбиком и «подтвердить» сверху под пальцем,
 *  на широком — в строку и справа, как во всех диалогах системы. */
function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={`mt-(--s3) flex flex-col-reverse gap-(--s2) sm:flex-row sm:justify-end ${className ?? ""}`}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={`text-[19px] font-black leading-[1.2] tracking-[-0.2px] text-ink ${className ?? ""}`}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={`text-[15px] font-bold text-muted ${className ?? ""}`}
      {...props}
    />
  )
}

/** Иллюстрация над заголовком (иконка предупреждения). Кладётся на подушку —
 *  плоский квадрат рядом с пластилиновой карточкой смотрится наклейкой. */
function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={`mb-(--s2) inline-flex size-14 items-center justify-center rounded-blob bg-surface-2 cushion-field ${className ?? ""}`}
      {...props}
    />
  )
}

type ButtonLook = { variant?: "solid" | "quiet"; size?: ButtonSize; tone?: Tone }

/** Подтверждающее действие. Разрушительное красится тоном (`tone="down"`),
 *  а не классом на месте: цвет живёт в токенах. */
function AlertDialogAction({
  className,
  variant = "solid",
  size = "md",
  tone,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & ButtonLook) {
  return (
    <AlertDialogPrimitive.Action
      className={buttonClasses({ variant, size, tone, className })}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "quiet",
  size = "md",
  tone,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> & ButtonLook) {
  return (
    <AlertDialogPrimitive.Cancel
      className={buttonClasses({ variant, size, tone, className })}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
