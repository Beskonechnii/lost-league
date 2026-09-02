"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { Panel } from "../../../_components/panel";
import {
  applyPick,
  buildPool,
  canNextGame,
  currentStep,
  currentTeam,
  fearlessLocked,
  firstPickOf,
  nextGame,
  radiantOf,
  undo,
  type FearlessState,
} from "@/lib/fearless";
import { HeroPool } from "./hero-pool";
import { PastMaps } from "./past-maps";
import { Sequence } from "./sequence";
import { fmtTime, type HeroRef } from "./types";

/**
 * Сам драфт: таймеры, чей ход, расписание карты, пул и запись прошлых карт.
 *
 * Отделён от оболочки (`fearless-board.tsx`) по той же границе, что серии на Э9 и шоу-драфт на
 * Э11a: там — состояние сессии и автосейв, здесь — ход карты и его таймеры. Таймеры сознательно
 * живут ТОЛЬКО здесь и не едут в payload: они идут в реальном времени у оператора, а сохранять
 * в базу четыре раза в секунду нечего.
 */
export function FearlessRun({
  state,
  setState,
  heroById,
  onReset,
}: {
  state: FearlessState;
  setState: (s: FearlessState) => void;
  heroById: Map<number, HeroRef>;
  onReset: () => void;
}) {
  // Новая карта = свежий рандом-пул (9/атрибут), но БЕЗ уже взятых в серии героев.
  const rerollPool = (s: FearlessState): number[] => {
    const played = new Set<number>();
    for (const g of s.games) for (const m of g.moves) if (m.action === "pick") played.add(m.heroId);
    const avail = [...heroById.values()].filter((h) => !played.has(h.id));
    return buildPool(avail.map((h) => ({ id: h.id, attr: h.attr })));
  };

  const step = currentStep(state);
  const active = currentTeam(state);
  const locked = fearlessLocked(state);
  const first = firstPickOf(state, state.current);
  const light = radiantOf(state, state.current);

  // Таймеры: банк доп-времени на команду; секундомер хода — в состоянии (ref в рендере читать нельзя).
  const current = state.current;
  const movesCount = state.games[current]?.moves.length ?? 0;
  const hasStep = step !== null;
  const [reserve, setReserve] = useState<[number, number]>([state.reserveSec, state.reserveSec]);
  const [now, setNow] = useState(() => Date.now());
  const [turnStart, setTurnStart] = useState(() => Date.now());

  // Секундомер хода сбрасываем в обработчиках хода (не в эффекте — линтер запрещает setState в эффекте).
  const resetTurn = () => {
    setTurnStart(Date.now());
    setNow(Date.now());
  };
  // Тик, пока карта не задрафчена (setState внутри колбэка интервала — это допустимо)
  useEffect(() => {
    if (!hasStep) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [hasStep, movesCount, current]);

  const elapsed = (now - turnStart) / 1000;
  const mainLeft = state.mainSec - elapsed;
  const overage = Math.max(0, -mainLeft); // сколько уже съели из банка
  const activeReserveLeft = active !== null ? reserve[active] - overage : 0;

  // Применить ход: списать переработку из банка активной команды и обнулить секундомер
  const commit = (heroId: number) => {
    if (active !== null && overage > 0) {
      setReserve((r) => {
        const next = [...r] as [number, number];
        next[active] = Math.max(0, next[active] - overage);
        return next;
      });
    }
    setState(applyPick(state, heroId));
    resetTurn();
  };
  const doUndo = () => {
    setState(undo(state));
    resetTurn();
  };
  const doNext = () => {
    const advanced = nextGame(state);
    setState({ ...advanced, pool: rerollPool(advanced) }); // новый пул без сыгранных героев
    setReserve([state.reserveSec, state.reserveSec]);
    resetTurn();
  };

  return (
    <div className="space-y-4">
      {/* Часы: банк слева, ход по центру, банк справа — раскладка эфирного табло */}
      <Panel>
        <div className="grid grid-cols-3 items-center gap-3">
          <ReserveTimer team={state.teams[0]} value={reserve[0] - (active === 0 ? overage : 0)} active={active === 0} />
          <div className="text-center">
            <div className={`text-3xl font-black tabular-nums ${mainLeft < 0 ? "text-err-ink" : "text-ink"}`}>
              {step ? fmtTime(mainLeft < 0 ? activeReserveLeft : mainLeft) : "0:00"}
            </div>
            <div className="text-[11px] font-black uppercase tracking-[1px] text-muted">
              {step ? (mainLeft < 0 ? "доп-время" : "ход") : "карта задрафчена"}
            </div>
          </div>
          <ReserveTimer
            team={state.teams[1]}
            value={reserve[1] - (active === 1 ? overage : 0)}
            active={active === 1}
            right
          />
        </div>
      </Panel>

      {/* Шапка карты: какая карта, стороны, чей ход и управление */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
            <StatusPill>
              Карта {state.current + 1} / {state.bestOf}
            </StatusPill>
            <span>
              свет: <b className="text-ink">{state.teams[light].name}</b> · первый пик:{" "}
              <b className="text-ink">{state.teams[first].name}</b>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="quiet" size="sm" onClick={doUndo} disabled={movesCount === 0}>
              <Icon name="prev" size="sm" /> Отменить
            </Button>
            {canNextGame(state) && (
              <Button size="sm" onClick={doNext}>
                Следующая карта <Icon name="next" size="sm" />
              </Button>
            )}
            <Button variant="quiet" tone="down" size="sm" onClick={onReset}>
              Сбросить
            </Button>
          </div>
        </div>

        {/* Чей ход — на всю ширину под управлением: это главная строка экрана, её читают
            каждые полминуты. Цвет команды сырым hex — тот же, что горит в трансляции (§C5). */}
        <div className="mt-3">
          {step && active !== null ? (
            <div
              className="flex flex-wrap items-center gap-2 rounded-card bg-surface px-4 py-3 font-pouf text-sm font-bold text-muted cushion-card"
              style={{ outline: `2px solid ${state.teams[active].color}`, outlineOffset: 2 }}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-pill" style={{ background: state.teams[active].color }} />
              <span>
                Ход команды <b className="text-ink">{state.teams[active].name}</b> —{" "}
                {step.action === "ban" ? "банит" : "пикает"}. Нажмите на героя в пуле.
              </span>
            </div>
          ) : (
            <Alert tone="ok" block>
              Карта задрафчена.{" "}
              {canNextGame(state)
                ? "Жмите «Следующая карта» — пул соберётся заново, без уже взятых героев."
                : "Серия отдрафчена целиком."}
            </Alert>
          )}
        </div>
      </Panel>

      {/* На узком экране пул идёт первым: это то, по чему оператор нажимает каждый ход, и
          проматывать до него два десятка строк расписания пришлось бы двадцать раз за карту. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4 lg:order-2">
          <HeroPool state={state} heroById={heroById} locked={locked} onPick={commit} disabled={!step} />
          <PastMaps state={state} heroById={heroById} />
        </div>
        <div className="lg:order-1">
          <Sequence state={state} heroById={heroById} />
        </div>
      </div>
    </div>
  );
}

/** Банк доп-времени команды. Активный банк подсвечен — по нему видно, чьи секунды идут. */
function ReserveTimer({
  team,
  value,
  active,
  right,
}: {
  team: { name: string; color: string };
  value: number;
  active: boolean;
  right?: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 font-pouf ${right ? "justify-end" : ""}`}>
      {!right && <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />}
      <div className={`min-w-0 ${right ? "text-right" : ""}`}>
        <div className="truncate text-sm font-black text-ink">{team.name}</div>
        {/* Активный банк — акцентным ink Кита: тем же мятным, что и подсветка текущего шага. */}
        <div className={`text-lg font-black tabular-nums ${active ? "text-[var(--accent-ink)]" : "text-muted"}`}>
          {fmtTime(value)}
        </div>
      </div>
      {right && <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />}
    </div>
  );
}
