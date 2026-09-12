"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

/* Тултип — короткое пояснение к элементу (Кит, `parts/Tooltip.html`): тёмная плашка с хвостиком.
 * Единственное место Кита, где поверхность инверсная, — подсказка обязана читаться поверх любого
 * содержимого, а бумажная подушка на бумаге теряется.
 *
 * Показывается по наведению И по фокусу с клавиатуры — это radix, не наша обвязка: подсказка,
 * доступная только мыши, не подсказка (WCAG 2.2 SC 1.4.13).
 *
 * Provider внутри, а не у потребителя: вложенные провайдеры radix разрешает, а обязанность
 * помнить про обёртку на каждом экране — ровно тот способ, которым атом ломается по месту.
 * Цена — свой таймаут открытия у каждой подсказки; для подписи в строку это и не нужно общим.
 *
 * У края вьюпорта плашку разворачивает сам radix (collision detection), поэтому позиционирование
 * здесь — одна `side`, а не расчёты. Ширина при этом упирается в остаток места, а не в свои 260px:
 * на 390px боковой подсказке разворот не помогает — не влезает ни слева, ни справа, — и без
 * ограничения её текст обрезало бы краем экрана.
 */

export function Tooltip({
  content,
  children,
  side = "top",
  delay = 200,
}: {
  content: React.ReactNode;
  /** Элемент-якорь. Получает обработчики radix через `asChild`, поэтому обязан принимать ref. */
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            collisionPadding={8}
            className="z-50 max-w-[min(260px,var(--radix-tooltip-content-available-width))] rounded-[14px] bg-[var(--inverse-surface)] px-3.5 py-2.5 font-pouf text-[12px] font-extrabold leading-[1.45] text-[var(--inverse-ink)] [box-shadow:var(--sh-inverse)]"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[var(--inverse-surface)]" width={12} height={6} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
