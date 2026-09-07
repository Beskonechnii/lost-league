"use client";

import { Icon } from "@/components/pouf/Icon";

// Постраничная разбивка общего ростера: список команд/игроков лиги растёт (десятки и дальше сотни),
// одним полотном на всех — это в первую очередь долгий скролл, а не витрина. Разбивка на странице,
// а не бесконечная подгрузка: список уже целиком у клиента (см. PoolExplorer/PlayersExplorer),
// довозить нечего.

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

export function Pager({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return null;

  // Не длиннее семи кнопок: края, соседи текущей, многоточия по краям диапазона.
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  const btn = (active: boolean) =>
    `grid h-9 min-w-9 place-items-center rounded-[12px] px-2 text-[13px] font-extrabold tabular-nums transition ${focus} ${
      active ? "bg-accent-fill text-[var(--on-accent)]" : "bg-surface text-ink-muted cushion-row hover:text-ink"
    }`;

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Страницы">
      <button
        type="button"
        aria-label="Предыдущая страница"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        className={`grid h-9 w-9 place-items-center rounded-[12px] bg-surface text-ink-muted cushion-row transition hover:text-ink disabled:opacity-40 disabled:pointer-events-none ${focus}`}
      >
        <Icon name="prev" size="sm" />
      </button>

      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="grid h-9 w-9 place-items-center text-[13px] font-extrabold text-ink-subtle">
            …
          </span>
        ) : (
          <button key={n} type="button" aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)} className={btn(n === page)}>
            {n}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Следующая страница"
        disabled={page === pageCount}
        onClick={() => onPage(page + 1)}
        className={`grid h-9 w-9 place-items-center rounded-[12px] bg-surface text-ink-muted cushion-row transition hover:text-ink disabled:opacity-40 disabled:pointer-events-none ${focus}`}
      >
        <Icon name="next" size="sm" />
      </button>
    </nav>
  );
}
