"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { Alert } from "@/components/pouf/feedback";
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
  type TeamIdx,
} from "@/lib/fearless";
import { HeroPool } from "./hero-pool";
import { MapTrack } from "./map-track";
import { TeamColumn } from "./sequence";
import { fmtTime, type HeroRef, type TeamRef } from "./types";

/**
 * Сам драфт одним экраном: панель «Карта» (дорожка серии, часы, управление) и борд тремя
 * колонками — сторона · пул · сторона.
 *
 * Отделён от оболочки (`fearless-board.tsx`) по той же границе, что серии на Э9 и шоу-драфт на
 * Э11a: там — состояние сессии и автосейв, здесь — ход карты и его таймеры. Таймеры сознательно
 * живут ТОЛЬКО здесь и не едут в payload: они идут в реальном времени у оператора, а сохранять
 * в базу четыре раза в секунду нечего.
 *
 * Три колонки включаются с `xl`, а не с `lg`: на 1024 полезных 976, минус две колонки по 256 и
 * два зазора — центру осталось бы 464, то есть трек пула упал бы до ~45px при полу в 50px
 * (`hero-pool.tsx`). Ниже `xl` — вертикальный стек, и пул в нём идёт РАНЬШЕ колонок: по нему
 * нажимают каждый ход, и проматывать до него два десятка строк расписания пришлось бы двадцать
 * раз за карту.
 */

/**
 * Одно определение треков на оба ряда экрана — часы и борд. Банк доп-времени обязан стоять ровно
 * над колонкой своей команды, и совпадение краёв должно быть конструктивным, а не подобранным
 * отступами: поэтому ряд часов — ТРИ подушки в этих же треках, а не одна подушка на три ячейки.
 * Ниже `xl` треков нет (борд — стек), и совпадать там нечему.
 */
const TRACKS = "xl:grid-cols-[16rem_minmax(0,1fr)_16rem]";

/**
 * Комната встречи (ТЗ 22б): борд тот же, но часы приходят с сервера, ход вносит капитан своей
 * стороны, а карту переводит админ комнаты. На админском борде этого объекта нет вовсе — и там
 * всё остаётся как было: локальные часы, отмена хода, приём состояния целиком.
 */
export type LiveTurn = {
  /** Часы сервера, уже пересчитанные в часы этой вкладки. `startedAt = null` — ход не идёт. */
  clock: { startedAt: number | null; reserve: [number, number] };
  /** Сейчас мой ход: только тогда пул вообще кликается. */
  myTurn: boolean;
  busy: boolean;
  /** Подтверждённый ход наружу — сервер сам решит, законен ли он, и сам применит. */
  onPick: (heroId: number) => void;
  /** Следующая карта — только у админа комнаты; капитану сюда приезжает null. */
  onNext: (() => void) | null;
  /** С какого хода карты пошли автоходы; null — последний ход сделан руками. */
  autoFrom: number | null;
};

