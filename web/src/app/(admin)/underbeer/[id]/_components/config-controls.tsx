"use client";

import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { FormInput } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { teamById, type DraftState } from "@/lib/draft";
import { Panel } from "../../../_components/panel";

/**
 * Настройка перед стартом: размер состава, змейка, добавление команд, кнопка старта.
 *
 * Панель служебной части (`Panel`), а не своя подушка: это ровно тот же блок «заголовок,
 * пояснение, ряд контролов», из которого собрана вся админка после Э9.
 */
export function ConfigControls({
  state,
  activeTeamId,
  blocker,
  onAddTeam,
  onTargetSize,
  onSnake,
  onStart,
}: {
  state: DraftState;
  activeTeamId: string | null;
  /** Почему нельзя стартовать; `null` — можно. */
  blocker: string | null;
  onAddTeam: () => void;
  onTargetSize: (n: number) => void;
  onSnake: (v: boolean) => void;
  onStart: () => void;
}) {
  const activeName = activeTeamId ? teamById(state, activeTeamId)?.name : null;
  return (
    <Panel
      title="Настройка драфта"
      hint={
        blocker ??
        `Нажмите на команду, чтобы выбрать активную${
          activeName ? ` (сейчас «${activeName}»)` : ""
        }, затем на игрока — он станет её капитаном. Или перетащите игрока прямо в команду.`
      }
      aside={
        <Button size="sm" onClick={onStart} disabled={!!blocker} title={blocker ?? "Начать драфт"} tone="orange">
          Начать драфт
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          Размер состава
          <span className="w-20">
            <FormInput
              type="number"
              min={2}
              max={5}
              size="sm"
              value={state.targetSize}
              onChange={(e) => onTargetSize(Math.max(2, Math.min(5, Number(e.target.value) || 2)))}
            />
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <Checkbox checked={state.snake} onCheckedChange={(v) => onSnake(v === true)} />
          Змейка (1→N, N→1)
        </label>
        <Button variant="quiet" size="sm" onClick={onAddTeam}>
          + Команда
        </Button>
      </div>
      {state.teams.length === 0 && (
        <div className="mt-3">
          <Alert tone="info">Команд пока нет — добавьте хотя бы две.</Alert>
        </div>
      )}
    </Panel>
  );
}
