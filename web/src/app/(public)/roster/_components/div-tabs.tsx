import Link from "next/link";
import type { Division } from "@/lib/divisions";

// Вкладки дивизиона для страниц ростера: D1 / D2 / Все. Разрез живёт в query (?div=d1),
// как и в /standings и в рейтингах — ссылку с нужным дивизионом можно кинуть в чат.
// «Все» (значение null) — весь пул: игроки без команды видны только здесь.
export type DivFilter = string | null;

/**
 * Значение query → фильтр. Слаг сверяем со списком дивизионов турнира (он приходит из БД, а не
 * из константы, как раньше): чужой слаг — это «Все», иначе вкладка подсветилась бы пустой.
 */
export const parseDiv = (list: Division[], v: unknown): DivFilter =>
  typeof v === "string" && list.some((d) => d.slug === v) ? v : null;

/** Имя дивизиона (Team.group) по фильтру; null — без фильтра. */
export const divName = (list: Division[], f: DivFilter): string | null =>
  f ? (list.find((d) => d.slug === f)?.name ?? null) : null;

/**
 * Ссылка вкладки: базовый путь + div + сохранённые прочие параметры (напр. sort на игроках).
 * div=null («Все») из URL убираем — это состояние по умолчанию.
 */
function href(base: string, f: DivFilter, keep: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v);
  if (f) params.set("div", f);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function DivTabs({
  divisions,
  current,
  base,
  keep = {},
  counts,
}: {
  divisions: Division[];
  current: DivFilter;
  base: string;
  keep?: Record<string, string | undefined>;
  /** Сколько строк за каждой вкладкой: ключ — слаг дивизиона, "all" — весь пул. Необязательно:
   *  счётчик есть там, где он дёшев (команды), и опущен там, где ради него пришлось бы тянуть
   *  лишние выборки. */
  counts?: Record<string, number>;
}) {
  const tabs: { key: DivFilter; label: string }[] = [
    ...divisions.map((d) => ({ key: d.slug as DivFilter, label: d.short })),
    { key: null, label: "Все" },
  ];
  return (
    <div className="flex flex-wrap gap-2 font-pouf">
      {tabs.map((t) => (
        <Link
          key={t.key ?? "all"}
          href={href(base, t.key, keep)}
          className={`rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${
            current === t.key
              ? "bg-purple text-[var(--on-accent)] cushion-control"
              : "bg-surface text-ink-muted cushion-field hover:text-ink"
          }`}
        >
          {t.label}
          {counts && (
            <span className={`ml-1.5 text-xs ${current === t.key ? "text-[var(--on-accent-muted)]" : "text-ink-subtle"}`}>
              {counts[t.key ?? "all"] ?? 0}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
