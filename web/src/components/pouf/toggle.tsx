"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

/* Тумблер — «включено / выключено» без подтверждения. Вид из Кита (`parts/Toggle.html`):
 * дорожка выключенного это ЛУНКА, включённого — мятная подушка; бегунок всегда приподнят.
 * Состояние читается положением бегунка и глубиной дорожки, значит переживает и оттенки
 * серого (WCAG 2.2 SC 1.4.1).
 *
 * Подпись — `label`, стоит слева от дорожки. Связей с ней две, и обе нужны: `htmlFor` даёт
 * клик по тексту (radix рисует дорожку кнопкой, а кнопка — labelable-элемент), `aria-labelledby`
 * даёт имя — из `<label>` имя кнопки не берётся, и без него скринридер объявил бы пустой
 * переключатель. */

type ToggleProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label?: React.ReactNode;
};

function Toggle({ label, className, id, ...props }: ToggleProps) {
  const auto = React.useId();
  const switchId = id ?? auto;
  const labelId = `${switchId}-label`;

  const track = (
    <SwitchPrimitive.Root
      id={switchId}
      aria-labelledby={label != null ? labelId : undefined}
      className={[
        "inline-flex h-[42px] w-[72px] shrink-0 items-center rounded-pill border-none p-[5px] outline-none",
        "bg-bg cushion-field",
        "[transition:box-shadow_140ms_ease,background_140ms_ease]",
        "focus-visible:[box-shadow:var(--pouf-field-focus)]",
        "data-[state=checked]:bg-accent-fill data-[state=checked]:cushion-blob",
        "data-[state=checked]:focus-visible:[box-shadow:var(--pouf-blob),var(--sh-focus)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className ?? "",
      ].join(" ")}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-8 rounded-pill bg-surface cushion-row [transition:transform_140ms_ease] data-[state=checked]:[transform:translateX(30px)]" />
    </SwitchPrimitive.Root>
  );

  if (label == null) return track;

  return (
    <span className="inline-flex items-center gap-3 font-pouf text-[14px] font-extrabold text-ink">
      <label id={labelId} htmlFor={switchId} className="cursor-pointer select-none">
        {label}
      </label>
      {track}
    </span>
  );
}

export { Toggle };
