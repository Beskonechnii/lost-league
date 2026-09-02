import type { ReactNode } from "react";

/* Таблица данных с действиями — артборд Кита из списка служебной части
 * (`RELEASE-PLAN.md` §A): шапка колонок, строка записи, действия справа,
 * пустое состояние. Основа половины экранов админки.
 *
 * Рисунок взят у турнирной таблицы (`table.tsx` + артборд «Турнирная таблица»),
 * а не изобретён заново: большая подушка на всю таблицу, внутри — приподнятая
 * шапка подписей и ряд строк, которые всплывают под курсором. Это тот же
 * элемент, что видит зритель на витрине; служебная часть не заводит второго
 * языка для того же смысла (UI-GUIDELINES §5).
 *
 * Почему `<table>`, а не грид. У витрины колонок восемь и все известны заранее,
 * поэтому там грид с одной строкой `grid-cols-[…]`. У админки колонок разное
 * число на каждом экране, а содержимое — переменной длины (почта, название
 * турнира, ряд кнопок), и ширины должен раздавать браузер. Плюс `<th>` даёт
 * читалке экрана связь ячейки с подписью колонки бесплатно.
 *
 * Горизонтальный скролл — ВНУТРИ обёртки, а не у страницы (UI-GUIDELINES §4):
 * на 375px уезжает вбок таблица, а не весь экран.
 *
 * Без "use client": разметка чистая, её тянут серверные страницы админки.
 */

type Align = "left" | "center" | "right";

const ALIGN: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export type Column = {
  label: ReactNode;
  align?: Align;
  /** Ширина колонки, если браузеру её угадывать не по чему (столбец действий). */
  width?: string;
  /** Колонка прячется на узком экране — второстепенные подписи вроде слага. */
  hideOnNarrow?: boolean;
};

/**
 * Оболочка таблицы: подушка, скролл внутри, шапка колонок.
 *
 * `empty` рисуется вместо всей таблицы, когда строк нет: шапка колонок над
 * пустотой сообщает только то, каких данных нет — а объяснить надо, почему их
 * нет и что сделать (UI-GUIDELINES §4).
 */
export function DataTable({
  columns,
  children,
  empty,
  caption,
}: {
  columns: Column[];
  children: ReactNode;
  /** Пустое состояние — обычно `<EmptyState>`. Передан и строк нет — рисуем его. */
  empty?: ReactNode;
  /** Подпись таблицы для читалки экрана, если рядом нет заголовка секции. */
  caption?: string;
}) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) ? rows.length === 0 : !rows;
  if (isEmpty && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-[34px] bg-surface-1 p-2 font-pouf cushion-card">
      <table className="w-full border-separate border-spacing-0 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={`px-3 pb-3 pt-3.5 text-[11px] font-extrabold uppercase tracking-[1px] text-muted ${
                  ALIGN[c.align ?? "left"]
                } ${c.hideOnNarrow ? "hidden md:table-cell" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

/**
 * Строка записи. Всплывает под курсором той же подушкой, что строка турнирной
 * таблицы, — «навёл» и «выбрано» говорят одним языком на весь сайт.
 *
 * Скругление живёт на крайних ячейках, а не на `<tr>`: у строки таблицы нет
 * своей коробки, `border-radius` на ней браузер игнорирует.
 */
export function DataRow({ children, selected = false }: { children: ReactNode; selected?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={`group transition-[box-shadow,background] ${
        selected
          ? "[&>td]:bg-accent-fill [&>td]:text-[var(--on-accent)]"
          : "hover:[&>td]:bg-surface"
      } [&>td:first-child]:rounded-l-blob [&>td:last-child]:rounded-r-blob`}
    >
      {children}
    </tr>
  );
}

/** Ячейка. `muted` — второстепенное значение (слаг, дата): тише основного. */
export function DataCell({
  children,
  align = "left",
  muted = false,
  hideOnNarrow = false,
  nowrap = false,
}: {
  children: ReactNode;
  align?: Align;
  muted?: boolean;
  hideOnNarrow?: boolean;
  nowrap?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2.5 align-middle font-extrabold ${ALIGN[align]} ${
        muted ? "text-muted" : "text-ink"
      } ${hideOnNarrow ? "hidden md:table-cell" : ""} ${nowrap ? "whitespace-nowrap" : ""}`}
    >
      {children}
    </td>
  );
}

/**
 * Действия строки — прижаты вправо и всегда в одной ячейке.
 *
 * Кнопки не прячутся до наведения: половина работы оператора это как раз они,
 * а невидимое действие на тач-экране недостижимо вовсе (наведения нет).
 *
 * И не переносятся: перенос делал строку вдвое выше остальных, а список из
 * двадцати команд — лестницей. Не влезли — таблица уезжает вбок внутри своей
 * обёртки, для чего скролл там и стоит.
 */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-nowrap items-center justify-end gap-2">{children}</div>;
}
