"use client";

import { picksOfGame, type FearlessState } from "@/lib/fearless";
import { Panel } from "../../../_components/panel";
import type { HeroRef } from "./types";

/**
 * Кого уже взяли в прошлых картах серии — по карте на строку.
 *
 * Это не украшение, а правило: взятый герой выбывает до конца серии, и оператору нужно видеть,
 * почему пул сузился. До первой смены карты панели нет вовсе — показывать нечего.
 */
export function PastMaps({ state, heroById }: { state: FearlessState; heroById: Map<number, HeroRef> }) {
  if (state.current === 0) return null;
  return (
    <Panel title="Взято в прошлых картах" hint="Эти герои выбыли из серии — в пул следующих карт они не попадут.">
      <div className="space-y-2">
        {Array.from({ length: state.current }).map((_, gi) => {
          const picks = picksOfGame(state, gi);
          return (
            <div key={gi} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs font-bold text-muted">Карта {gi + 1}</span>
              <div className="flex flex-wrap gap-1">
                {picks.map((m, i) => {
                  const h = heroById.get(m.heroId);
                  return h ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={h.img}
                      alt={h.name}
                      title={h.name}
                      className="h-6 w-[38px] rounded-[6px] object-cover"
                      // Рамка цветом команды, которая героя взяла — сырой hex команды (§C5).
                      style={{ boxShadow: `inset 0 0 0 2px ${state.teams[m.team].color}` }}
                    />
                  ) : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
