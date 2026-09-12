"use client";

import { DragCard, dropClasses, useDropTarget } from "@/components/pouf/board";
import { Eyebrow } from "@/components/pouf/text";
import { Icon } from "@/components/pouf/Icon";
import { Radio, RadioGroup } from "@/components/pouf/radio";
import { PlayerLine } from "./board-player";
import { SLOTS } from "./slots";
import type { PoolEntry } from "./pool";

/**
 * Правая половина доски: состав по слотам. Пустой слот — вдавленная лунка Кита, занятый —
 * приподнятая строка: место, куда кладут, и то, что уже положено, должны отличаться формой,
 * а не только текстом.
 */
export function SlotBoard({
  slots,
  byId,
  captainId,
  coreCount,
  totalCount,
  onCaptain,
  onClear,
}: {
  slots: Record<string, number | null>;
  byId: Map<number, PoolEntry>;
  captainId: number | null;
  coreCount: number;
  totalCount: number;
  onCaptain: (playerId: number) => void;
  onClear: (slotKey: string) => void;
}) {
  return (
    // min-w-0 обязателен обеим колонкам: без него ячейка грида растягивается по самой длинной
    // строке игрока (min-width: auto), truncate не срабатывает и страница едет вбок.
    <section className="min-w-0 space-y-3 rounded-card bg-surface p-4 font-pouf cushion-card sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Состав</Eyebrow>
        <span className="text-xs font-extrabold tabular-nums text-muted">
          основа {coreCount}/5 · всего {totalCount}
        </span>
      </div>

      {/* Капитан один на состав — это выбор одного из многих, то есть радиогруппа Кита.
          Выбранное берётся из состояния доски (`captainId`), а не из DOM: React 19 после
          серверного экшена сбрасывает поля формы, и нативный `checked` терял отметку,
          хотя в состоянии капитан оставался. */}
      <RadioGroup
        className="space-y-1.5"
        aria-label="Капитан команды"
        value={SLOTS.find((s) => slots[s.key] != null && slots[s.key] === captainId)?.key ?? ""}
        onValueChange={(key) => {
          const playerId = slots[key];
          if (playerId) onCaptain(playerId);
        }}
      >
        {SLOTS.map((s) => {
          const playerId = slots[s.key];
          return (
            <SlotRow
              key={s.key}
              slotKey={s.key}
              label={s.label}
              core={s.core}
              player={playerId ? (byId.get(playerId) ?? null) : null}
              onClear={() => onClear(s.key)}
            />
          );
        })}
      </RadioGroup>

      <p className="text-xs font-bold leading-[1.5] text-muted">
        Капитан — кружком у слота; это тот, с кем организаторы будут договариваться о встречах, а не
        обязательно тот, кто подаёт заявку. MMR заявленный: итоговую цифру ставит организатор.
      </p>
    </section>
  );
}

function SlotRow({
  slotKey,
  label,
  core,
  player,
  onClear,
}: {
  slotKey: string;
  label: string;
  core: boolean;
  player: PoolEntry | null;
  onClear: () => void;
}) {
  const { ref, isOver } = useDropTarget(`slot:${slotKey}`);

  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 rounded-control p-1.5 transition-[box-shadow,background] ${dropClasses({ isOver, filled: !!player })}`}
    >
      <Radio
        value={slotKey}
        disabled={!player}
        aria-label={`Капитан — ${label}`}
        title={player ? "Отметить капитаном" : "Слот пуст — капитана ставят на человека"}
        className="ml-1"
      />

      {/* На узком экране от подписи остаётся только позиция («Поз. 1»): полная («Поз. 1 · Керри»)
          съедала 96px из 390, и на строку игрока не оставалось ничего — от ника был виден аватар
          и многоточие. Роль при этом не теряется: она стоит в самой строке игрока. */}
      <span className={`w-14 shrink-0 text-[11px] font-extrabold uppercase tracking-[0.5px] sm:w-28 ${core ? "text-ink-muted" : "text-muted"}`}>
        <span className="sm:hidden">{label.split(" · ")[0]}</span>
        <span className="max-sm:hidden">{label}</span>
      </span>

      {player ? (
        <>
          {/* Игрока из слота тоже можно тащить: в другой слот — перестановка, мимо слотов —
              «убрать». Своей подушки строка здесь не носит: её уже держит сам слот. */}
          <DragCard id={`placed:${slotKey}`} bare>
            <PlayerLine player={player} dense />
          </DragCard>
          <button
            type="button"
            onClick={onClear}
            title="Убрать из состава"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-[var(--color-err-ink)]"
          >
            <Icon name="close" size="sm" label="Убрать из состава" />
          </button>
        </>
      ) : (
        <span className="flex-1 px-2 py-2 text-xs font-bold text-muted">
          перетащите игрока или нажмите на него в списке
        </span>
      )}
    </div>
  );
}
