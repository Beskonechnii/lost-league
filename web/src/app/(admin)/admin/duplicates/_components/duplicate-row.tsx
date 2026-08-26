"use client";

import { useActionState, useState } from "react";
import { CLUE_LABELS, type Candidate, type Impact, type Pair } from "@/lib/duplicate-clues";
import { merge, rename, dismiss, type DupState } from "../actions";

// Карточка пары. Клиентская ради двух вещей: подтверждение слияния в два клика (оно необратимо, а
// window.confirm подавляется в webview — см. решение про удаление генераций в ARCHITECTURE.md) и
// показ результата у той формы, которую нажали.

const CARD = "rounded-lg border border-hairline bg-surface-1 p-4";

function Note({ state }: { state: DupState }) {
  if (!state) return null;
  return <span className={`text-xs ${state.error ? "text-red-400" : "text-emerald-400"}`}>{state.error ?? state.ok}</span>;
}

/** Чем профиль наполнен — по этому оператор понимает, какой из двух оставлять. */
function Facts({ p }: { p: Candidate }) {
  const facts = [
    p.realName,
    p.accountId ? `id ${p.accountId}` : null,
    p.telegram ? `@${p.telegram}` : null,
    p.mmr ? `${p.mmr} MMR` : null,
    p.tp ? `${p.tp} TP` : null,
  ].filter(Boolean);

  return (
    <div>
      <div className="text-sm font-semibold text-ink">{p.nickname}</div>
      {facts.length > 0 && <div className="text-xs text-ink-subtle">{facts.join(" · ")}</div>}
      <div className="mt-1 text-xs text-ink-muted">
        мест в составах: {p.spots} · карт в статистике: {p.stats}
      </div>
      {p.teams.length > 0 && <div className="text-xs text-ink-subtle">{p.teams.join(", ")}</div>}
    </div>
  );
}

/** Смена ника: данные и стата остаются, меняется подпись — этого хватает, когда это не дубль. */
function RenameForm({ p }: { p: Candidate }) {
  const [state, action, pending] = useActionState(rename, null);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={p.id} />
      <input
        name="nickname"
        defaultValue={p.nickname}
        className="min-w-0 flex-1 rounded-md border border-hairline bg-surface-2 px-2 py-1 text-xs text-ink outline-none focus:border-accent-bright"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-hairline px-2 py-1 text-xs text-ink hover:border-accent-bright disabled:opacity-50"
      >
        Переименовать
      </button>
      <Note state={state} />
    </form>
  );
}

/** Кнопка слияния: первый клик показывает, что переедет, второй — сливает. */
function MergeButton({ winner, loser, impact }: { winner: Candidate; loser: Candidate; impact: Impact }) {
  const [armed, setArmed] = useState(false);
  const [state, action, pending] = useActionState(merge, null);

  const moving = [
    impact.spots ? `мест ${impact.spots}` : null,
    impact.stats ? `карт ${impact.stats}` : null,
    impact.points ? `начислений ${impact.points}` : null,
  ].filter(Boolean);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-md border border-hairline px-3 py-1 text-xs text-ink hover:border-accent-bright"
      >
        Оставить «{winner.nickname}»
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="winnerId" value={winner.id} />
      <input type="hidden" name="loserId" value={loser.id} />
      <span className="text-xs text-ink-muted">
        «{loser.nickname}» будет удалён
        {moving.length ? `, переедет: ${moving.join(", ")}` : ", переносить нечего"}
        {impact.dropped ? `; дублей схлопнется: ${impact.dropped}` : ""}.
      </span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-800 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
      >
        Объединить
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-xs text-ink-subtle hover:text-ink">
        отмена
      </button>
      <Note state={state} />
    </form>
  );
}

export function DuplicateRow({ pair, intoA, intoB }: { pair: Pair; intoA: Impact; intoB: Impact }) {
  return (
    <li className={CARD}>
      <div className="flex flex-wrap items-center gap-2">
        {pair.clues.map((clue) => (
          <span key={clue} className="rounded-md border border-hairline px-2 py-0.5 text-xs text-ink-muted">
            {CLUE_LABELS[clue]}
          </span>
        ))}
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <Facts p={pair.a} />
          <RenameForm p={pair.a} />
        </div>
        <div>
          <Facts p={pair.b} />
          <RenameForm p={pair.b} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
        <MergeButton winner={pair.a} loser={pair.b} impact={intoA} />
        <MergeButton winner={pair.b} loser={pair.a} impact={intoB} />
        <form action={dismiss}>
          <input type="hidden" name="aId" value={pair.a.id} />
          <input type="hidden" name="bId" value={pair.b.id} />
          <button type="submit" className="rounded-md border border-hairline px-3 py-1 text-xs text-ink-subtle hover:text-ink">
            Разные люди
          </button>
        </form>
      </div>
    </li>
  );
}
