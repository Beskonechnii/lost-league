import Link from "next/link";
import { Icon } from "./Icon";

/* Пагинация — листание длинного списка (Кит, `parts/Pagination.html`): стрелки по краям,
 * номера подушками, разрыв многоточием. Текущая страница — мятная подушка, остальные — обычные.
 *
 * Своего номера не держит: страница приходит пропсом, клик уходит колбэком. Иначе компонент
 * начал бы спорить с URL, который у списков и есть источник правды.
 *
 * Ряд переносится (`flex-wrap`), а не режется на узком экране: терять номера ради одной строки
 * незачем — на 390px девять кнопок просто встают в две строки.
 *
 * Две формы, как `PillButton` / `PillLink` в `tabs.tsx`: `Pagination` — кнопки с колбэком (номер
 * живёт в состоянии клиента), `PaginationLinks` — ссылки (номер живёт в адресе). Директивы
 * `"use client"` в файле нет намеренно: она сделала бы клиентским и ссылочный вариант, который
 * зовут серверные страницы. `Pagination` попадает в клиентский граф от своего потребителя.
 */

/** Окно номеров: первая, последняя, текущая и по соседу с каждой стороны. Пропуски — `null`. */
function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const near = [page - 1, page, page + 1].filter((n) => n > 1 && n < pages);
  const out: (number | null)[] = [1];
  if (near[0] > 2) out.push(null);
  out.push(...near);
  if (near[near.length - 1] < pages - 1) out.push(null);
  out.push(pages);
  return out;
}

const cell =
  "grid h-[46px] min-w-[46px] place-items-center rounded-chip px-3 font-pouf text-[14px] font-extrabold outline-none";

/** Подушка страницы: приподнятая у обычной, мятная у текущей, вдавленная на нажатии. */
function cellTone(current: boolean) {
  return [
    "[transition:box-shadow_120ms_ease,transform_120ms_ease]",
    "focus-visible:[box-shadow:var(--sh-focus)]",
    current
      ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
      : "bg-surface text-muted cushion-row hover:text-ink hover:cushion-row-hover active:translate-y-[1px] active:cushion-field",
  ].join(" ");
}

export function Pagination({
  page,
  pages,
  onPage,
  className = "",
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  if (pages <= 1) return null;

  const go = (n: number) => onPage(Math.min(pages, Math.max(1, n)));

  return (
    <nav
      aria-label="Страницы"
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      <button
        type="button"
        aria-label="Предыдущая страница"
        // Край списка не «не уводит в минус» обработчиком, а просто недоступен: серая
        // кнопка честнее кликабельной, которая ничего не делает.
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        className={`${cell} ${cellTone(false)} disabled:pointer-events-none disabled:opacity-50`}
      >
        <Icon name="prev" size="sm" />
      </button>

      {pageWindow(page, pages).map((n, i) =>
        n == null ? (
          <span key={`gap-${i}`} className={`${cell} text-ink-subtle`} aria-hidden>
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-label={`Страница ${n}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => go(n)}
            className={`${cell} ${cellTone(n === page)}`}
          >
            {n}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Следующая страница"
        disabled={page >= pages}
        onClick={() => go(page + 1)}
        className={`${cell} ${cellTone(false)} disabled:pointer-events-none disabled:opacity-50`}
      >
        <Icon name="next" size="sm" />
      </button>
    </nav>
  );
}

/** Край ряда, за которым страниц нет: подушка того же вида, но не ссылка — серая стрелка честнее
 *  кликабельной, которая никуда не ведёт (та же логика, что у `disabled` в кнопочной форме). */
function Edge({ label, icon }: { label: string; icon: "prev" | "next" }) {
  return (
    <span aria-label={label} aria-disabled className={`${cell} ${cellTone(false)} opacity-50`}>
      <Icon name={icon} size="sm" />
    </span>
  );
}

/**
 * Та же пагинация ссылками: номер страницы живёт в адресе. Кнопка с колбэком для списка,
 * состояние которого в query, не годится — её нельзя открыть в новой вкладке, скопировать
 * ссылкой и по ней не пройдёт поисковик, то есть все страницы, кроме первой, остались бы
 * вне обхода.
 */
export function PaginationLinks({
  page,
  pages,
  href,
  className = "",
}: {
  page: number;
  pages: number;
  /** Адрес страницы N — собирает потребитель: он знает, какие ещё параметры держит его лента. */
  href: (page: number) => string;
  className?: string;
}) {
  if (pages <= 1) return null;

  return (
    <nav aria-label="Страницы" className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {page <= 1 ? (
        <Edge label="Предыдущая страница" icon="prev" />
      ) : (
        <Link href={href(page - 1)} aria-label="Предыдущая страница" className={`${cell} ${cellTone(false)}`}>
          <Icon name="prev" size="sm" />
        </Link>
      )}

      {pageWindow(page, pages).map((n, i) =>
        n == null ? (
          <span key={`gap-${i}`} className={`${cell} text-ink-subtle`} aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            aria-label={`Страница ${n}`}
            aria-current={n === page ? "page" : undefined}
            className={`${cell} ${cellTone(n === page)}`}
          >
            {n}
          </Link>
        ),
      )}

      {page >= pages ? (
        <Edge label="Следующая страница" icon="next" />
      ) : (
        <Link href={href(page + 1)} aria-label="Следующая страница" className={`${cell} ${cellTone(false)}`}>
          <Icon name="next" size="sm" />
        </Link>
      )}
    </nav>
  );
}
