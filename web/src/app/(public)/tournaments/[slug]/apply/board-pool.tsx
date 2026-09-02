"use client";

import { useDraggable } from "@dnd-kit/core";
import { FormInput } from "@/components/pouf/Input";
import { Eyebrow } from "@/components/pouf/text";
import { EmptyState } from "@/components/pouf/feedback";
import { ROLES } from "@/lib/roles";
import { PlayerLine } from "./board-player";
import type { PoolEntry } from "./pool";

/**
 * Левая половина доски: игроки лиги. Поиск, фильтр по позиции и список, из которого человека
 * тащат мышью или ставят кликом.
 *
 * До Э7 пул жил внутри `apply-board.tsx` (589 строк) вместе с пулом, слотами, готовыми составами
 * и всей логикой формы. Разбор — по §C4 RELEASE-PLAN, вместе с переездом на Кит.
 */
export function Pool({
  found,
  query,
  setQuery,
  role,
  setRole,
  busy,
  placed,
  onTap,
  inviteUrl,
}: {
  found: PoolEntry[];
  query: string;
  setQuery: (v: string) => void;
  role: string | null;
  setRole: (v: string | null) => void;
  /** Игрок → команда, в которой он уже действующий: такого в состав не поставить. */
  busy: Map<number, string>;
  placed: Map<number, string>;
  onTap: (id: number) => void;
  inviteUrl: string | null;
}) {
  return (
    <section className="min-w-0 space-y-3 rounded-card bg-surface p-4 font-pouf cushion-card sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Игроки лиги</Eyebrow>
        <span className="text-xs font-extrabold tabular-nums text-muted">{found.length}</span>
      </div>

      <FormInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по нику, имени или команде"
      />

      {/* Позиции — пилюлями, а не выпадающим списком: их шесть, и выбор в один клик тут важнее
          экономии места (то же решение, что у вкладок дивизионов). Вид — пилюли L3 из Кита. */}
      <div className="flex flex-wrap gap-1.5">
        {[{ key: null as string | null, short: "Все" }, ...ROLES.filter((r) => r.position !== null)].map((r) => (
          <button
            key={r.key ?? "all"}
            type="button"
            onClick={() => setRole(r.key)}
            className={`inline-flex items-center rounded-pill px-3 py-[5px] text-[12px] font-black transition-[box-shadow,transform,background] ${
              role === r.key
                ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
                : "bg-surface-2 text-muted cushion-field hover:text-ink"
            }`}
          >
            {r.short}
          </button>
        ))}
      </div>

      {/* Дорожка списка — вдавленная лунка Кита: приподнятые строки лежат внутри неё, а не парят
          на бумаге. Высота ограничена, иначе двести человек уводят состав справа за экран. */}
      <div className="max-h-[30rem] space-y-1.5 overflow-y-auto rounded-blob bg-surface-2 p-2 cushion-field">
        {found.length === 0 ? (
          <EmptyState icon="search" title="Никого не нашли">
            В списке только игроки лиги — новичка сначала регистрируют в телеграм-боте.
          </EmptyState>
        ) : (
          found.map((p) => (
            <PoolCard
              key={p.id}
              player={p}
              busyIn={busy.get(p.id) ?? null}
              placedAt={placed.has(p.id)}
              onTap={() => onTap(p.id)}
            />
          ))
        )}
      </div>

      <p className="text-xs font-bold leading-[1.5] text-muted">
        Нет игрока в списке? В составе может быть только тот, кого лига знает.{" "}
        {inviteUrl ? (
          <>
            Пришлите ему ссылку{" "}
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="break-all text-[var(--accent-ink)] hover:underline">
              {inviteUrl}
            </a>{" "}
            — он зарегистрируется в боте и появится здесь.
          </>
        ) : (
          <>Попросите его зарегистрироваться в телеграм-боте лиги — после этого он появится здесь.</>
        )}
      </p>
    </section>
  );
}

/**
 * Игрок в пуле: приподнятая строка-подушка. Занятый в другой команде и уже поставленный в состав
 * гаснут и не тащатся — это не запрет мышью, а видимое состояние: капитан должен понимать, почему
 * человек не берётся, без попытки его взять.
 */
function PoolCard({
  player,
  busyIn,
  placedAt,
  onTap,
}: {
  player: PoolEntry;
  busyIn: string | null;
  placedAt: boolean;
  onTap: () => void;
}) {
  const locked = !!busyIn || placedAt;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pool:${player.id}`, disabled: locked });
  return (
    <div
      ref={setNodeRef}
      {...(locked ? {} : { ...listeners, ...attributes })}
      onClick={onTap}
      title={busyIn ? `Уже действующий в составе «${busyIn}» этого дивизиона` : undefined}
      className={`rounded-control transition-[box-shadow,transform] ${
        locked
          ? "bg-surface-2 opacity-55 cushion-field"
          : "cursor-pointer bg-surface cushion-row hover:-translate-y-px hover:cushion-row-hover active:translate-y-px active:cursor-grabbing"
      } ${isDragging ? "opacity-30" : ""}`}
    >
      <PlayerLine player={player} note={busyIn ? `занят: ${busyIn}` : placedAt ? "в составе" : null} />
    </div>
  );
}
