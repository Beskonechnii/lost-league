"use client";

import * as React from "react";
import { Icon } from "./Icon";

/* Календарь — месячная сетка Кита (`parts/Calendar.html`) отдельным атомом.
 *
 * Жил внутри `date-field.tsx` и был не достать: второму экрану с датой пришлось бы рисовать
 * сетку заново. Теперь наоборот — `DateField` зовёт этот компонент.
 *
 * Своего значения не держит: выбранная дата приходит пропсом, выбор уходит колбэком. Внутри
 * только то, какой месяц сейчас показан, — это вид, а не данные.
 *
 * Приподнятой подушки на себе не носит: календарь всегда лежит в чужой коробке (попап поля,
 * карточка витрины), а подушка в подушке читается наростом. Вдавлена только сетка дней.
 */

const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];
const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export type CalendarDate = { y: number; m: number; d: number };

/** Понедельник — первый: getUTCDay() отдаёт воскресенье нулём, сдвигаем. */
const firstWeekday = (y: number, m: number) => (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Соседний месяц с переносом года. */
function shiftMonth(y: number, m: number, by: number) {
  const raw = m - 1 + by;
  return { y: y + Math.floor(raw / 12), m: (((raw % 12) + 12) % 12) + 1 };
}

const carvedControl =
  "rounded-control-sm bg-bg text-[14px] font-extrabold text-ink cushion-field outline-none focus-visible:[box-shadow:var(--pouf-field-focus)]";

export function Calendar({
  value,
  onPick,
  years,
  className = "",
}: {
  value: CalendarDate | null;
  onPick: (y: number, m: number, d: number) => void;
  /** Список лет в дропдауне. По умолчанию — текущий год ±10. */
  years?: number[];
  className?: string;
}) {
  const thisYear = new Date().getFullYear();
  const list = React.useMemo(
    () => years ?? Array.from({ length: 21 }, (_, i) => thisYear + 10 - i),
    [years, thisYear],
  );

  // Что показывает сетка. Пусто — открываемся на середине списка лет: для даты рождения это
  // куда ближе к цели, чем текущий год.
  const start = value ?? { y: list[Math.floor(list.length / 2)], m: 1 };
  const [view, setView] = React.useState({ y: start.y, m: start.m });

  const shift = (by: number) => setView((v) => shiftMonth(v.y, v.m, by));

  // Ровно шесть недель: короткий месяц иначе укорачивает попап, и он прыгает при листании.
  // Дни соседних месяцев не пустые клетки, а числа — приглушённые и кликабельные.
  const cells = React.useMemo(() => {
    const blanks = firstWeekday(view.y, view.m);
    const total = daysIn(view.y, view.m);
    const prev = shiftMonth(view.y, view.m, -1);
    const prevTotal = daysIn(prev.y, prev.m);
    const next = shiftMonth(view.y, view.m, 1);
    const out: (CalendarDate & { outside: boolean })[] = [];
    for (let i = blanks; i > 0; i--) out.push({ ...prev, d: prevTotal - i + 1, outside: true });
    for (let d = 1; d <= total; d++) out.push({ y: view.y, m: view.m, d, outside: false });
    for (let d = 1; out.length < 42; d++) out.push({ ...next, d, outside: true });
    return out;
  }, [view]);

  const pick = (c: CalendarDate & { outside: boolean }) => {
    if (c.outside) setView({ y: c.y, m: c.m });
    onPick(c.y, c.m, c.d);
  };

  return (
    <div className={`font-pouf ${className}`}>
      <div className="flex items-center gap-1.5">
        {/* Стрелки рядом, как на листе: «на месяц назад/вперёд» — одна пара действий,
            а не две разные кнопки по краям шапки. */}
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => shift(-1)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-bg text-muted cushion-field outline-none hover:text-ink focus-visible:[box-shadow:var(--pouf-field-focus)]"
        >
          <Icon name="prev" size="sm" />
        </button>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={() => shift(1)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-bg text-muted cushion-field outline-none hover:text-ink focus-visible:[box-shadow:var(--pouf-field-focus)]"
        >
          <Icon name="next" size="sm" />
        </button>

        {/* Месяц и год — обычные <select>: внутри попапа радиксовый список открыл бы второй
            попап поверх первого, а выигрыша в виде на двух коротких списках нет. */}
        <select
          aria-label="Месяц"
          value={view.m}
          onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
          className={`min-w-0 flex-1 appearance-none px-3 py-2 text-center ${carvedControl}`}
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          aria-label="Год"
          value={view.y}
          onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
          className={`w-[86px] shrink-0 appearance-none px-2 py-2 text-center ${carvedControl}`}
        >
          {list.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="mt-3 rounded-blob bg-bg p-2 cushion-field">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((w) => (
            <span key={w} className="grid h-6 place-items-center text-[10px] font-extrabold uppercase tracking-[0.4px] text-muted">
              {w}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((c) => {
            const active = value != null && value.y === c.y && value.m === c.m && value.d === c.d;
            return (
              <button
                key={`${c.y}-${c.m}-${c.d}`}
                type="button"
                onClick={() => pick(c)}
                aria-current={active ? "date" : undefined}
                className={[
                  "grid aspect-square place-items-center text-[13px] font-extrabold outline-none",
                  "[transition:box-shadow_120ms_ease,background_120ms_ease]",
                  "focus-visible:[box-shadow:var(--sh-focus)]",
                  active
                    ? "rounded-pill bg-accent-fill text-[var(--on-accent)] cushion-control-active"
                    // Соседний месяц приглушён второй ступенью текста, а не третьей: третья
                    // в Ките декоративная (1.81:1 на бумаге) и числами читаться не обязана.
                    : `rounded-chip hover:bg-surface-2 ${c.outside ? "text-muted" : "text-ink"}`,
                ].join(" ")}
              >
                {c.d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
