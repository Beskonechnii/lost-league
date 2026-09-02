import type { ReactNode } from "react";
import { Card } from "@/components/pouf/surface";

/* Панель служебного экрана: подушка с заголовком, поясняющей строкой и содержимым.
 *
 * Экраны админки устроены одинаково — страница это стопка блоков «Статус»,
 * «Описание», «Дивизионы», «Новый дивизион», и до Э9 каждый такой блок верстался
 * строкой `rounded-lg border border-hairline bg-surface-1 p-4` с заголовком
 * `text-sm font-semibold`. Это и рамка мимо Кита (в Light Clay блок держит
 * подушка, а не обводка), и второй голос подзаголовка рядом с тем, что Э8
 * поставил в кабинете (`17px font-black`).
 *
 * Лежит в `(admin)/_components`, а не в `pouf/`: от китовой `Card` панель
 * отличается только плотностью (16px вместо 32px) — служебная часть это рабочий
 * инструмент, в ней за экран проходит вся стопка блоков сразу (UI-GUIDELINES §4,
 * «Плотность»). Появится третий потребитель такой плотности в продукте —
 * поедет в Кит.
 */

export function Panel({
  title,
  hint,
  aside,
  children,
}: {
  title?: ReactNode;
  /** Одна строка о том, что делает блок и чем это грозит. */
  hint?: ReactNode;
  /** Действие блока справа от его заголовка. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card variant="tight">
      <div className="font-pouf">
        {(title || aside) && (
          <div className="flex flex-wrap items-start justify-between gap-2">
            {title && <h2 className="text-[17px] font-black tracking-[-0.2px] text-ink">{title}</h2>}
            {aside && <div className="shrink-0">{aside}</div>}
          </div>
        )}
        {hint && <p className="mt-1 text-xs font-bold leading-[1.5] text-muted">{hint}</p>}
        {children && <div className={title || hint ? "mt-4" : undefined}>{children}</div>}
      </div>
    </Card>
  );
}
