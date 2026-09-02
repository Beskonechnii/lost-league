"use client";

import { useActionState, useState } from "react";
import { CLUE_LABELS, type Candidate, type Impact, type Pair } from "@/lib/duplicate-clues";
import { merge, rename, dismiss, type DupState } from "../actions";
import { Button } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { QueueCard, QueueDecision, QueueNote } from "@/components/pouf/queue-card";
import { Chip } from "@/components/pouf/blocks";

// Карточка пары. Клиентская ради двух вещей: подтверждение слияния в два клика (оно необратимо, а
// window.confirm подавляется в webview — см. решение про удаление генераций в ARCHITECTURE.md) и
// показ результата у той формы, которую нажали.
//
// С Э9 карточка носит рисунок очереди Кита (`QueueCard`): дубли — такая же очередь решений, как
// модерация, и до этого этапа они рисовали её своими руками, включая кнопки, сделанные из
// `<button className="rounded-md border …">` мимо кнопки Кита вовсе.

function Note({ state }: { state: DupState }) {
  if (!state) return null;
  return (
    <Alert tone={state.error ? "err" : "ok"}>{state.error ?? state.ok}</Alert>
  );
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
    <div className="font-pouf">
      <div className="text-[15px] font-black tracking-[-0.2px] text-ink">{p.nickname}</div>
      {facts.length > 0 && <div className="text-xs font-bold text-muted">{facts.join(" · ")}</div>}
      <div className="mt-1 text-xs font-bold text-ink-muted">
        мест в составах: {p.spots} · карт в статистике: {p.stats}
      </div>
      {p.teams.length > 0 && <div className="text-xs font-bold text-muted">{p.teams.join(", ")}</div>}
    </div>
  );
}

/** Смена ника: данные и стата остаются, меняется подпись — этого хватает, когда это не дубль. */
function RenameForm({ p }: { p: Candidate }) {
  const [state, action, pending] = useActionState(rename, null);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={p.id} />
      <FormInput
        name="nickname"
        size="sm"
        defaultValue={p.nickname}
        aria-label={`Ник профиля ${p.nickname}`}
        className="min-w-[10rem] flex-1"
      />
      <Button type="submit" size="sm" variant="quiet" disabled={pending}>
        Переименовать
      </Button>
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
      <Button type="button" size="sm" variant="quiet" onClick={() => setArmed(true)}>
        Оставить «{winner.nickname}»
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="winnerId" value={winner.id} />
      <input type="hidden" name="loserId" value={loser.id} />
      <span className="font-pouf text-xs font-bold text-ink-muted">
        «{loser.nickname}» будет удалён
        {moving.length ? `, переедет: ${moving.join(", ")}` : ", переносить нечего"}
        {impact.dropped ? `; дублей схлопнется: ${impact.dropped}` : ""}.
      </span>
      {/* tone="down" — то же слово, каким Кит красит необратимое в диалогах удаления. */}
      <Button type="submit" size="sm" tone="down" disabled={pending}>
        Объединить
      </Button>
      <Button type="button" size="sm" variant="quiet" onClick={() => setArmed(false)}>
        Отмена
      </Button>
      <Note state={state} />
    </form>
  );
}

export function DuplicateRow({ pair, intoA, intoB }: { pair: Pair; intoA: Impact; intoB: Impact }) {
  return (
    <li>
      <QueueCard
        tags={pair.clues.map((clue) => (
          <Chip key={clue}>{CLUE_LABELS[clue]}</Chip>
        ))}
        title={`${pair.a.nickname} ↔ ${pair.b.nickname}`}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <QueueNote>
            <Facts p={pair.a} />
            <RenameForm p={pair.a} />
          </QueueNote>
          <QueueNote>
            <Facts p={pair.b} />
            <RenameForm p={pair.b} />
          </QueueNote>
        </div>

        <QueueDecision>
          <MergeButton winner={pair.a} loser={pair.b} impact={intoA} />
          <MergeButton winner={pair.b} loser={pair.a} impact={intoB} />
          <form action={dismiss}>
            <input type="hidden" name="aId" value={pair.a.id} />
            <input type="hidden" name="bId" value={pair.b.id} />
            <Button type="submit" size="sm" variant="quiet">Разные люди</Button>
          </form>
        </QueueDecision>
      </QueueCard>
    </li>
  );
}
