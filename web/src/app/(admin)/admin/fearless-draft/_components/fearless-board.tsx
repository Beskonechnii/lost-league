"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/pouf/Button";
import {
  newFearless,
  buildPool,
  tossCoin,
  currentStep,
  currentTeam,
  isSelectable,
  applyPick,
  undo,
  nextGame,
  canNextGame,
  fearlessLocked,
  teamOfSeq,
  firstPickOf,
  radiantOf,
  picksOfGame,
  SEQUENCE,
  type FearlessState,
  type TeamIdx,
} from "@/lib/fearless";

export type TeamRef = { id: number; name: string; color: string; logo: string | null };
export type HeroRef = { id: number; name: string; slug: string; img: string; attr: "str" | "agi" | "int" | "all" };

const ATTR_LABEL: Record<HeroRef["attr"], string> = { str: "Сила", agi: "Ловкость", int: "Интеллект", all: "Универсал" };
const ATTR_ORDER: HeroRef["attr"][] = ["str", "agi", "int", "all"];
const BEST_OF = [1, 2, 3, 5];

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function FearlessBoard({
  teams,
  heroes,
  sessionId,
  initialState = null,
}: {
  teams: TeamRef[];
  heroes: HeroRef[];
  sessionId?: number;
  initialState?: FearlessState | null;
}) {
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const [state, setState] = useState<FearlessState | null>(initialState);

  // Автосейв в архив: PATCH payload при каждом изменении состояния (первый рендер — загруженное
  // состояние, его не пересохраняем). fetch в эффекте допустим (это не setState).
  const first = useRef(true);
  useEffect(() => {
    if (!sessionId || state === null) return;
    if (first.current) { first.current = false; return; }
    void fetch(`/api/fearless/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: state }),
    });
  }, [state, sessionId]);

  if (!state) {
    return <Setup teams={teams} heroes={heroes} onStart={setState} />;
  }
  return <Draft state={state} setState={setState} heroById={heroById} onReset={() => setState(null)} />;
}

/* ─────────────────────────── Настройка + монетка ─────────────────────────── */

function Setup({ teams, heroes, onStart }: { teams: TeamRef[]; heroes: HeroRef[]; onStart: (s: FearlessState) => void }) {
  const [aId, setAId] = useState<number | null>(teams[0]?.id ?? null);
  const [bId, setBId] = useState<number | null>(teams[1]?.id ?? null);
  const [bestOf, setBestOf] = useState(3);
  const [coin, setCoin] = useState<TeamIdx | null>(null); // кто выиграл бросок
  const [firstPick, setFirstPick] = useState<TeamIdx>(0);
  const [radiant, setRadiant] = useState<TeamIdx>(0);

  const a = teams.find((t) => t.id === aId);
  const b = teams.find((t) => t.id === bId);
  const ready = a && b && a.id !== b.id;
  const names: [string, string] = [a?.name ?? "Команда A", b?.name ?? "Команда B"];

  const start = () => {
    if (!a || !b) return;
    const pool = buildPool(heroes.map((h) => ({ id: h.id, attr: h.attr })));
    onStart(
      newFearless([{ name: a.name, color: a.color }, { name: b.name, color: b.color }], {
        bestOf,
        pool,
        firstPick,
        radiant,
      }),
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">Fearless draft</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Пул карты — по 9 случайных героев на атрибут, на каждой карте новый. Герои, взятые в прошлых картах, в пул не попадают; баны — покарточные.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TeamPick label="Команда A" teams={teams} value={aId} onChange={setAId} exclude={bId} />
        <TeamPick label="Команда B" teams={teams} value={bId} onChange={setBId} exclude={aId} />
      </div>

      <div>
        <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Формат</div>
        <div className="flex gap-2">
          {BEST_OF.map((n) => (
            <button key={n} type="button" onClick={() => setBestOf(n)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${bestOf === n ? "border-accent bg-accent/15 text-accent-bright" : "border-hairline bg-surface-1 text-ink-muted hover:border-accent/50"}`}>
              Bo{n}
            </button>
          ))}
        </div>
      </div>

      {/* Монетка: бросок случаен, победитель выбирает блок; операторы вводят итог двумя строками */}
      <div className="rounded-card bg-surface p-4 cushion-card">
        <div className="flex items-center gap-3">
          <Button type="button" variant="quiet" size="sm" onClick={() => setCoin(tossCoin())}>
            🪙 Бросить монетку
          </Button>
          {coin !== null && (
            <span className="text-sm">
              Победила: <b style={{ color: teams.find((t) => t.id === (coin === 0 ? aId : bId))?.color ?? undefined }}>{names[coin]}</b>
              <span className="ml-2 text-ink-subtle">— выбирает сторону или очередь, второе идёт сопернику</span>
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PickTwo label="Первый пик (FP)" names={names} value={firstPick} onChange={setFirstPick} />
          <PickTwo label="Свет (Radiant)" names={names} value={radiant} onChange={setRadiant} />
        </div>
      </div>

      <Button type="button" tone="orange" disabled={!ready} onClick={start}>Начать драфт</Button>
      {!ready && <p className="text-xs font-bold text-muted">Выберите две разные команды.</p>}
    </div>
  );
}

