import Link from "next/link";
import type { ResolvedSlot, SlotSide } from "@/lib/playoff";
import { AutoScale } from "./auto-scale";

// Сетка плей-офф в стиле Liquipedia: полная структура из тёмных боксов, локти-линии ведут
// победителя дальше по своей половине (проигравший падает вниз — но линию вниз не рисуем, как и
// на первоисточнике). Заполнены только те стороны, где команда уже известна: посев или исход
// записанной серии. Будущие/несыгранные — пустой бокс без текста-заглушки.
//
// Раскладка абсолютная: у каждого слота фиксированные колонка и «строка» (шаг ROW). Так верхняя
// сетка ложится сверху, нижняя — снизу, гранд-финал — справа между ними, а поздние раунды
// центрируются между своими источниками. Линии считаются из шаблона: источник вида «победитель X»
// даёт связь X → этот слот.

const BOXW = 196;
const BOXH = 52;
const ROW = 80; // шаг строки по вертикали
const COLW = 264; // шаг колонки (бокс + место под линии)
const PAD_TOP = 44; // место под заголовки верхних раундов
const PAD_LEFT = 4;

type Pos = { col: number; row: number; band: "upper" | "lower" };

// Колонка и строка каждого слота. Нижняя сетка смещена на LOWER строк — под верхней с зазором.
const LOWER = 5;
const LAYOUT: Record<string, Pos> = {
  "ub-qf1": { col: 0, row: 0, band: "upper" },
  "ub-qf2": { col: 0, row: 1, band: "upper" },
  "ub-qf3": { col: 0, row: 2, band: "upper" },
  "ub-qf4": { col: 0, row: 3, band: "upper" },
  "ub-sf1": { col: 2, row: 0.5, band: "upper" },
  "ub-sf2": { col: 2, row: 2.5, band: "upper" },
  "ub-f": { col: 4, row: 1.5, band: "upper" },
  gf: { col: 5, row: 4, band: "upper" },
  "lb-r1-1": { col: 0, row: LOWER + 0, band: "lower" },
  "lb-r1-2": { col: 0, row: LOWER + 1, band: "lower" },
  "lb-r1-3": { col: 0, row: LOWER + 2, band: "lower" },
  "lb-r1-4": { col: 0, row: LOWER + 3, band: "lower" },
  "lb-r2-1": { col: 1, row: LOWER + 0.5, band: "lower" },
  "lb-r2-2": { col: 1, row: LOWER + 2.5, band: "lower" },
  "lb-qf1": { col: 2, row: LOWER + 0.5, band: "lower" },
  "lb-qf2": { col: 2, row: LOWER + 2.5, band: "lower" },
  "lb-sf": { col: 3, row: LOWER + 1.5, band: "lower" },
  "lb-f": { col: 4, row: LOWER + 1.5, band: "lower" },
};

const left = (col: number) => PAD_LEFT + col * COLW;
const top = (row: number) => PAD_TOP + row * ROW;
const cx = (col: number) => left(col) + BOXW; // правый край бокса
const cy = (row: number) => top(row) + BOXH / 2; // центр по вертикали

/** Одна строка встречи: лого, название, счёт. Пусто — участник ещё не определён (пустой бокс). */
function Row({ side, won, lost, walkover }: { side: SlotSide; won: boolean; lost: boolean; walkover: boolean }) {
  if (!side.team) return <div className="h-[26px]" />;
  // Техпоражение — вместо цифр помечаем W/L: победитель получил викторию без карт, проигравший — форфейт.
  const cell = walkover && (won || lost) ? (won ? "W" : "L") : side.score ?? "";
  return (
    <div className={`flex h-[26px] items-center gap-1.5 pl-1.5 ${lost ? "opacity-50" : ""}`}>
      {side.team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.team.logo} alt="" className="h-4 w-4 shrink-0 rounded-sm object-contain" />
      ) : (
        <span className="h-4 w-4 shrink-0 rounded-sm bg-surface-3" />
      )}
      <span className={`truncate text-xs ${won ? "font-semibold text-ink" : "text-ink-muted"}`}>{side.team.name}</span>
      <span
        className={`ml-auto flex h-full w-6 shrink-0 items-center justify-center text-xs tabular-nums ${
          cell === "" ? "text-ink-subtle" : won ? "bg-surface-3 font-bold text-ink" : "bg-surface-2 text-ink-muted"
        }`}
      >
        {cell}
      </span>
    </div>
  );
}

