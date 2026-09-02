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

export function Stepper({ steps, current }: { steps: ReactNode[]; current: number }) {
  return (
    <ol className="mb-6 flex items-start font-pouf">
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
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
            <span
              aria-current={on ? "step" : undefined}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <span
                className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-pill text-[15px] font-black ${
                  done || on
                    ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
                    : "bg-surface-2 text-muted cushion-field"
                }`}
              >
                {done ? <Icon name="ok" size="sm" label="пройден" /> : i + 1}
              </span>
              <span
                className={`text-center text-[11px] font-extrabold leading-[1.25] text-pretty ${
                  on ? "text-[var(--accent-ink)]" : "text-muted"
                }`}
              >
                {label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
