import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

/* Степпер формы — из канонического макета «Вход» (артборды «Шаг 1…3»).
 *
 * `RELEASE-PLAN.md` §A числил его среди недостающих атомов Кита: рисунок в
 * макете есть, но вынесен он не был, и длинные формы верстали одним полотном.
 * Заводим здесь, а не по месту: шагами идут и анкета игрока (`/me`), и мастера
 * служебной части (заведение турнира, импорт таблицы, Э9) — рисунок у них один.
 *
 * Что показывает: сколько всего шагов, где человек сейчас и что уже пройдено.
 * Пройденный шаг несёт галочку, текущий — свой номер; оба на мятной подушке,
 * будущие — вдавленные лунки. Состояние читается формой и глубиной, а не только
 * цветом.
 */

/**
 * Шаг мастера. Строка — просто подпись (анкета `/me`: назад ходят кнопкой формы).
 * Объект нужен там, где по пройденному шагу можно вернуться нажатием: `href` —
 * мастер живёт в адресе (заведение турнира), `onClick` — в состоянии клиента
 * (импорт таблицы). Возврат вешается ТОЛЬКО на пройденные шаги: будущему шагу
 * не к чему цепляться, пока предыдущий не сделан.
 */
export type Step = { label: ReactNode; href?: string; onClick?: () => void };

export function Stepper({ steps, current }: { steps: (string | Step)[]; current: number }) {
  return (
    <ol className="mb-6 flex items-start font-pouf">
      {steps.map((raw, i) => {
        const step: Step = typeof raw === "string" ? { label: raw } : raw;
        const done = i < current;
        const on = i === current;
        // Пройденный шаг кликабелен, если вызывающий сказал куда; текущий и будущие — нет.
        const back = done ? step : null;
        return (
          // Соединительная черта — часть предыдущего шага, а не отдельный элемент списка:
          // читалке экрана нужен список из трёх пунктов, а не из пяти.
          <li key={i} className="contents">
            {i > 0 && (
              <span
                aria-hidden
                className={`mx-1 mt-[18px] h-[3px] w-7 shrink-0 rounded-pill ${
                  done || on ? "bg-accent-fill cushion-blob" : "bg-surface-2 cushion-field"
                }`}
              />
            )}
            <StepBody step={step} index={i} done={done} on={on} back={back} />
          </li>
        );
      })}
    </ol>
  );
}

/** Кружок с подписью. Кликабельная оболочка — только у пройденного шага с адресом. */
function StepBody({
  step,
  index,
  done,
  on,
  back,
}: {
  step: Step;
  index: number;
  done: boolean;
  on: boolean;
  back: Step | null;
}) {
  const inner = (
    <>
      <span
        className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-pill text-[15px] font-black ${
          done || on
            ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
            : "bg-surface-2 text-muted cushion-field"
        }`}
      >
        {done ? <Icon name="ok" size="sm" label="пройден" /> : index + 1}
      </span>
      <span
        className={`text-center text-[11px] font-extrabold leading-[1.25] text-pretty ${
          on ? "text-[var(--accent-ink)]" : "text-muted"
        }`}
      >
        {step.label}
      </span>
    </>
  );

  const box =
    "flex flex-1 flex-col items-center gap-2 rounded-blob outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

  if (back?.href) {
    return (
      <Link href={back.href} className={`${box} [transition:transform_140ms_ease] hover:[transform:translateY(-1px)]`}>
        {inner}
      </Link>
    );
  }
  if (back?.onClick) {
    return (
      <button
        type="button"
        onClick={back.onClick}
        className={`${box} [font:inherit] border-none bg-transparent [transition:transform_140ms_ease] hover:[transform:translateY(-1px)]`}
      >
        {inner}
      </button>
    );
  }
  return (
    <span aria-current={on ? "step" : undefined} className={box}>
      {inner}
    </span>
  );
}
