"use client";

import Link from "next/link";
import { useState } from "react";
import { qualificationOf, type Qualification } from "@/lib/qualification";
import type { GroupRow } from "@/lib/group-stage";
import { FormDots, MapDiff, Points, TeamMark, ZoneBar, ZoneLegend, zonesOf } from "@/components/pouf/table";

// Таблица дивизиона по артборду Кита «Турнирная таблица»: шапка колонок с сортировкой, строка
// команды с рейкой зоны, форма последних встреч, плашка очков; на узком экране — карточный вид
// 390px из того же артборда, а не горизонтальная прокрутка восьми колонок.
//
// Клиентский компонент ровно ради сортировки: данные приходят посчитанными с сервера
// (lib/group-stage.ts), здесь только порядок строк.

type SortKey = "place" | "played" | "wins" | "losses" | "maps" | "points";

/** Колонки-числа: подпись, ширина в сетке и как достать значение. Порядок = порядок в шапке. */
const NUMERIC: { key: SortKey; label: string; title: string; value: (r: GroupRow) => number }[] = [
  { key: "played", label: "И", title: "Сыграно встреч", value: (r) => r.played },
  { key: "wins", label: "В", title: "Победы", value: (r) => r.wins },
  { key: "losses", label: "П", title: "Поражения", value: (r) => r.losses },
  { key: "maps", label: "Карты", title: "Разница карт", value: (r) => r.mapsWon - r.mapsLost },
];

// Сетка Кита: место · команда · И · В · П · карты · форма · очки.
const GRID = "grid-cols-[64px_1fr_56px_56px_56px_74px_104px_88px]";

