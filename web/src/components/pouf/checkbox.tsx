"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

/* Флажок. Поведение — radix; вид — Кит: пустой флажок это ЛУНКА (вдавленная
 * подушка на дне поля), отмеченный — приподнятая акцентная плитка. Разница
 * читается формой и глубиной, а не только цветом: в оттенках серого состояние
 * всё равно видно (WCAG 2.2 SC 1.4.1).
 *
 * Размер 20px, а не 16px как было у shadcn: подушка с приступочком на 16px
 * превращается в кашу, да и палец в 16px не попадает. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={[
        "peer grid size-5 shrink-0 place-content-center rounded-[8px] border-none outline-none",
        "bg-bg text-[var(--on-accent)] cushion-field",
        "[transition:box-shadow_120ms_ease,background_120ms_ease]",
        "focus-visible:[box-shadow:var(--pouf-field-focus)]",
        "data-[state=checked]:bg-accent-fill data-[state=checked]:cushion-blob",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className ?? "",
      ].join(" ")}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
        <CheckIcon className="size-3.5 [stroke-width:3.5]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
