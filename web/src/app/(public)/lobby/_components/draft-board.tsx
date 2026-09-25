"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/pouf/Button";
import { Alert, EmptyState, StatusPill } from "@/components/pouf/feedback";
import { Sheet } from "@/components/pouf/sheet";
import { Eyebrow } from "@/components/pouf/text";
import {
  CaptainPlate,
  DraftHeroButton,
  DraftRail,
  DraftSlot,
  TurnClock,
  type DraftHero,
} from "@/components/pouf/draft";
import {
  SEQUENCE,
  currentStep,
  currentTeam,
  fearlessLocked,
  firstPickOf,
  isSelectable,
  radiantOf,
  type FearlessState,
  type Seq,
  type TeamIdx,
} from "@/lib/fearless";
import type { LobbyCaptain, LobbySide } from "@/lib/lobby-room";
import { PlayerAvatar } from "../../roster/_components/avatar";

/**
 * Борд драфта комнаты по референсу WSS (ТЗ 42г): две краевые колонки слотов, центр — пул,
 * низ — статусы сторон и плашки капитанов.
 *
 * Собран из атомов Кита (`pouf/draft.tsx`), а не из борда оператора: `admin/fearless-draft`
 * остаётся как есть (Scope), переиспользовать его нельзя (DESIGN-10), и третьей копии одной
 * мысли здесь не заводится — раскладка и состояния живут в атомах и в секции DRAFT `pouf.css`.
 *
 * Один экран на двух потребителей: комнату (`room.tsx`) и ОБС-вид
 * (`(bare)/overlay/lobby/[key]`). Разница между ними — только право хода: в эфире `onPick`
 * не приходит вовсе, и ни одна плитка не кликается.
 *
 * Часы считает СЕРВЕР: `turn.startedAt` приезжает снимком, уже сдвинутый в часы этой вкладки.
 * Вкладка их только рисует — закрытая вкладка время не останавливает, а перезагрузка не
 * обнуляет.
 */

export type BoardTurn = {
  /** Отметка начала хода в часах ЭТОЙ вкладки. null — ход не идёт. */
  startedAt: number | null;
  /** Банк доп-времени по ИНДЕКСУ КОМАНДЫ, не по стороне экрана. */
  reserve: [number, number];
  autoFrom: number | null;
};

