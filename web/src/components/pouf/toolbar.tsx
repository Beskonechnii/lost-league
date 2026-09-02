import type { ReactNode } from "react";

/* Панель инструментов таблицы — артборд Кита из списка служебной части
 * (`RELEASE-PLAN.md` §A): поиск + фильтры + «создать» одной полосой над данными.
 *
 * Зачем атомом. Строка «поиск слева, фильтр рядом, счётчик справа» повторяется
 * на витринах ростера и на каждом списке админки, и каждый раз её верстали
 * заново: где-то `flex-wrap gap-3`, где-то `grid`, ширины полей литералами.
 * Расходились не только числа — расходилось поведение на узком экране: одна
 * строка переносила фильтр под поиск, другая сжимала поле до нечитаемого.
 *
 * Здесь только РАСКЛАДКА, без самих контролов. Причина простая: поиск в
 * продукте живёт в состоянии клиента (`useState`), а в служебной части — в
 * query и GET-форме; поле внутри панели поэтому разное, а полоса одна.
 * Панель остаётся серверной, и её тянут обе стороны.
 */

/**
 * Полоса над данными. Переносится по словам, а не схлопывается: на 375px
 * поиск занимает свою строку целиком, фильтры встают под ним.
 */
export function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-3 font-pouf ${className}`}>{children}</div>;
}

/**
 * Растяжимое место панели — под поле поиска. Ширину держит обёртка, а не сам
 * контрол: у поля и у триггера селекта в Ките зашит `w-full` (в форме они всегда
 * во всю колонку), и `flex-1` на них же схлопывался бы в отдельную строку.
 */
export function ToolbarSearch({ children }: { children: ReactNode }) {
  return <div className="min-w-[12rem] flex-1">{children}</div>;
}

/** Место фиксированной ширины — под селект-фильтр. `w` в rem, по длине подписей. */
export function ToolbarFilter({ children, w = "11rem" }: { children: ReactNode; w?: string }) {
  return (
    <div className="shrink-0" style={{ width: w }}>
      {children}
    </div>
  );
}

/** Счётчик найденного: «12 из 34». Табличные цифры — чтобы полоса не дёргалась при вводе. */
export function ToolbarCount({ children }: { children: ReactNode }) {
  return <span className="shrink-0 text-sm font-bold tabular-nums text-muted">{children}</span>;
}

/**
 * Правый край полосы — «создать» и прочие действия НАД списком (действия строки
 * живут в самой строке, см. `RowActions` в `data-table.tsx`). `ml-auto` прижимает
 * их вправо, пока полоса помещается в строку; после переноса они просто идут
 * последними, и это верно: кнопка создания — последнее, что читают.
 */
export function ToolbarActions({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{children}</div>;
}
