"use client";

import { SEQUENCE, firstPickOf, teamOfSeq, type FearlessState, type TeamIdx } from "@/lib/fearless";
import { Panel } from "../../../_components/panel";
import type { HeroRef } from "./types";

/**
 * Нумерованная сетка ходов карты: слева команда-первопик, справа вторая, текущий шаг подсвечен.
 *
 * Своя разметка, а не китовая таблица: это не список данных, а расписание с двумя дорожками и
 * номером посередине — то, на что оператор смотрит в эфире, чтобы не сбиться, чей ход. Второго
 * потребителя у неё нет и не предвидится (§C5: сетка последовательности остаётся раздельной).
 */
export function Sequence({ state, heroById }: { state: FearlessState; heroById: Map<number, HeroRef> }) {
  const moves = state.games[state.current]?.moves ?? [];
  const leftTeam = firstPickOf(state, state.current); // слева тот, кто ходит первым
  const rightTeam = (1 - leftTeam) as TeamIdx;

  return (
    <Panel>
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] gap-2 text-[13px] font-black uppercase tracking-[1px] text-muted">
        <span className="truncate">{state.teams[leftTeam].name}</span>
        <span className="w-8 text-center">#</span>
        <span className="truncate text-right">{state.teams[rightTeam].name}</span>
      </div>
      <ol className="space-y-1">
        {SEQUENCE.map((s, i) => {
          const team = teamOfSeq(state, state.current, s.seq);
          const onLeft = team === leftTeam;
          const move = moves[i];
          const isCurrent = i === moves.length;
          const hero = move ? heroById.get(move.heroId) : undefined;
          const cell = (
            <SeqCell
              action={s.action}
              hero={hero}
              color={state.teams[team].color}
              current={isCurrent}
              align={onLeft ? "left" : "right"}
            />
          );
          return (
            <li
              key={i}
              className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-chip px-1 py-0.5 ${
                isCurrent ? "bg-accent-fill/50 cushion-field" : ""
              }`}
              aria-current={isCurrent || undefined}
            >
              <div>{onLeft && cell}</div>
              <div className="w-8 text-center text-sm font-black tabular-nums text-muted">{i + 1}</div>
              <div className="flex justify-end">{!onLeft && cell}</div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** Одна ячейка расписания: портрет героя в рамке цвета команды либо пустая лунка «бан/пик». */
function SeqCell({
  action,
  hero,
  color,
  current,
  align,
}: {
  action: "ban" | "pick";
  hero: HeroRef | undefined;
  color: string;
  current: boolean;
  align: "left" | "right";
}) {
  const isBan = action === "ban";
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <div
        className="h-9 w-[58px] shrink-0 overflow-hidden rounded-[8px]"
        // Цвет команды — сырой hex: его выбирает оператор эфира, и он же горит в трансляции (§C5).
        style={{ boxShadow: hero ? `inset 0 0 0 2px ${color}` : undefined }}
      >
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.img} alt={hero.name} className={`h-full w-full object-cover ${isBan ? "opacity-40 grayscale" : ""}`} />
        ) : (
          <div
            className={`grid h-full w-full place-items-center text-[10px] font-black uppercase ${
              current ? "bg-accent-fill text-[var(--on-accent)]" : "bg-surface-2 text-muted cushion-field"
            }`}
          >
            {isBan ? "бан" : "пик"}
          </div>
        )}
      </div>
      {hero && (
        <span className={`truncate text-xs font-bold ${isBan ? "text-muted line-through" : "text-ink"}`}>
          {hero.name}
        </span>
      )}
    </div>
  );
}
