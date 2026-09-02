"use client";

import type { ReactNode } from "react";
import { BoardLane } from "@/components/pouf/board";
import { Eyebrow } from "@/components/pouf/text";
import type { PoolSegment } from "@/lib/draft";

/**
 * Пул игроков колонками по позициям: керри, мид, оффлейн, поддержки, «без позиции».
 *
 * Одна раскладка на две фазы — отбор участников и сам драфт: колонки, счётчик в шапке и
 * вдавленная дорожка со списком у них общие, различаются только карточки внутри (там —
 * переключатель «участвует», здесь — перетаскиваемый игрок). Поэтому карточку рисует
 * вызывающий, а не эта функция.
 */
export function PoolColumns({
  segments,
  badge,
  lane,
  children,
}: {
  segments: PoolSegment[];
  /** Число в шапке колонки: сколько осталось (драфт) или отмечено (отбор). */
  badge: (seg: PoolSegment) => ReactNode;
  /** Предел высоты дорожки. */
  lane?: string;
  children: (seg: PoolSegment) => ReactNode;
}) {
  return (
    // Шесть колонок — только на широком мониторе (2xl): в строке игрока стоят аватар, ник и MMR,
    // и на 1280px шестая доля колонки оставляла нику сорок пикселей — от него был виден инициал.
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {segments.map((seg) => (
        <section key={String(seg.position)} className="min-w-0">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
            <Eyebrow>{seg.label}</Eyebrow>
            <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-muted">{badge(seg)}</span>
          </div>
          <BoardLane max={lane}>{children(seg)}</BoardLane>
        </section>
      ))}
    </div>
  );
}