/** Стрелка сортировки в кружке-лунке. Кит: `.sortcap`. */
function SortCap({ on, dir }: { on: boolean; dir: "asc" | "desc" }) {
  return (
    <span
      aria-hidden
      className={`grid h-[18px] w-[18px] place-items-center rounded-full transition ${
        on ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "bg-surface-2 text-muted cushion-field"
      }`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        className={on && dir === "asc" ? "" : "rotate-180"}
      >
        <path d="M6 15l6-6 6 6" />
      </svg>
    </span>
  );
}

export function StandingsTable({
  rows,
  relegation,
}: {
  rows: GroupRow[];
  /** Правило дивизиона: вылетают ли последние из группы (см. qualificationOf). */
  relegation: boolean;
}) {
  // По умолчанию — порядок лиги: место из таблицы сезона. При равенстве очков его задавал
  // организатор, из цифр он не выводится, поэтому сортировка по очкам — это ДРУГОЙ порядок,
  // а не «тот же, только явный». Первый клик по числовой колонке — по убыванию: в таблице
  // интересно, у кого больше.
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "place", dir: "asc" });

  const zoneOf = (r: GroupRow): Qualification => qualificationOf(r.place, rows.length, relegation);

  const value = (r: GroupRow) =>
    sort.key === "place"
      ? r.place
      : sort.key === "points"
        ? r.points
        : sort.key === "maps"
          ? r.mapsWon - r.mapsLost
          : NUMERIC.find((c) => c.key === sort.key)!.value(r);

  // Направление переворачивает только само сравнение; при равенстве значений порядок всегда по
  // месту лиги — иначе «по очкам» ставило бы равных наоборот, вторым место 1.
  const sorted = [...rows].sort((a, b) => {
    const d = value(a) - value(b);
    return (sort.dir === "asc" ? d : -d) || a.place - b.place;
  });

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : // место читается снизу вверх (1 — лучшее), числа — сверху вниз (больше — лучше)
          { key, dir: key === "place" ? "asc" : "desc" },
    );

  /** Кнопка-сортировщик в шапке. Кит: `.sortable` / `.sortable.on`. */
  const head = (key: SortKey, label: string, title: string) => {
    const on = sort.key === key;
    return (
      <button
        type="button"
        onClick={() => toggle(key)}
        title={title}
        aria-label={`Сортировать по «${title}»`}
        className={`inline-flex items-center justify-center gap-[5px] rounded-pill px-1 py-0.5 outline-none transition focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] ${
          on ? "text-[var(--accent-ink)]" : "text-muted hover:text-ink"
        }`}
      >
        {label}
        <SortCap on={on} dir={sort.dir} />
      </button>
    );
  };

  return (
    <div>
      {/* ——— широкий вид: таблица Кита ——— */}
      <div className="hidden rounded-[34px] bg-surface-1 p-2 font-pouf cushion-card lg:block">
        <div
          className={`grid ${GRID} items-center px-[18px] pb-3 pt-3.5 text-[11px] font-extrabold uppercase tracking-[1px] text-muted`}
        >
          <div>{head("place", "#", "Место в группе")}</div>
          <div>Команда</div>
          {NUMERIC.map((c) => (
            <div key={c.key} className="text-center">
              {head(c.key, c.label, c.title)}
            </div>
          ))}
          <div className="text-center">Форма</div>
          <div className="text-center">{head("points", "Очки", "Очки")}</div>
        </div>

        {sorted.map((r, i) => {
          const zone = zoneOf(r);
          // Пунктир между зонами — только в «родном» порядке: в отсортированной по очкам
          // таблице соседние строки в разных зонах, и черта разделяла бы что попало.
          const split =
            sort.key === "place" && sort.dir === "asc" && i > 0 && zoneOf(sorted[i - 1]) !== zone;
          return (
            <div
              key={r.teamId}
              className={`grid ${GRID} items-center rounded-blob px-[18px] py-[11px] text-sm font-extrabold transition-[box-shadow,transform,background] hover:bg-surface-1 hover:cushion-row ${
                zone === "out" ? "opacity-[.72]" : ""
              } ${split ? "mt-3 border-t border-dashed border-hairline-strong pt-4" : "mt-0.5"}`}
            >
              <div className="flex items-center gap-2.5">
                <ZoneBar zone={zone} />
                <span className="w-[22px] text-right text-[15px] font-black tabular-nums">{r.place}</span>
              </div>
              <Link href={`/roster/teams/${r.teamId}`} className="flex min-w-0 items-center gap-3 group">
                <TeamMark logo={r.logo} tag={r.tag} name={r.name} size={34} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-black tracking-[-0.2px] text-ink group-hover:underline">
                    {r.name}
                  </span>
                  {/* В Ките на этой строке стоит имя дивизиона — но таблица уже внутри дивизиона
                      и внутри группы, и подпись повторяла бы шапку восемь раз подряд. Ставим тег
                      команды: он в этом месте единственное, что различает строки. */}
                  <span className="block text-[11px] font-extrabold uppercase tracking-[0.6px] text-muted">
                    {r.tag}
                  </span>
                </span>
              </Link>
              <div className="text-center tabular-nums text-muted">{r.played}</div>
              <div className="text-center tabular-nums text-ink">{r.wins}</div>
              <div className="text-center tabular-nums text-muted">{r.losses}</div>
              <div className="text-center">
                <MapDiff won={r.mapsWon} lost={r.mapsLost} />
              </div>
              <div>
                <FormDots form={r.form} />
              </div>
              <div className="flex justify-end">
                <Points lead={r.place === 1}>{r.points}</Points>
              </div>
            </div>
          );
        })}
      </div>

      {/* ——— узкий вид: карточные строки 390px из того же артборда ——— */}
      <div className="rounded-[34px] bg-surface-1 p-2.5 font-pouf cushion-card lg:hidden">
        {sorted.map((r) => (
          <Link
            key={r.teamId}
            href={`/roster/teams/${r.teamId}`}
            className={`mt-0.5 flex items-center gap-3 rounded-[22px] px-3 py-[11px] font-extrabold first:mt-0 ${
              zoneOf(r) === "out" ? "opacity-[.72]" : ""
            }`}
          >
            <span className="w-4 text-right text-[15px] font-black tabular-nums">{r.place}</span>
            <ZoneBar zone={zoneOf(r)} />
            <TeamMark logo={r.logo} tag={r.tag} name={r.name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-black text-ink">{r.name}</span>
              <span className="block text-[11px] font-extrabold text-muted">
                {r.wins}–{r.losses} · карты <MapDiff won={r.mapsWon} lost={r.mapsLost} />
              </span>
            </span>
            <Points lead={r.place === 1}>{r.points}</Points>
          </Link>
        ))}
      </div>

      {/* Сортировка на узком экране: колонок нет, поэтому порядок выбирается пилюлями. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 font-pouf lg:hidden">
        <span className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted">Порядок</span>
        {(
          [
            { key: "place", label: "по месту" },
            { key: "points", label: "по очкам" },
            { key: "wins", label: "по победам" },
            { key: "maps", label: "по картам" },
          ] as const
        ).map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => toggle(o.key)}
            aria-pressed={sort.key === o.key}
            className={`min-h-11 rounded-[14px] px-3.5 py-[9px] text-[13px] font-black transition ${
              sort.key === o.key
                ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
                : "bg-surface-1 text-ink-muted cushion-field"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Легенда зон — под таблицей, где она объясняет уже увиденное, а не перед ней. */}
      <ZoneLegend zones={zonesOf(relegation)} className="mt-4" />
    </div>
  );
}
