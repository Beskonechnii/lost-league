"use client";

import { useMemo } from "react";
import { Eyebrow } from "@/components/pouf/text";
import { isSelectable, type FearlessState } from "@/lib/fearless";
import { Panel } from "../../../_components/panel";
import { ATTR_LABEL, ATTR_ORDER, type HeroRef } from "./types";

/**
 * Пул карты: только те герои, что выпали в рандом-пул, разложенные по атрибуту.
 *
 * Плитками, а не строками Кита (`PlayerLine`): героя узнают по портрету, а не по имени, и
 * тридцать шесть строк с подписями не влезли бы в колонку рядом с расписанием. Перетаскивания
 * здесь нет вовсе — герой выбирается нажатием, поэтому и `pouf/board.tsx` этому экрану не
 * нужен (разбор §C5).
 */
export function HeroPool({
  state,
  heroById,
  locked,
  onPick,
  disabled,
}: {
  state: FearlessState;
  heroById: Map<number, HeroRef>;
  /** Взятые в прошлых картах серии — суть fearless: до конца серии они недоступны. */
  locked: Set<number>;
  onPick: (id: number) => void;
  disabled: boolean;
}) {
  const groups = useMemo(() => {
    const byAttr = new Map<HeroRef["attr"], HeroRef[]>();
    for (const id of state.pool) {
      const h = heroById.get(id);
      if (!h) continue;
      const arr = byAttr.get(h.attr) ?? [];
      arr.push(h);
      byAttr.set(h.attr, arr);
    }
    return ATTR_ORDER.map((attr) => ({
      attr,
      heroes: (byAttr.get(attr) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [state.pool, heroById]);

  return (
    <Panel title="Пул карты" hint={`${state.pool.length} героев · по 9 случайных на атрибут, на каждой карте новый`}>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.attr}>
            <Eyebrow className="mb-1.5">{ATTR_LABEL[g.attr]}</Eyebrow>
            {/* Плитка 50px — минимум, на котором портрет ещё узнаётся; на 375px в ряд встают пять. */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(50px,1fr))] gap-1.5">
              {g.heroes.map((h) => {
                const selectable = !disabled && isSelectable(state, h.id);
                const isLocked = locked.has(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    disabled={!selectable}
                    onClick={() => onPick(h.id)}
                    title={isLocked ? `${h.name} — уже взят в серии` : h.name}
                    aria-label={h.name}
                    className={`relative overflow-hidden rounded-[10px] outline-none transition-[box-shadow,transform] ${
                      selectable
                        ? "cushion-row hover:-translate-y-0.5 hover:cushion-row-hover focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                        : "cursor-not-allowed"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={h.img}
                      alt=""
                      className={`h-8 w-full object-cover transition ${selectable ? "" : "opacity-30 grayscale"}`}
                    />
                    {isLocked && (
                      <span className="absolute inset-0 grid place-items-center bg-surface-2/70 text-[8px] font-black uppercase text-err-ink">
                        в серии
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