function PickTwo({ label, names, value, onChange }: { label: string; names: [string, string]; value: TeamIdx; onChange: (v: TeamIdx) => void }) {
  return (
    <div>
      <div className="mb-1 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">{label}</div>
      <div className="flex gap-2">
        {([0, 1] as TeamIdx[]).map((i) => (
          <button key={i} type="button" onClick={() => onChange(i)}
            className={`flex-1 truncate rounded-[14px] px-3 py-2 text-sm font-black transition-[box-shadow,transform,background] ${value === i ? "bg-accent-fill text-[var(--on-accent)] cushion-control" : "bg-surface text-ink-muted cushion-field hover:text-ink"}`}>
            {names[i]}
          </button>
        ))}
      </div>
    </div>
  );
}

function TeamPick({ label, teams, value, onChange, exclude }: { label: string; teams: TeamRef[]; value: number | null; onChange: (id: number) => void; exclude: number | null }) {
  return (
    <label className="block">
      <div className="mb-1 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">{label}</div>
      <select value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-control bg-bg px-3 py-2 text-sm font-bold text-ink outline-none cushion-field">
        {teams.map((t) => (
          <option key={t.id} value={t.id} disabled={t.id === exclude}>{t.name}</option>
        ))}
      </select>
    </label>
  );
}

/* ─────────────────────────────── Драфт ─────────────────────────────── */

