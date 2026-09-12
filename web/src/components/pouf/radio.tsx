"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

/* Радио — выбор одного из многих. Поведение radix (стрелки ходят по группе, один checked
 * на группу), вид — Кит (`parts/Radio.html`): невыбранный кружок это ЛУНКА, выбранный —
 * приподнятая мятная подушка с вдавленной точкой. Как и у флажка, состояние читается формой
 * и глубиной, а не только цветом.
 *
 * 28px против 20px у флажка: круг той же площади выглядит мельче квадрата, а в Ките у них
 * один размер коробки.
 *
 * Ряда с подписью здесь нет намеренно — раскладка строки у каждого потребителя своя
 * (в заявке кружок стоит внутри слота, на витрине — перед текстом). */

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={`font-pouf ${className ?? ""}`} {...props} />;
}

function Radio({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={[
        "grid size-7 shrink-0 place-content-center rounded-pill border-none outline-none",
        "bg-bg cushion-field",
        "[transition:box-shadow_120ms_ease,background_120ms_ease]",
        "focus-visible:[box-shadow:var(--pouf-field-focus)]",
        "data-[state=checked]:bg-accent-fill data-[state=checked]:cushion-blob",
        "data-[state=checked]:focus-visible:[box-shadow:var(--pouf-blob),var(--sh-focus)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className ?? "",
      ].join(" ")}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="size-3 rounded-pill bg-[var(--on-accent)] [box-shadow:inset_0_-1px_1px_rgba(0,0,0,0.25)]" />
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, Radio };