export function DraftBoard({
  state,
  heroById,
  sides,
  captains,
  turn,
  mainSec,
  reserveSec,
  myCaptainSide = null,
  myTurn = false,
  busy = false,
  onPick,
  onNext,
  lockReason,
  view = null,
  ready = null,
  afterDraft,
}: {
  /** null — драфта ещё нет (сбор, монетка): слоты пустые, пул закрыт. */
  state: FearlessState | null;
  heroById: Map<number, DraftHero>;
  sides: [LobbySide, LobbySide];
  captains: [LobbyCaptain | null, LobbyCaptain | null];
  turn: BoardTurn;
  mainSec: number;
  reserveSec: number;
  /** Сторона, капитаном которой я являюсь: только ей плашка говорит «Вы капитан». */
  myCaptainSide?: TeamIdx | null;
  /** Мой ход: только тогда пул вообще кликается. Право проверяет сервер, это про экран. */
  myTurn?: boolean;
  busy?: boolean;
  onPick?: (heroId: number) => void;
  /** Следующая карта — только у админа комнаты. */
  onNext?: (() => void) | null;
  /** Почему пул закрыт — строкой из `sideBlocker`. */
  lockReason?: string | null;
  /** Какую карту серии показываем. null — текущую; прошлая идёт только на чтение (ТЗ 42д §6). */
  view?: number | null;
  /** Готовность сторон до старта драфта: «ГОТОВ» / «ЖДЁМ» (DESIGN-1). В эфире её нет — там до
   *  монетки борда не видно вовсе. */
  ready?: [boolean, boolean] | null;
  /** Что стоит в центре, когда карта задрафчена: назначение героев (42д) или запись прошлой. */
  afterDraft?: ReactNode;
}) {
  // Прошлая карта не происходит — она уже сыграна: ни хода, ни часов, ни пула у неё нет.
  const gameIdx = view ?? state?.current ?? 0;
  const past = state !== null && gameIdx !== state.current;
  const step = state && !past ? currentStep(state) : null;
  const active = state && !past ? currentTeam(state) : null;
  const moves = state ? (state.games[gameIdx]?.moves ?? []) : [];

  // Выбранный, но не отправленный герой (приём 22б): ход уходит вторым действием, отмены после
  // него нет. Номер хода лежит в самой отметке — приехал чужой ход, номер разошёлся, выбор погас.
  const [chosen, setChosen] = useState<{ heroId: number; at: number } | null>(null);
  // Кому сейчас разрешено играть ролик. Ровно один на вкладку: иначе десятки декодеров.
  const [hot, setHot] = useState<number | null>(null);
  const [poolOpen, setPoolOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Тик часов, пока карта не задрафчена. setState внутри колбэка интервала — допустимо.
  const hasStep = step !== null;
  useEffect(() => {
    if (!hasStep) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [hasStep, moves.length, gameIdx]);

  const elapsed = (now - (turn.startedAt ?? now)) / 1000;
  const mainLeft = mainSec - elapsed;
  const overage = Math.max(0, -mainLeft); // сколько уже съели из банка
  const bankOf = (team: TeamIdx) => Math.max(0, turn.reserve[team] - (active === team ? overage : 0));

  // Слева — тот, кто ходит первым на этой карте: сторона чередуется по картам, и прибитая к
  // индексу колонка на чётной карте встала бы под чужой банк.
  const left: TeamIdx = state ? firstPickOf(state, gameIdx) : 0;
  const right = (1 - left) as TeamIdx;
  const seqOf = (team: TeamIdx): Seq => (team === left ? 0 : 1);

  const locked = useMemo(() => (state ? fearlessLocked(state) : new Set<number>()), [state]);
  const pending = myTurn && chosen?.at === moves.length ? chosen.heroId : null;
  const lastPick = moves.length > 0 && moves[moves.length - 1].action === "pick" ? moves.length - 1 : -1;

  const rail = (team: TeamIdx, side: "left" | "right", footer?: ReactNode) => {
    const mySeq = seqOf(team);
    const slot = (i: number, action: "ban" | "pick") => {
      const move = moves[i];
      return (
        <DraftSlot
          key={i}
          n={i + 1}
          action={action}
          hero={move ? heroById.get(move.heroId) : undefined}
          color={sides[team].color}
          current={state !== null && i === moves.length && hasStep}
          last={!past && i === lastPick}
          past={past}
        />
      );
    };
    const pick = (action: "ban" | "pick") =>
      SEQUENCE.flatMap((s, i) => (s.seq === mySeq && s.action === action ? [slot(i, action)] : []));

    return (
      <DraftRail
        name={sides[team].name}
        color={sides[team].color}
        sub={state ? (radiantOf(state, gameIdx) === team ? "свет" : "тьма") : undefined}
        side={side}
        active={active === team}
        bans={pick("ban")}
        picks={pick("pick")}
        footer={footer}
      />
    );
  };

  // Пул одной разметкой на два места: борд на широком и `Sheet` на узком. Считается он всё равно
  // один раз, а два `<video>` сразу не появятся — играющий ролик ровно один на вкладку (`hot`).
  const pool = (
    <div className="pouf-pool">
      {(state?.pool ?? [])
        .flatMap((id) => {
          const h = heroById.get(id);
          return h ? [h] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((h) => {
          const free = state ? isSelectable(state, h.id) : false;
          const note = !free ? (locked.has(h.id) ? "в серии" : "занят") : undefined;
          const tile = pending === h.id ? "chosen" : !free ? "gone" : myTurn && hasStep ? "free" : "view";
          return (
            <DraftHeroButton
              key={h.id}
              hero={h}
              state={tile}
              note={note}
              playing={hot === h.id || pending === h.id}
              onHot={setHot}
              onPick={() => setChosen({ heroId: h.id, at: moves.length })}
            />
          );
        })}
    </div>
  );

  // Подтверждение — второе действие, и оно обязано быть ТАМ ЖЕ, где выбирали: на узком экране
  // пул живёт в шторке, а центр борда спрятан, и оставленная в нём кнопка была бы невидима —
  // капитан выбрал бы героя и не смог сходить.
  const confirm =
    pending === null || !step ? null : (
      <Confirm
        hero={heroById.get(pending)}
        action={step.action}
        busy={busy}
        onCommit={() => {
          onPick?.(pending);
          setPoolOpen(false);
        }}
        onCancel={() => setChosen(null)}
      />
    );

  const center = !state ? (
    <EmptyState icon="lock" title="Пул откроется после готовности обеих сторон">
      {lockReason ?? "Стороны собираются: нужны пятёрки и капитаны."}
    </EmptyState>
  ) : !hasStep ? (
    (afterDraft ?? (
      <Alert tone="ok" block>
        Карта задрафчена.{" "}
        {onNext ? "Жмите «Следующая карта»." : "Следующую карту откроет админ комнаты."}
      </Alert>
    ))
  ) : (
    <>
      {/* «Время вышло — сходили за тебя»: в состоянии драфта такой пометки нет, она живёт
          снимком комнаты и держится ровно до следующего хода. */}
      {turn.autoFrom !== null && moves.length > turn.autoFrom && (
        <Alert tone="warn" block>
          Время вышло — ход сделан автоматически:{" "}
          <b>
            {moves
              .slice(turn.autoFrom)
              .slice(-3)
              .map((m) => `${heroById.get(m.heroId)?.name ?? "герой"} (${m.action === "ban" ? "бан" : "пик"})`)
              .join(", ")}
          </b>
          .
        </Alert>
      )}
      {confirm ?? (
        <p className="text-[13px] font-bold text-muted">
          {myTurn ? (
            <>
              <b className="text-ink">Ваш ход</b> — {step!.action === "ban" ? "забаньте" : "возьмите"} героя в пуле.
            </>
          ) : (
            <>
              Ход стороны <b className="text-ink">{sides[active ?? 0].name}</b> —{" "}
              {step!.action === "ban" ? "банит" : "пикает"}.
            </>
          )}
        </p>
      )}
      <div className="max-lg:hidden">{pool}</div>
    </>
  );

  const foot = (team: TeamIdx, side: "left" | "right") => {
    const cap = captains[team];
    return (
      <div className="pouf-draft__foot-side" data-align={side === "right" ? "right" : undefined}>
        {/* До драфта строка статусов отвечает на «собрались ли» — «ГОТОВ» / «ЖДЁМ» по кнопке
            капитана (DESIGN-1). Дальше тот же пилюль отвечает на «чей ход». */}
        {state === null && ready ? (
          <StatusPill tone={ready[team] ? "ok" : "neutral"}>{ready[team] ? "ГОТОВ" : "ЖДЁМ"}</StatusPill>
        ) : (
          <StatusPill tone={active === team ? "ok" : "neutral"}>{active === team ? "ходит" : "ждёт"}</StatusPill>
        )}
        <CaptainPlate
          avatar={<PlayerAvatar photo={cap?.photo ?? null} nickname={cap?.nickname ?? "?"} size={28} shape="circle" />}
          nickname={cap?.nickname ?? null}
          sideName={sides[team].name}
          mine={myCaptainSide === team}
          reserveSec={bankOf(team)}
          reserveMax={reserveSec}
          align={side === "right" ? "right" : "left"}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Карта задрафчена — центр перестаёт быть пулом и становится панелью назначения. На узком
          пул спрятан намеренно (он съел бы экран), а панель обязана быть видна: она и есть
          действие этой стадии, поэтому центр включается флагом. */}
      <section className="pouf-draft" data-after={!hasStep && afterDraft ? "" : undefined}>
        <div className="pouf-draft__turn">
          {past ? (
            <div className="font-pouf">
              <Eyebrow>Карта {gameIdx + 1}</Eyebrow>
              <p className="text-[13px] font-bold text-muted">Сыграна — только запись.</p>
            </div>
          ) : state ? (
            <TurnClock
              seconds={mainLeft < 0 ? bankOf(active ?? 0) : mainLeft}
              mode={!hasStep ? "idle" : mainLeft < 0 ? "reserve" : "main"}
              align={active === left ? "start" : "end"}
              name={active !== null ? sides[active].name : undefined}
            />
          ) : (
            <div className="font-pouf">
              <Eyebrow>Драфт</Eyebrow>
              <p className="text-[13px] font-bold text-muted">Начнётся после монетки.</p>
            </div>
          )}
          {hasStep && (
            <span className="ml-auto lg:hidden">
              <StatusPill tone={myTurn ? "ok" : "neutral"}>{myTurn ? "Ваш ход" : "Ход соперника"}</StatusPill>
            </span>
          )}
        </div>

        <div className="pouf-draft__rail-a">{rail(left, "left")}</div>
        <div className="pouf-draft__center space-y-3">{center}</div>
        <div className="pouf-draft__rail-b">{rail(right, "right")}</div>
        <div className="pouf-draft__foot">
          {foot(left, "left")}
          {foot(right, "right")}
        </div>
      </section>

      {/* На узком экране пул в потоке страницы съел бы её целиком и вытолкнул слоты, поэтому он
          уезжает в `Sheet`, а кнопка видна только капитану на своём ходу. */}
      {myTurn && hasStep && (
        <div className="sticky bottom-4 z-30 lg:hidden">
          <Sheet
            open={poolOpen}
            onOpenChange={setPoolOpen}
            title={step!.action === "ban" ? "Забаньте героя" : "Возьмите героя"}
            trigger={
              <Button size="lg" className="w-full">
                Выбрать героя
              </Button>
            }
          >
            <div className="space-y-3">
              {confirm}
              {pool}
            </div>
          </Sheet>
        </div>
      )}

      {onNext && (
        <Button size="sm" onClick={onNext}>
          Следующая карта
        </Button>
      )}
    </div>
  );
}

/**
 * Подтверждение хода — второе действие: отмены после него нет (решение 4 ТЗ 22б), и герой,
 * нажатый мимо, стоил бы стороне бана. Стоит на месте статусной строки: цель нажатия и подпись
 * к нему — один столбец.
 */
function Confirm({
  hero,
  action,
  busy,
  onCommit,
  onCancel,
}: {
  hero: DraftHero | undefined;
  action: "ban" | "pick";
  busy: boolean;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card bg-surface px-4 py-3 font-pouf text-sm font-bold text-muted cushion-card">
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.img} alt="" className="h-8 w-[57px] shrink-0 rounded-[8px] object-cover" />
      )}
      <span className="min-w-0">
        <b className="text-ink">{hero?.name}</b> — {action === "ban" ? "забанить" : "взять"}? Отменить ход будет
        нельзя.
      </span>
      <span className="flex flex-wrap gap-2">
        <Button size="sm" loading={busy} onClick={onCommit}>
          {action === "ban" ? "Забанить" : "Взять"}
        </Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={onCancel}>
          Выбрать другого
        </Button>
      </span>
    </div>
  );
}