function Draft({ state, setState, heroById, onReset }: {
  state: FearlessState;
  setState: (s: FearlessState) => void;
  heroById: Map<number, HeroRef>;
  onReset: () => void;
}) {
  // Новая карта = свежий рандом-пул (9/атрибут), но БЕЗ уже сыгранных (взятых) в серии героев.
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

  // Таймеры: банк доп-времени на команду; секундомер хода в state (ref в рендере читать нельзя)
  const current = state.current;
  const movesCount = state.games[current]?.moves.length ?? 0;
  const hasStep = step !== null;
  const [reserve, setReserve] = useState<[number, number]>([state.reserveSec, state.reserveSec]);
  const [now, setNow] = useState(() => Date.now());
  const [turnStart, setTurnStart] = useState(() => Date.now());

  // Секундомер хода сбрасываем в обработчиках хода (не в эффекте — линтер запрещает setState в эффекте).
  const resetTurn = () => { setTurnStart(Date.now()); setNow(Date.now()); };
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
  const doUndo = () => { setState(undo(state)); resetTurn(); };
  const doNext = () => {
    const advanced = nextGame(state);
    setState({ ...advanced, pool: rerollPool(advanced) }); // новый пул без сыгранных героев
    setReserve([state.reserveSec, state.reserveSec]);
    resetTurn();
  };

  return (
    <div className="space-y-4">
      {/* Таймеры: резерв слева, активный ход по центру, резерв справа (как на референсе) */}
      <div className="grid grid-cols-3 items-center gap-3">
        <ReserveTimer team={state.teams[0]} value={reserve[0] - (active === 0 ? overage : 0)} active={active === 0} />
        <div className="text-center">
          <div className={`text-3xl font-bold tabular-nums ${mainLeft < 0 ? "text-rose-700" : "text-ink"}`}>
            {step ? fmtTime(mainLeft < 0 ? activeReserveLeft : mainLeft) : "0:00"}
          </div>
          <div className="text-[11px] uppercase tracking-widest text-ink-subtle">
            {step ? (mainLeft < 0 ? "доп-время" : "ход") : "карта задрафчена"}
          </div>
        </div>
        <ReserveTimer team={state.teams[1]} value={reserve[1] - (active === 1 ? overage : 0)} active={active === 1} right />
      </div>

      {/* Шапка: карта, чей ход, управление */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-1 p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Карта {state.current + 1} / {state.bestOf}</span>
          <span className="text-ink-subtle">свет: <b className="text-ink">{state.teams[light].name}</b> · первый пик: <b className="text-ink">{state.teams[first].name}</b></span>
          {step ? (
            <span className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ background: state.teams[active!].color }}>
              {state.teams[active!].name} — {step.action === "ban" ? "банит" : "пикает"}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-700">Карта задрафчена</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="quiet" size="sm" onClick={doUndo} disabled={movesCount === 0}>← Отменить</Button>
          {canNextGame(state) && <Button type="button" size="sm" onClick={doNext}>Следующая карта →</Button>}
          <Button type="button" variant="quiet" tone="down" size="sm" onClick={onReset}>Сбросить</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Нумерованная сетка последовательности (как на референсе) */}
        <Sequence state={state} heroById={heroById} />

        <div className="space-y-4">
          <PoolGrid state={state} heroById={heroById} locked={locked} onPick={commit} disabled={!step} />
          <PastMaps state={state} heroById={heroById} />
        </div>
      </div>
    </div>
  );
}

function ReserveTimer({ team, value, active, right }: { team: { name: string; color: string }; value: number; active: boolean; right?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${right ? "justify-end" : ""}`}>
      {!right && <span className="h-3 w-3 rounded-full" style={{ background: team.color }} />}
      <div className={right ? "text-right" : ""}>
        <div className="truncate text-sm font-semibold text-ink">{team.name}</div>
        <div className={`text-lg font-bold tabular-nums ${active ? "text-accent-bright" : "text-ink-subtle"}`}>{fmtTime(value)}</div>
      </div>
      {right && <span className="h-3 w-3 rounded-full" style={{ background: team.color }} />}
    </div>
  );
}

/** Нумерованная сетка 1..18: слева команда-первопик, справа вторая; текущий шаг подсвечен. */
function Sequence({ state, heroById }: { state: FearlessState; heroById: Map<number, HeroRef> }) {
  const moves = state.games[state.current]?.moves ?? [];
  const leftTeam = firstPickOf(state, state.current); // слева тот, кто ходит первым
  return (
    <div className="rounded-2xl border border-hairline bg-surface-1 p-3">
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">
        <span className="truncate">{state.teams[leftTeam].name}</span>
        <span className="px-3">#</span>
        <span className="truncate text-right">{state.teams[(1 - leftTeam) as TeamIdx].name}</span>
      </div>
      <div className="space-y-1">
        {SEQUENCE.map((s, i) => {
          const team = teamOfSeq(state, state.current, s.seq);
          const onLeft = team === leftTeam;
          const move = moves[i];
          const isCurrent = i === moves.length;
          const hero = move ? heroById.get(move.heroId) : undefined;
          const cell = (
            <SeqCell action={s.action} hero={hero} color={state.teams[team].color} current={isCurrent} align={onLeft ? "left" : "right"} />
          );
          return (
            <div key={i} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-1 ${isCurrent ? "bg-accent/10 ring-1 ring-accent" : ""}`}>
              <div>{onLeft && cell}</div>
              <div className="w-8 text-center text-sm font-bold tabular-nums text-ink-subtle">{i + 1}</div>
              <div className="flex justify-end">{!onLeft && cell}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeqCell({ action, hero, color, current, align }: { action: "ban" | "pick"; hero: HeroRef | undefined; color: string; current: boolean; align: "left" | "right" }) {
  const isBan = action === "ban";
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <div className="h-9 w-[58px] shrink-0 overflow-hidden rounded" style={{ boxShadow: hero ? `inset 0 0 0 2px ${color}` : undefined }}>
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.img} alt={hero.name} className={`h-full w-full object-cover ${isBan ? "opacity-40 grayscale" : ""}`} />
        ) : (
          <div className={`h-full w-full ${current ? "bg-accent/20" : "bg-canvas/50"} grid place-items-center text-[10px] uppercase text-ink-subtle`}>{isBan ? "бан" : "пик"}</div>
        )}
      </div>
      {hero && <span className={`truncate text-xs ${isBan ? "text-ink-subtle line-through" : "text-ink"}`}>{hero.name}</span>}
    </div>
  );
}

