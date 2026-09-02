"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Eyebrow } from "@/components/pouf/text";
import { Icon } from "@/components/pouf/Icon";
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

      {/* role=radiogroup: капитан один на состав, и кружки у слотов — это выбор одного из многих. */}
      <div className="space-y-1.5" role="radiogroup" aria-label="Капитан команды">
        {SLOTS.map((s) => {
          const playerId = slots[s.key];
          return (
            <SlotRow
              key={s.key}
              slotKey={s.key}
              label={s.label}
              core={s.core}
              player={playerId ? (byId.get(playerId) ?? null) : null}
              isCaptain={!!playerId && playerId === captainId}
              onCaptain={() => playerId && onCaptain(playerId)}
              onClear={() => onClear(s.key)}
            />
          );
        })}
      </div>

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
  isCaptain,
  onCaptain,
  onClear,
}: {
  slotKey: string;
  label: string;
  core: boolean;
  player: PoolEntry | null;
  isCaptain: boolean;
  onCaptain: () => void;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slotKey}` });
  // Игрока из слота тоже можно тащить: в другой слот — перестановка, мимо слотов — «убрать».
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `placed:${slotKey}`,
    disabled: !player,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 rounded-control p-1.5 transition-[box-shadow,background] ${
        isOver
          ? "bg-accent-fill/60 cushion-blob"
          : player
            ? "bg-surface cushion-row"
            : "bg-surface-2 cushion-field"
      }`}
    >
      <label
        className="relative ml-1 grid h-7 w-7 shrink-0 place-items-center"
        title={player ? "Отметить капитаном" : "Слот пуст — капитана ставят на человека"}
      >
        <input
          type="radio"
          name="captain-slot"
          checked={isCaptain}
          onChange={onCaptain}
          disabled={!player}
          aria-label={`Капитан — ${label}`}
          className="peer sr-only"
        />
        {/* Кружок Кита (`.radio`): вдавленная лунка, выбранный — мятная подушка с точкой.
            Вид берётся из состояния доски (`isCaptain`), а НЕ из `:checked` у input: React 19
            после серверного экшена сбрасывает поля формы, и разметка на `peer-checked` гасила
            отметку капитана, хотя в состоянии он остался. Фокус-кольцо по-прежнему от input —
            это его собственное состояние, сбросом оно не задевается. */}
        <span
          className={`grid h-7 w-7 place-items-center rounded-pill transition-[box-shadow,background] peer-disabled:opacity-45 peer-focus-visible:[box-shadow:var(--pouf-field),var(--sh-focus)] ${
            isCaptain ? "bg-accent-fill cushion-blob" : "bg-surface cushion-field"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-pill bg-[var(--on-accent)] transition-opacity ${isCaptain ? "opacity-100" : "opacity-0"}`}
          />
        </span>
      </label>

      {/* На узком экране от подписи остаётся только позиция («Поз. 1»): полная («Поз. 1 · Керри»)
          съедала 96px из 390, и на строку игрока не оставалось ничего — от ника был виден аватар
          и многоточие. Роль при этом не теряется: она стоит в самой строке игрока. */}
      <span className={`w-14 shrink-0 text-[11px] font-extrabold uppercase tracking-[0.5px] sm:w-28 ${core ? "text-ink-muted" : "text-muted"}`}>
        <span className="sm:hidden">{label.split(" · ")[0]}</span>
        <span className="max-sm:hidden">{label}</span>
      </span>

      {player ? (
        <>
          <div
            ref={setDragRef}
            {...listeners}
            {...attributes}
            className={`min-w-0 flex-1 cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
          >
            <PlayerLine player={player} dense />
          </div>
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
