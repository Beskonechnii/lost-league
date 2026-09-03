"use client";

import { Button } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import type { BotFlowGraph, FlowEntry } from "@/lib/bot-flow/types";

/* Точка входа флоу (`BOT-FLOW-PLAN.md`, Э7): как человек попадает именно в этот граф.
 *
 * Панелью рядом с перехватами, а не полем ноды: вход принадлежит документу целиком. Разница между
 * ними ровно одна и её стоит держать в голове — перехват работает ВНУТРИ разговора (что делать с
 * кнопкой, прилетевшей посреди анкеты), а вход отвечает на вопрос «в какой граф вообще уходит это
 * сообщение», и потому виден из любого флоу.
 */

/** Список строк с добавлением и удалением — им живут и хвосты ссылок, и подписи кнопок. */
function Lines({
  values,
  placeholder,
  add,
  onChange,
}: {
  values: string[];
  placeholder: string;
  add: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {values.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <FormInput
            size="sm"
            mono
            className="min-w-[9rem] flex-1"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(values.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <Button size="xs" variant="quiet" tone="down" onClick={() => onChange(values.filter((_, j) => j !== i))}>
            Убрать
          </Button>
        </div>
      ))}
      <Button size="xs" variant="quiet" onClick={() => onChange([...values, ""])}>
        + {add}
      </Button>
    </div>
  );
}

export function FlowEntryPanel({
  graph,
  onChange,
}: {
  graph: BotFlowGraph;
  onChange: (next: Partial<BotFlowGraph>) => void;
}) {
  const entry: FlowEntry = graph.entry ?? {};
  const patch = (fields: Partial<FlowEntry>) => onChange({ entry: { ...entry, ...fields } });

  return (
    <div className="space-y-4 font-pouf">
      <div className="flex flex-wrap items-center gap-2">
        <FormInput
          size="sm"
          className="min-w-[12rem] flex-1"
          value={graph.title ?? ""}
          placeholder="Название флоу — человеку в списке"
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <span className="rounded-control bg-surface-2 px-2 py-1 font-mono text-[11px] font-bold text-muted">
          {graph.key}
        </span>
      </div>

      <label className="flex items-start gap-2 text-xs font-bold text-muted">
        <input type="checkbox" className="mt-0.5" checked={!!entry.main} onChange={(e) => patch({ main: e.target.checked })} />
        <span>
          Главный флоу: сюда ведёт /start без хвоста, первое сообщение незнакомца и возврат «в меню» из любого
          другого графа. Главный бывает один.
        </span>
      </label>

      <div>
        <p className="mb-1.5 text-xs font-black text-ink">Ссылка-приглашение</p>
        <p className="mb-2 text-xs font-bold leading-[1.5] text-muted">
          Хвост deeplink&apos;а без /start: хвост <span className="font-mono">invite</span> — это ссылка
          <span className="font-mono"> t.me/бот?start=invite</span>. Такой вход сильнее ноды: человек пришёл по делу и
          вправе бросить начатое.
        </p>
        <Lines
          values={entry.payloads ?? []}
          placeholder="invite"
          add="Хвост ссылки"
          onChange={(payloads) => patch({ payloads })}
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-black text-ink">Кнопка из уведомления</p>
        <p className="mb-2 text-xs font-bold leading-[1.5] text-muted">
          Подпись кнопки, которую поставил не экран, а рассылка. Нажимают её из любого места, где человек стоял, —
          но начатую анкету она не бросает: это решает поле «служебная кнопка» у ноды.
        </p>
        <Lines
          values={entry.buttons ?? []}
          placeholder="Принять время"
          add="Кнопка"
          onChange={(buttons) => patch({ buttons })}
        />
      </div>
    </div>
  );
}