/** Пул серии: только рандом-герои, сгруппированы по атрибуту. */
function PoolGrid({ state, heroById, locked, onPick, disabled }: {
  state: FearlessState;
  heroById: Map<number, HeroRef>;
  locked: Set<number>;
  onPick: (id: number) => void;
  disabled: boolean;
}) {
  const groups = useMemo(() => {
    const byAttr = new Map<HeroRef["attr"], HeroRef[]>();
    for (const id of state.pool) {
      const h = heroById.get(id);
      if (!h) continue;
      const arr = byAttr.get(h.attr) ?? [];
      arr.push(h);
      byAttr.set(h.attr, arr);
    }
    return ATTR_ORDER.map((attr) => ({ attr, heroes: (byAttr.get(attr) ?? []).sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [state.pool, heroById]);

  return (
    <div className="rounded-2xl border border-hairline bg-surface-1 p-3">
      <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Пул карты · {state.pool.length} героев</div>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.attr}>
            <div className="mb-1 text-[11px] text-ink-subtle">{ATTR_LABEL[g.attr]}</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(50px,1fr))] gap-1">
              {g.heroes.map((h) => {
                const selectable = !disabled && isSelectable(state, h.id);
                const isLocked = locked.has(h.id);
                return (
                  <button key={h.id} type="button" disabled={!selectable} onClick={() => onPick(h.id)}
                    title={isLocked ? `${h.name} — уже взят в серии` : h.name}
                    className={`group relative overflow-hidden rounded-md border transition ${selectable ? "border-hairline hover:border-accent hover:ring-1 hover:ring-accent" : "cursor-not-allowed border-transparent"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={h.img} alt={h.name} className={`h-8 w-full object-cover transition ${selectable ? "" : "opacity-30 grayscale"}`} />
                    {isLocked && <span className="absolute inset-0 grid place-items-center bg-canvas/50 text-[8px] font-bold uppercase text-rose-700">в серии</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Запись героев прошлых карт серии — каждая карта отдельно (item 5). */
function PastMaps({ state, heroById }: { state: FearlessState; heroById: Map<number, HeroRef> }) {
  if (state.current === 0) return null;
  return (
    <div className="rounded-2xl border border-hairline bg-surface-1 p-3">
      <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Взято в прошлых картах</div>
      <div className="space-y-2">
        {Array.from({ length: state.current }).map((_, gi) => {
          const picks = picksOfGame(state, gi);
          return (
            <div key={gi} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-ink-subtle">Карта {gi + 1}</span>
              <div className="flex flex-wrap gap-1">
                {picks.map((m, i) => {
                  const h = heroById.get(m.heroId);
                  return h ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={h.img} alt={h.name} title={h.name} className="h-6 w-[38px] rounded object-cover" style={{ boxShadow: `inset 0 0 0 1px ${state.teams[m.team].color}` }} />
                  ) : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
