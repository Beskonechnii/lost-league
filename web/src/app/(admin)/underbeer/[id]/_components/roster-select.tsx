"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { Toolbar, ToolbarActions, ToolbarCount, ToolbarSearch } from "@/components/pouf/toolbar";
import { segmentPool, type PoolPlayer } from "@/lib/draft";
import { DraftPlayerLine } from "./player-line";
import { PoolColumns } from "./pool-columns";

/**
 * Первая фаза драфта — кто вообще участвует. Полный ростер лиги с поиском, нажатие по карточке
 * включает и выключает человека из турнира; дальше драфт идёт только из отмеченных.
 *
 * Отбор — не перетаскивание, а множественный выбор, поэтому карточки здесь обычные нажимаемые
 * подушки, а не `DragCard`: тащить в этой фазе некуда, целей ещё нет.
 *
 * До Э11 фаза жила внутри `draft-board.tsx` (708 строк) со своим состоянием поиска — §C4
 * RELEASE-PLAN, разбор вместе с переездом на Кит.
 */
export function RosterSelect({
  pool,
  selected,
  blocker,
  onToggle,
  onNext,
}: {
  pool: PoolPlayer[];
  selected: Set<number> | null;
  /** Почему нельзя идти дальше; `null` — можно. */
  blocker: string | null;
  onToggle: (pid: number) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const count = selected?.size ?? 0;

  const segments = useMemo(() => segmentPool(pool), [pool]);
  const filtered = useMemo(
    () =>
      segments
        .map((seg) => ({
          ...seg,
          players: q
            ? seg.players.filter(
                (p) => p.nickname.toLowerCase().includes(q) || (p.realName ?? "").toLowerCase().includes(q),
              )
            : seg.players,
        }))
        .filter((seg) => seg.players.length > 0),
    [segments, q],
  );

  return (
    <div className="space-y-4">
      <Toolbar>
        <ToolbarSearch>
          <FormInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по нику или имени"
          />
        </ToolbarSearch>
        <ToolbarCount>
          отмечено <b className="text-ink">{count}</b>
        </ToolbarCount>
        <ToolbarActions>
          <Button size="sm" onClick={onNext} disabled={!!blocker} title={blocker ?? "Перейти к командам"}>
            Далее к командам
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Alert tone={blocker ? "warn" : "info"} block>
        {blocker ?? "Отметьте игроков, которые участвуют в турнире — из них и будет идти драфт."}
      </Alert>

      <PoolColumns
        segments={filtered}
        lane="60vh"
        badge={(seg) => seg.players.filter((p) => selected?.has(p.id)).length}
      >
        {(seg) =>
          seg.players.map((p) => {
            const on = selected?.has(p.id) ?? false;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggle(p.id)}
                aria-pressed={on}
                // Отмеченный — акцентная подушка, неотмеченный — обычная: выбор здесь читается
                // заливкой, а не галочкой в углу, потому что карточек на экране под две сотни.
                className={`block w-full rounded-control text-left font-pouf transition-[box-shadow,transform,background] ${
                  on
                    ? "bg-accent-fill cushion-control"
                    : "bg-surface cushion-row hover:-translate-y-px hover:cushion-row-hover"
                }`}
              >
                <DraftPlayerLine player={p} />
              </button>
            );
          })
        }
      </PoolColumns>
    </div>
  );
}
