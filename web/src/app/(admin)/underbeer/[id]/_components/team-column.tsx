"use client";

import { DragCard, useDropTarget } from "@/components/pouf/board";
import { Button, IconButton } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import {
  canLock,
  canSteal,
  currentTurn,
  isTeamFull,
  memberIds,
  type DraftState,
  type DraftTeam,
  type PoolPlayer,
} from "@/lib/draft";
import { DraftPlayerLine } from "./player-line";

/**
 * Колонка команды — цель броска и одновременно её состав.
 *
 * Цвет команды остаётся сырым hex: его задаёт оператор эфира, он же светится в оверлее OBS
 * поверх картинки игры, и подменять его токеном Кита нельзя. Всё остальное — Кит: подушка
 * вместо рамки, пилюли спец-действий, кнопки Кита вместо цветных `<button>` с сырыми оттенками.
 *
 * Чей сейчас ход, показывает не рамка, а обводка (`outline`): подушки Кита нарисованы
 * тенями, и `ring`/`border` поверх них либо срезал бы подушку, либо перекрашивал её край.
 */
export function TeamColumn({
  state,
  team,
  poolById,
  isCurrent,
  isActiveConfig,
  onSelectActive,
  onRemove,
  onRename,
  onLock,
  onSteal,
}: {
  state: DraftState;
  team: DraftTeam;
  poolById: Map<number, PoolPlayer>;
  isCurrent: boolean;
  isActiveConfig: boolean;
  onSelectActive: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onLock: (pid: number) => void;
  onSteal: (fromId: string, pid: number) => void;
}) {
  const { ref, isOver } = useDropTarget(`team:${team.id}`);
  const full = isTeamFull(team, state.targetSize);
  const members = memberIds(team);
  const cur = currentTurn(state);
  const curTeamId = cur?.teamId ?? null;
  const config = state.phase === "config";

  // Подсветка: под грузом — акцентная подушка, иначе обычная. Обводка отмечает ход (драфт)
  // или выбранную команду (настройка) — это два разных вопроса, но ответ на экране один.
  const marked = isCurrent || isActiveConfig;

  return (
    <div
      ref={ref}
      onClick={config ? onSelectActive : undefined}
      className={`flex flex-col gap-2.5 rounded-card p-3 font-pouf transition-[box-shadow,background] ${
        isOver && isCurrent ? "bg-accent-fill/60 cushion-blob" : "bg-surface cushion-card"
      } ${marked ? "outline outline-2 outline-offset-2 outline-[color:var(--accent-fill)]" : ""} ${
        config ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />
        {config ? (
          <input
            value={team.name}
            onChange={(e) => onRename(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Название команды"
            className="min-w-0 flex-1 rounded-control bg-surface-2 px-2 py-1 text-sm font-black text-ink outline-none cushion-field"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[15px] font-black tracking-[-0.2px] text-ink">{team.name}</span>
        )}
        <span className="shrink-0 text-xs font-extrabold tabular-nums text-muted">
          {members.length}/{state.targetSize}
        </span>
        {config && (
          <IconButton
            icon={<Icon name="remove" size="sm" />}
            label="Удалить команду"
            tone="down"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          />
        )}
      </div>

      {/* Спец-действия: по разу на команду. Использованное гаснет — это счётчик, а не кнопка. */}
      {!config && (
        <div className="flex flex-wrap gap-1.5">
          <SpecialTag used={team.usedLock}>Закрепить</SpecialTag>
          <SpecialTag used={team.usedSteal}>Украсть</SpecialTag>
        </div>
      )}

      <div className="flex-1 space-y-1.5">
        {members.length === 0 && (
          <p className="px-1 py-3 text-center text-xs font-bold text-muted">Пока никого</p>
        )}
        {members.map((pid) => {
          const p = poolById.get(pid);
          if (!p) return null;
          const isCaptain = team.captainId === pid;
          const locked = team.locked.includes(pid);
          const canLockThis = canLock(state, team.id, pid);
          // украсть можно, когда сейчас ходит ДРУГАЯ команда и правило разрешает
          const stealable = curTeamId != null && curTeamId !== team.id && canSteal(state, team.id, pid);
          return (
            <div key={pid} className="rounded-control bg-surface-2 p-1 cushion-field">
              <div className="flex items-center gap-1">
                {/* Игрока, которого можно украсть, ещё и тащат: бросок в свою колонку — та же
                    кража. До Э11 обработчик броска её ждал, но строка состава не была
                    перетаскиваемой, и жест не работал ни разу. */}
                <DragCard id={`member:${team.id}:${pid}`} bare muted={!stealable}>
                  <DraftPlayerLine player={p} />
                </DragCard>
                <div className="flex shrink-0 flex-col items-end gap-1 pr-0.5">
                  {isCaptain && (
                    <span className="rounded-pill bg-accent-fill px-1.5 py-0.5 text-[9px] font-black text-[var(--on-accent)]">
                      КАП
                    </span>
                  )}
                  {locked && (
                    <span title="Закреплён — украсть нельзя" className="text-muted">
                      <Icon name="lock" size="sm" label="Закреплён" />
                    </span>
                  )}
                </div>
              </div>
              {(canLockThis || stealable) && (
                <div className="flex flex-wrap justify-end gap-1.5 px-1 pb-0.5 pt-1">
                  {canLockThis && (
                    <Button size="xs" variant="quiet" onClick={() => onLock(pid)}>
                      Закрепить
                    </Button>
                  )}
                  {stealable && (
                    <Button size="xs" tone="orange" onClick={() => onSteal(team.id, pid)}>
                      Украсть
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!full && state.phase === "draft" && (
          // Пустое место состава — вдавленная лунка: цель броска отличается от того, что в неё
          // уже положено, формой, а не подписью.
          <p className="rounded-control bg-surface-2 px-2 py-3 text-center text-[11px] font-bold text-muted cushion-field">
            {isCurrent ? "Перетащите сюда игрока" : "Ждёт своей очереди"}
          </p>
        )}
      </div>
    </div>
  );
}

function SpecialTag({ used, children }: { used: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-pill bg-surface-2 px-2.5 py-0.5 text-[10px] font-black cushion-field ${
        used ? "text-muted line-through opacity-60" : "text-ink-muted"
      }`}
    >
      {children}
    </span>
  );
}
