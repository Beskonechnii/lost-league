"use client";

import { Button } from "@/components/pouf/Button";
import { FormInput, FormSelect } from "@/components/pouf/Input";
import type { BotFlowGraph, FlowIntercept, NodeId } from "@/lib/bot-flow/types";

/* Перехваты уровня флоу (`BOT-FLOW-PLAN.md`, Э6) — то, что бот разбирает раньше ноды, на которой
 * стоит разговор: команды `/start` и `/cancel`, кнопки первого уровня, кнопки прошлых версий меню
 * и ответ на предложение соперника из уведомления.
 *
 * Отдельной панелью, а не строкой инспектора: перехват принадлежит графу целиком, а не какой-то
 * одной ноде. Что с перехватом делать посреди разговора, решает нода — полем «служебная кнопка».
 */

export function FlowIntercepts({
  graph,
  onChange,
}: {
  graph: BotFlowGraph;
  onChange: (next: FlowIntercept[]) => void;
}) {
  const list = graph.intercepts ?? [];
  const patch = (i: number, fields: Partial<FlowIntercept>) =>
    onChange(list.map((it, j) => (j === i ? { ...it, ...fields } : it)));

  return (
    <div className="space-y-3 font-pouf">
      {list.length === 0 && (
        <p className="text-sm font-bold text-muted">
          Своих перехватов у этого флоу нет: любой текст разберёт нода, на которой стоит разговор, — а
          раньше неё сработают перехваты главного флоу (/start, /cancel, кнопки первого уровня) и точки
          входа всех графов. Здесь заводят то, что должно ловиться только внутри этого сценария.
        </p>
      )}

      {list.map((it, i) => (
        <div key={i} className="rounded-md border border-hairline bg-surface-1 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <FormInput
              size="sm"
              mono
              className="min-w-[9rem] flex-1"
              value={it.match}
              placeholder="/start или подпись кнопки"
              onChange={(e) => patch(i, { match: e.target.value })}
            />
            <FormSelect
              size="sm"
              className="min-w-[9rem] flex-1"
              value={it.to ?? ""}
              onChange={(e) => patch(i, { to: (e.target.value || null) as NodeId | null })}
            >
              <option value="">— оборвать разговор —</option>
              {graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title ? `${n.title} (${n.id})` : n.id}
                </option>
              ))}
            </FormSelect>
            <Button size="xs" variant="quiet" tone="down" onClick={() => onChange(list.filter((_, j) => j !== i))}>
              Убрать
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FormInput
              size="sm"
              className="min-w-[12rem] flex-1"
              value={it.text ?? ""}
              placeholder="что сказать перед переходом — можно пусто"
              onChange={(e) => patch(i, { text: e.target.value || null })}
            />
            <label className="flex items-center gap-1.5 text-xs font-bold text-muted">
              <input type="checkbox" checked={!!it.force} onChange={(e) => patch(i, { force: e.target.checked })} />
              сильнее ноды
            </label>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="quiet" onClick={() => onChange([...list, { match: "", to: graph.start }])}>
          + Перехват
        </Button>
        <p className="text-xs font-bold text-muted">
          «Сильнее ноды» — срабатывает даже там, где нода велела начатое не бросать (так живут /start и /cancel).
        </p>
      </div>
    </div>
  );
}