export function FearlessRun({
  state,
  setState,
  heroById,
  teams,
  onReset,
  readOnly = false,
  live,
}: {
  state: FearlessState;
  setState: (s: FearlessState) => void;
  heroById: Map<number, HeroRef>;
  /** Команды лиги — за лого и капитаном. */
  teams: TeamRef[];
  onReset?: () => void;
  /** Только смотрим: ходов не вносим и картой не управляем. Так борд открыт участникам лобби
   *  (ТЗ 22а); право хода приезжает капитану отдельно, через `live`. */
  readOnly?: boolean;
  live?: LiveTurn;
}) {
  // Движок хранит у команды только имя и цвет (`FearlessTeam`), id в payload не попадает —
  // поэтому карточка команды ищется по имени. Не нашлась (команду переименовали после старта
  // драфта) — колонка рисуется без лого и с подписью «капитан не назначен», экран цел.
  const refByName = useMemo(() => new Map(teams.map((t) => [t.name, t])), [teams]);

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

  // Какую карту серии экран ПОКАЗЫВАЕТ. Локальное состояние просмотра: в payload не уходит,
  // PATCH не шлёт и в адрес не пишется — экран за правом «tools» (ссылка ничего не воспроизведёт
  // у того, у кого права нет), просмотр живёт секунды, а query-параметр на каждом клике насыпал
  // бы историю браузера, и «назад» посреди эфира уводил бы оператора по прошлым картам.
  const [viewing, setViewing] = useState(state.current);
  const past = viewing !== state.current;
  const shown = past ? viewing : state.current;
  // Сторона на экране считается ОДИН раз, и всё, у чего сторона есть — колонка, банк часов,
  // подпись «первый пик» — адресуется через `left`/`right`. Литералов `state.teams[0]`/`[1]`
  // в разметке нет намеренно: первый пик чередуется по картам, и прибитый к индексу банк часов
  // на чётной карте вставал над чужой колонкой.
  const left = firstPickOf(state, shown); // слева тот, кто ходит первым на показанной карте
  const right = (1 - left) as TeamIdx;

  // Таймеры: банк доп-времени на команду; секундомер хода — в состоянии (ref в рендере читать нельзя).
  const current = state.current;
  const movesCount = state.games[current]?.moves.length ?? 0;
  const hasStep = step !== null;
  // Банк адресуется ИНДЕКСОМ КОМАНДЫ, а не стороной экрана: сторона на новой карте меняется, и
  // переложи мы сам массив — команды обменялись бы накопленным доп-временем.
  const [localReserve, setReserve] = useState<[number, number]>([state.reserveSec, state.reserveSec]);
  const [now, setNow] = useState(() => Date.now());
  const [localTurnStart, setTurnStart] = useState(() => Date.now());
  // В комнате часы считает СЕРВЕР и присылает снимком: обе вкладки капитанов могут быть закрыты,
  // а время всё равно обязано идти. Ниже по коду разницы нет — обе ветки дают те же два числа.
  const reserve = live ? live.clock.reserve : localReserve;
  const turnStart = live ? (live.clock.startedAt ?? now) : localTurnStart;

  // «Выбрал, но не отправил» (решение 4: отмены нет, подтверждает второе действие). Номер хода
  // лежит в самой отметке — поэтому сбрасывать выбор эффектом не нужно: приехал чужой ход,
  // номер разошёлся, выбор погас сам.
  const [chosen, setChosen] = useState<{ heroId: number; at: number } | null>(null);

  // Секундомер хода сбрасываем в обработчиках хода (не в эффекте — линтер запрещает setState в эффекте).
  const resetTurn = () => {
    setTurnStart(Date.now());
    setNow(Date.now());
    setViewing(current); // любое действие хода возвращает экран на живую карту
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

  // Выбор героя в пуле. В комнате он ещё не ход: ход уходит вторым действием — подтверждением.
  const pending = live?.myTurn && chosen?.at === movesCount ? chosen.heroId : null;

  // Ходы, которые сервер сделал сам — время вышло. Живут на экране до следующего хода.
  const autoMoves =
    live && live.autoFrom !== null ? (state.games[current]?.moves ?? []).slice(live.autoFrom) : [];

  // Применить ход: списать переработку из банка активной команды и обнулить секундомер
  const commit = (heroId: number) => {
    if (live) {
      live.onPick(heroId); // в комнате ход считает сервер: вкладка состояние драфта не трогает
      return;
    }
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
  const choose = (heroId: number) => (live ? setChosen({ heroId, at: movesCount }) : commit(heroId));
  const doUndo = () => {
    setState(undo(state));
    resetTurn();
  };
  const doNext = () => {
    const advanced = nextGame(state);
    setState({ ...advanced, pool: rerollPool(advanced) }); // новый пул без сыгранных героев
    setReserve([state.reserveSec, state.reserveSec]);
    setTurnStart(Date.now());
    setNow(Date.now());
    setViewing(advanced.current);
  };

  const column = (team: TeamIdx, side: "left" | "right") => (
    <TeamColumn
      state={state}
      gameIdx={shown}
      team={team}
      teamRef={refByName.get(state.teams[team].name)}
      heroById={heroById}
      side={side}
      past={past}
    />
  );

  return (
    <div className="space-y-4">
      {/* Одна панель на всё про текущую карту: дорожка серии, часы и управление. Три отдельные
          панели подряд — это ~200px до первых данных, ровно тот антипаттерн, что §9 уже вычистил
          из ростера. Дорожка стоит НАД часами: она отвечает «что я вижу», часы — «сколько
          осталось у живого хода», и контекст всегда выше того, что от него зависит. */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MapTrack bestOf={state.bestOf} current={state.current} viewing={viewing} onView={setViewing} />
          <span className="min-w-0 text-sm font-bold text-muted">
            свет: <b className="text-ink">{state.teams[radiantOf(state, shown)].name}</b> · первый пик:{" "}
            <b className="text-ink">{state.teams[left].name}</b>
          </span>
          {/* Управление картой — только у того, кто ведёт драфт. В режиме просмотра его нет
              вовсе: отмена хода, переход на карту и сброс меняют чужой драфт. */}
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Глядя на прошлую карту управление выключено: эти кнопки относятся к живой. */}
              <Button variant="quiet" size="sm" onClick={doUndo} disabled={past || movesCount === 0}>
                <Icon name="prev" size="sm" /> Отменить
              </Button>
              {canNextGame(state) && (
                <Button size="sm" onClick={doNext} disabled={past}>
                  Следующая карта <Icon name="next" size="sm" />
                </Button>
              )}
              {onReset && (
                <Button variant="quiet" tone="down" size="sm" onClick={onReset}>
                  Сбросить
                </Button>
              )}
            </div>
          )}
          {/* В комнате из управления есть ровно одна кнопка и ровно у одного человека — админа
              комнаты: когда карта сыграна, знает он, а не лобби. Отмены и сброса нет ни у кого. */}
          {live?.onNext && canNextGame(state) && (
            <Button size="sm" onClick={live.onNext} disabled={past}>
              Следующая карта <Icon name="next" size="sm" />
            </Button>
          )}
        </div>
      </Panel>

      {/* Ряд часов — три подушки в треках борда: банк стоит над колонкой СВОЕЙ стороны, показание
          хода — над пулом. Эфирное табло, где сторона читается столбцом, а не по подписи.
          Дорожка карт и управление стороны не имеют и остаются панелью «Карта» на всю ширину. */}
      <div className={`grid grid-cols-3 items-stretch gap-3 xl:gap-4 ${TRACKS}`}>
        <Panel>
          <ReserveTimer
            team={state.teams[left]}
            value={reserve[left] - (active === left ? overage : 0)}
            active={active === left}
          />
        </Panel>
        <Panel>
          <div className="text-center">
            <div className={`text-3xl font-black tabular-nums ${mainLeft < 0 ? "text-err-ink" : "text-ink"}`}>
              {step ? fmtTime(mainLeft < 0 ? activeReserveLeft : mainLeft) : "0:00"}
            </div>
            {/* Часы идут и в режиме просмотра: они про живой ход, гасить их посреди чужого хода
                нельзя. Чтобы показание не отнесли к просматриваемой карте — номер в подписи. */}
            <div className="text-[11px] font-black uppercase tracking-[1px] text-muted">
              {step ? (mainLeft < 0 ? "доп-время" : "ход") : "карта задрафчена"}
              {past && ` · карта ${state.current + 1}`}
            </div>
          </div>
        </Panel>
        <Panel>
          <ReserveTimer
            team={state.teams[right]}
            value={reserve[right] - (active === right ? overage : 0)}
            active={active === right}
            right
          />
        </Panel>
      </div>

      <div className={`grid items-start gap-4 ${TRACKS}`}>
        {/* Порядок чтения хода: статусная строка → пул под ней → загоревшийся слот в колонке.
            Поэтому строка живёт в центральной колонке над пулом, а не в панели «Карта»: цель
            нажатия и подпись к нему обязаны быть в одном столбце. */}
        <div className="space-y-4 max-xl:order-1 xl:order-2">
          {past ? (
            <>
              <Alert tone="info" block>
                Смотрим карту {viewing + 1}. Драфт идёт на карте {state.current + 1} — пул и ходы
                показаны только у неё.
              </Alert>
              <Button variant="quiet" size="sm" onClick={() => setViewing(state.current)}>
                Вернуться на карту {state.current + 1}
              </Button>
            </>
          ) : (
            <>
              {/* «Время вышло — сходили за тебя». В состоянии драфта такой пометки нет (ходы, а
                  не их история), поэтому она живёт снимком комнаты и держится ровно до
                  следующего хода — дальше объяснять уже нечего. */}
              {autoMoves.length > 0 && (
                <Alert tone="warn" block>
                  Время вышло — ход сделан автоматически:{" "}
                  <b>
                    {autoMoves
                      .map((m) => `${heroById.get(m.heroId)?.name ?? "герой"} (${m.action === "ban" ? "бан" : "пик"})`)
                      .join(", ")}
                  </b>
                  .
                </Alert>
              )}
              {/* Подтверждение — второе действие, и отмены после него нет (решение 4). Стоит на
                  месте статусной строки: цель нажатия и подпись к нему — один столбец. */}
              {step && pending !== null && live ? (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-card bg-surface px-4 py-3 font-pouf text-sm font-bold text-muted cushion-card"
                  style={{ outline: `2px solid ${state.teams[active ?? 0].color}`, outlineOffset: 2 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroById.get(pending)?.img}
                    alt=""
                    className="h-8 w-[57px] shrink-0 rounded-[8px] object-cover"
                  />
                  <span className="min-w-0">
                    <b className="text-ink">{heroById.get(pending)?.name}</b> —{" "}
                    {step.action === "ban" ? "забанить" : "взять"}? Отменить ход будет нельзя.
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Button size="sm" loading={live.busy} onClick={() => live.onPick(pending)}>
                      {step.action === "ban" ? "Забанить" : "Взять"}
                    </Button>
                    <Button size="sm" variant="quiet" disabled={live.busy} onClick={() => setChosen(null)}>
                      Выбрать другого
                    </Button>
                  </span>
                </div>
              ) : /* Цвет команды сырым hex — тот же, что горит в трансляции (§C5). */
              step && active !== null ? (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-card bg-surface px-4 py-3 font-pouf text-sm font-bold text-muted cushion-card"
                  style={{ outline: `2px solid ${state.teams[active].color}`, outlineOffset: 2 }}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-pill"
                    style={{ background: state.teams[active].color }}
                  />
                  {live?.myTurn ? (
                    <span>
                      <b className="text-ink">Ваш ход</b> — {step.action === "ban" ? "забаньте" : "возьмите"} героя
                      в пуле.
                    </span>
                  ) : (
                    <span>
                      Ход команды <b className="text-ink">{state.teams[active].name}</b> —{" "}
                      {step.action === "ban" ? "банит" : "пикает"}.
                      {!readOnly && " Нажмите на героя в пуле."}
                    </span>
                  )}
                </div>
              ) : (
                <Alert tone="ok" block>
                  Карта задрафчена.{" "}
                  {!canNextGame(state)
                    ? "Серия отдрафчена целиком."
                    : live && !live.onNext
                      ? "Следующую карту откроет админ комнаты."
                      : "Жмите «Следующая карта» — пул соберётся заново, без уже взятых героев."}
                </Alert>
              )}
              {/* Право нажатия снимается АДРЕСНО: в комнате пул кликается только у капитана
                  стороны, чей сейчас ход. У соперника, тренера, ОБС и админа — просмотр. */}
              <HeroPool
                state={state}
                heroById={heroById}
                locked={locked}
                onPick={choose}
                disabled={!step}
                readOnly={live ? !live.myTurn : readOnly}
                chosen={pending}
              />
            </>
          )}
        </div>
        <div className="max-xl:order-2 xl:order-1">{column(left, "left")}</div>
        <div className="order-3">{column(right, "right")}</div>
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