/** Бокс встречи: две строки + «i»-ссылка на серию у сыгранных. Пустой бокс — просто рамка. */
function Box({ slot }: { slot: ResolvedSlot }) {
  const p = LAYOUT[slot.key];
  if (!p) return null;
  const winId = slot.winner?.teamId;
  const loseId = slot.loser?.teamId;
  return (
    <div className="absolute font-pouf" style={{ left: left(p.col), top: top(p.row), width: BOXW }}>
      <div className="overflow-hidden rounded-[14px] bg-surface cushion-field">
        <Row side={slot.a} won={winId === slot.a.team?.teamId} lost={loseId === slot.a.team?.teamId} walkover={slot.walkover} />
        <div className="h-px bg-hairline" />
        <Row side={slot.b} won={winId === slot.b.team?.teamId} lost={loseId === slot.b.team?.teamId} walkover={slot.walkover} />
      </div>
      {slot.seriesSlug && (
        <Link
          href={`/series/${slot.seriesSlug}`}
          title="Открыть серию"
          className="absolute -right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-surface-3 text-[9px] font-black text-ink-muted transition hover:bg-accent-fill hover:text-[var(--on-accent)]"
        >
          i
        </Link>
      )}
    </div>
  );
}

/** Заголовок раунда — плашка над колонкой. */
function Header({ col, row, label }: { col: number; row: number; label: string }) {
  return (
    <div
      className="absolute flex h-6 items-center truncate rounded-[10px] bg-surface-2 px-2.5 font-pouf text-[11px] font-extrabold uppercase tracking-[0.5px] text-muted"
      style={{ left: left(col), top: top(row) - 32, width: BOXW }}
    >
      {label}
    </div>
  );
}

export function BracketView({ slots }: { slots: ResolvedSlot[] }) {
  const byKey = new Map(slots.map((s) => [s.key, s]));

  // Заголовки раундов: по одному на колонку каждой половины, подпись — из первого слота колонки.
  const headers: { col: number; row: number; label: string }[] = [];
  const seen = new Set<string>();
  for (const s of slots) {
    const p = LAYOUT[s.key];
    if (!p) continue;
    const headRow = p.band === "upper" ? 0 : LOWER;
    const id = `${p.band}:${p.col}`;
    if (seen.has(id)) continue;
    seen.add(id);
    headers.push({ col: p.col, row: headRow, label: s.round });
  }

  // Линии продвижения — фиксированный список «источник → слот» (совпадает с winner-источниками
  // playoff-bracket.ts). Проигравшие падают вниз, но линию вниз не рисуем — как и на Liquipedia.
  const links: { from: string; to: string }[] = [];
  const PROGRESS: [string, string][] = [
    ["ub-qf1", "ub-sf1"], ["ub-qf2", "ub-sf1"], ["ub-qf3", "ub-sf2"], ["ub-qf4", "ub-sf2"],
    ["ub-sf1", "ub-f"], ["ub-sf2", "ub-f"], ["ub-f", "gf"],
    ["lb-r1-1", "lb-r2-1"], ["lb-r1-2", "lb-r2-1"], ["lb-r1-3", "lb-r2-2"], ["lb-r1-4", "lb-r2-2"],
    ["lb-r2-1", "lb-qf1"], ["lb-r2-2", "lb-qf2"],
    ["lb-qf1", "lb-sf"], ["lb-qf2", "lb-sf"], ["lb-sf", "lb-f"], ["lb-f", "gf"],
  ];
  for (const [from, to] of PROGRESS) if (byKey.has(from) && byKey.has(to)) links.push({ from, to });

  const width = left(5) + BOXW + 8;
  const height = top(LOWER + 3) + BOXH + 16;

  return (
    <AutoScale width={width} height={height}>
      <div className="relative" style={{ width, height }}>
        <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
          {links.map(({ from, to }, i) => {
            const a = LAYOUT[from];
            const b = LAYOUT[to];
            const sx = cx(a.col);
            const sy = cy(a.row);
            const dx = left(b.col);
            const dy = cy(b.row);
            const midX = sx + (dx - sx) / 2;
            return (
              <polyline
                key={i}
                points={`${sx},${sy} ${midX},${sy} ${midX},${dy} ${dx},${dy}`}
                fill="none"
                stroke="var(--color-hairline-strong)"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {headers.map((h) => (
          <Header key={`${h.col}-${h.label}`} col={h.col} row={h.row} label={h.label} />
        ))}

        {slots.map((s) => (
          <Box key={s.key} slot={s} />
        ))}
      </div>
    </AutoScale>
  );
}
