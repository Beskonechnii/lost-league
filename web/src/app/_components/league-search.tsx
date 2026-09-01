"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/pouf/Icon";
import type { SearchHit } from "@/lib/search";

// Поиск по лиге — поле в шапке сайдбара. До Э4b его в продукте не было вовсе: найти команду можно
// было только глазами по ростеру, а игрока — открыв команду.
//
// Отвечает сразу переходами, а не страницей результатов: искомое — конкретная карточка, и лишний
// экран между вводом и ней ничего не добавляет. Отсюда и раскладка: список под полем, клавиши
// ↑/↓/Enter, Esc закрывает.

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

/** Столько же, сколько на сервере (`MIN_QUERY`): на одной букве совпадёт половина лиги. */
const MIN_LENGTH = 2;

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  team: "Команда",
  player: "Игрок",
  tournament: "Турнир",
};

export function LeagueSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  // Ответ хранится вместе с запросом, на который он получен. Так «идёт поиск» и «нашлось пусто»
  // различаются без второго флага, а результат прошлого слова не мигает под новым.
  const [answer, setAnswer] = useState<{ query: string; hits: SearchHit[] }>({ query: "", hits: [] });
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const query = q.trim();
  const ready = answer.query === query;
  const hits = ready ? answer.hits : [];
  const busy = query.length >= MIN_LENGTH && !ready;

  // Запрос с задержкой: поле кормится с каждой буквы, а ответ нужен один — на последнюю.
  // AbortController не даёт устаревшему ответу перезаписать свежий (порядок сети не гарантирован).
  useEffect(() => {
    if (query.length < MIN_LENGTH || ready) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctl.signal });
        const data = (await res.json()) as { hits?: SearchHit[] };
        setAnswer({ query, hits: data.hits ?? [] });
        setCursor(0);
        setOpen(true);
      } catch {
        // Отменённый запрос — не ошибка; сетевую показывать в поле навигации нечем и незачем.
      }
    }, 200);
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [query, ready]);

  // Клик мимо закрывает список: он висит поверх пунктов колонки и иначе перекрывал бы их.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQ("");
    onNavigate?.();
    router.push(hit.href);
  };

  const showList = open && query.length >= MIN_LENGTH;

  return (
    <div ref={box} className="relative mx-0.5 mb-1 mt-0.5">
      <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-subtle">
        <Icon name="search" size="sm" />
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setCursor((c) => Math.min(c + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(hits[cursor]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Поиск по лиге…"
        aria-label="Поиск по лиге: команды, игроки, турниры"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        className={`w-full rounded-control-sm border-none bg-carve py-3 pl-4 pr-10 text-[13px] font-bold text-ink cushion-field placeholder:font-bold placeholder:text-ink-subtle focus:[box-shadow:var(--pouf-field-focus)] ${focus}`}
      />

      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Результаты поиска"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[min(60vh,420px)] overflow-y-auto rounded-blob bg-surface-1 p-1.5 cushion-card"
        >
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-[13px] font-bold text-ink-subtle">{busy ? "Ищем…" : "Ничего не нашлось"}</p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={`${hit.kind}:${hit.href}`}
                type="button"
                role="option"
                aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(hit)}
                className={`flex w-full items-center gap-3 rounded-chip px-2.5 py-2 text-left ${
                  i === cursor ? "bg-accent-fill text-[var(--on-accent)]" : "text-ink"
                }`}
              >
                {hit.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hit.image} alt="" aria-hidden className="h-8 w-8 shrink-0 rounded-pill object-cover" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-surface-2 text-ink-subtle">
                    <Icon name={hit.kind === "tournament" ? "trophy" : hit.kind === "team" ? "users" : "user"} size="sm" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-extrabold">{hit.title}</span>
                  <span className={`block truncate text-[11px] font-bold ${i === cursor ? "opacity-70" : "text-ink-subtle"}`}>
                    {KIND_LABEL[hit.kind]}
                    {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
