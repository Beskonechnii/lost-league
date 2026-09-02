"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DragBoard, DragCard } from "@/components/pouf/board";
import { Button, buttonClasses } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import { Icon } from "@/components/pouf/Icon";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { Toolbar, ToolbarActions, ToolbarCount, ToolbarSearch } from "@/components/pouf/toolbar";
import { Eyebrow } from "@/components/pouf/text";
import {
  addTeam,
  currentTurn,
  draftBlocker,
  goToConfig,
  patchTeam,
  participantsBlocker,
  pickPlayer,
  lockPlayer,
  removeTeam,
  segmentPool,
  setCaptain,
  startDraft,
  stealPlayer,
  takenIds,
  teamById,
  toggleParticipant,
  type DraftState,
  type PoolPlayer,
} from "@/lib/draft";
import { ConfigControls } from "./config-controls";
import { DraftPlayerLine } from "./player-line";
import { PoolColumns } from "./pool-columns";
import { RosterSelect } from "./roster-select";
import { TeamColumn } from "./team-column";

/* Борд шоу-драфта — оболочка: состояние сессии, автосейв, перетаскивание, раскладка фаз.
 *
 * Всё состояние живёт в `DraftState` (payload сессии): после каждого действия применяем чистый
 * редьюсер из `lib/draft.ts` и автосохраняем PATCH'ем. Правила гейтят кнопки (canPick/canLock/
 * canSteal), редьюсеры на невалидном входе бросают — ошибку показываем алертом, а не роняем борд.
 *
 * Э11 (§C4 RELEASE-PLAN): файл был на 708 строк и держал в себе фазу отбора участников со своим
 * поиском, панель настройки, колонку команды, пул, карточку игрока и строку игрока. Части
 * разъехались по соседям — `roster-select`, `config-controls`, `team-column`, `pool-columns`,
 * `player-line`, — а техника перетаскивания уехала в Кит (`pouf/board.tsx`). Граница проведена
 * по состоянию: здесь остаётся то, что знает про сессию целиком.
 */

// Палитра для новых команд драфта. Сырые hex специально: цвет команды выбирает оператор эфира,
// он же горит в оверлее OBS поверх картинки игры — токен Кита там не к месту.
const PALETTE = ["#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];

const PHASE: Record<DraftState["phase"], { label: string; tone: "info" | "warn" | "ok" | "neutral" }> = {
  roster: { label: "Выбор участников", tone: "info" },
  config: { label: "Настройка команд", tone: "neutral" },
  draft: { label: "Идёт драфт", tone: "warn" },
  done: { label: "Составы собраны", tone: "ok" },
};

export function DraftBoard({
  sessionId,
  initialTitle,
  initialState,
  pool,
}: {
  sessionId: number;
  initialTitle: string | null;
  initialState: DraftState;
  pool: PoolPlayer[];
}) {
  const [state, setState] = useState<DraftState>(initialState);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  const poolById = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  // Участники: пул команд/драфта — только отобранные (старые сессии без participants → весь ростер).
  const participantSet = useMemo(
    () => (state.participants ? new Set(state.participants) : null),
    [state.participants],
  );
  const activePool = useMemo(
    () => (participantSet ? pool.filter((p) => participantSet.has(p.id)) : pool),
    [pool, participantSet],
  );
  const segments = useMemo(() => segmentPool(activePool), [activePool]);
  const taken = useMemo(() => takenIds(state), [state]);
  const cur = currentTurn(state);

  // Автосейв через очередь: PATCH'и уходят строго по одному, и в полёте всегда только последнее
  // состояние. Иначе (fetch на каждое действие независимо) поздно прилетевший ранний запрос
  // перезаписал бы финал — на быстрых кликах драфт откатывался бы к более раннему состоянию.
  const pending = useRef<DraftState | null>(null);
  const flushing = useRef(false);
  const save = useCallback(
    (next: DraftState) => {
      pending.current = next;
      if (flushing.current) return; // уже сохраняем — новое состояние подхватит текущий цикл
      flushing.current = true;
      void (async () => {
        setSaving("saving");
        try {
          while (pending.current) {
            const body = pending.current;
            pending.current = null;
            const res = await fetch(`/api/underbeer/${sessionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload: body }),
            });
            if (!res.ok) throw new Error(await res.text());
          }
          setSaving("idle");
        } catch {
          setSaving("error"); // сеть моргнула — состояние в UI цело, повторится следующим ходом
        } finally {
          flushing.current = false;
        }
      })();
    },
    [sessionId],
  );

  // применить редьюсер поверх актуального состояния; ошибку правила показать, а не уронить борд
  const run = useCallback(
    (fn: (s: DraftState) => DraftState) => {
      setState((s) => {
        try {
          setError(null);
          const next = fn(s);
          void save(next);
          return next;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          return s;
        }
      });
    },
    [save],
  );

  const saveTitle = useCallback(
    (value: string) => {
      fetch(`/api/underbeer/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      }).catch(() => {});
    },
    [sessionId],
  );

  // активная команда конфига (кому назначаем капитана нажатием) — выбранная или первая без капитана
  const activeTeam =
    (activeTeamId && teamById(state, activeTeamId)) || state.teams.find((t) => !t.captainId) || state.teams[0];

  // Нажатие по игроку пула: в конфиге — капитан активной команде, в драфте — пик текущей.
  function tapPlayer(pid: number) {
    if (taken.has(pid)) return;
    if (state.phase === "config") {
      if (!activeTeam) return setError("Сначала добавьте команду");
      run((s) => setCaptain(s, activeTeam.id, pid));
    } else if (state.phase === "draft") {
      run((s) => pickPlayer(s, pid));
    }
  }

  /** Кого несут: `pool:<id>` — из пула, `member:<teamId>:<id>` — из чужого состава (кража). */
  function draggedId(from: string): number | null {
    const parts = from.split(":");
    const raw = Number(parts[parts.length - 1]);
    return Number.isFinite(raw) ? raw : null;
  }

  function onDrop(from: string, to: string | null) {
    const pid = draggedId(from);
    if (pid == null || !to?.startsWith("team:")) return;
    const overTeamId = to.slice(5);

    if (state.phase === "config") {
      run((s) => setCaptain(s, overTeamId, pid)); // перетащили игрока в команду → её капитан
      return;
    }
    if (state.phase !== "draft") return;
    if (!cur || overTeamId !== cur.teamId) {
      setError("Сейчас ходит другая команда");
      return;
    }
    if (from.startsWith("member:")) {
      run((s) => stealPlayer(s, from.split(":")[1], pid)); // из чужого состава в свой — кража
    } else {
      run((s) => pickPlayer(s, pid));
    }
  }

  const blocker = draftBlocker(state);
  const phase = PHASE[state.phase];

  return (
    <DragBoard
      id="underbeer-draft"
      onDrop={onDrop}
      overlay={(from) => {
        const pid = draggedId(from);
        const p = pid != null ? poolById.get(pid) : null;
        return p ? <DraftPlayerLine player={p} /> : null;
      }}
    >
      {/* Полоса сессии: название, фаза, состояние сохранения, оверлей для OBS */}
      <Toolbar>
        <ToolbarSearch>
          <FormInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveTitle(title)}
            placeholder={`Драфт #${sessionId}`}
            aria-label="Название драфта"
          />
        </ToolbarSearch>
        <StatusPill tone={phase.tone}>{phase.label}</StatusPill>
        <ToolbarCount>
          {saving === "saving" ? "сохраняю…" : saving === "error" ? "ошибка сохранения" : "сохранено"}
        </ToolbarCount>
        <ToolbarActions>
          {/* Ссылкой, а не кнопкой: оверлей открывается отдельной вкладкой в OBS-сцене —
              это переход, и средний клик по нему обязан работать. */}
          <Link
            href={`/overlay/underbeer/${sessionId}`}
            target="_blank"
            className={buttonClasses({ variant: "quiet", size: "sm" })}
          >
            Оверлей для OBS
          </Link>
        </ToolbarActions>
      </Toolbar>

      {error && (
        <div className="mt-3">
          <Alert tone="err" block>
            {error}
          </Alert>
        </div>
      )}

      {state.phase === "draft" && <TurnBanner state={state} />}

      {state.phase === "roster" ? (
        <div className="mt-4">
          <RosterSelect
            pool={pool}
            selected={participantSet}
            blocker={participantsBlocker(state)}
            onToggle={(pid) => run((s) => toggleParticipant(s, pid))}
            onNext={() => run((s) => goToConfig(s))}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <section className="space-y-4">
            {state.phase === "config" && (
              <>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => run((s) => ({ ...s, phase: "roster" }))}
                  className="-ml-2"
                >
                  <Icon name="prev" size="sm" /> Изменить участников ({state.participants?.length ?? 0})
                </Button>
                <ConfigControls
                  state={state}
                  activeTeamId={activeTeam?.id ?? null}
                  blocker={blocker}
                  onAddTeam={() =>
                    run((s) => addTeam(s, `Команда ${s.teams.length + 1}`, PALETTE[s.teams.length % PALETTE.length]))
                  }
                  onTargetSize={(n) => run((s) => ({ ...s, targetSize: n }))}
                  onSnake={(v) => run((s) => ({ ...s, snake: v }))}
                  onStart={() => run((s) => startDraft(s))}
                />
              </>
            )}

            {state.phase === "done" && (
              <div className="flex flex-wrap items-center gap-3">
                <Alert tone="ok">Составы собраны — можно выводить оверлей в эфир.</Alert>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() =>
                    run((s) => ({
                      ...s,
                      phase: "config",
                      turn: 0,
                      pendingPick: null,
                      teams: s.teams.map((t) => ({ ...t, picks: [], locked: [], usedLock: false, usedSteal: false })),
                    }))
                  }
                >
                  Пересобрать заново
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {state.teams.map((team) => (
                <TeamColumn
                  key={team.id}
                  state={state}
                  team={team}
                  poolById={poolById}
                  isCurrent={cur?.teamId === team.id}
                  isActiveConfig={state.phase === "config" && activeTeam?.id === team.id}
                  onSelectActive={() => setActiveTeamId(team.id)}
                  onRemove={() => run((s) => removeTeam(s, team.id))}
                  onRename={(name) => run((s) => patchTeam(s, team.id, { name }))}
                  onLock={(pid) => run((s) => lockPlayer(s, team.id, pid))}
                  onSteal={(fromId, pid) => run((s) => stealPlayer(s, fromId, pid))}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <Eyebrow>Пул игроков</Eyebrow>
            <PoolColumns
              segments={segments}
              lane="34rem"
              badge={(seg) => seg.players.filter((p) => !taken.has(p.id)).length}
            >
              {(seg) =>
                // Взятых опускаем в низ колонки — сверху остаются доступные, глазу просторнее.
                [...seg.players]
                  .sort((a, b) => Number(taken.has(a.id)) - Number(taken.has(b.id)))
                  .map((p) => (
                    <DragCard
                      key={p.id}
                      id={`pool:${p.id}`}
                      muted={taken.has(p.id) || (state.phase === "draft" && !cur)}
                      onTap={() => tapPlayer(p.id)}
                    >
                      <DraftPlayerLine player={p} note={taken.has(p.id) ? "в составе" : null} />
                    </DragCard>
                  ))
              }
            </PoolColumns>
          </section>
        </div>
      )}
    </DragBoard>
  );
}

/** Чей сейчас ход и что от него ждут. Цвет команды — её собственный, сырым hex. */
function TurnBanner({ state }: { state: DraftState }) {
  const cur = currentTurn(state);
  const team = cur ? teamById(state, cur.teamId) : undefined;
  if (!cur || !team) return null;
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-2 rounded-card bg-surface px-4 py-3 text-sm font-bold text-ink-muted font-pouf cushion-card"
      style={{ outline: `2px solid ${team.color}`, outlineOffset: 2 }}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-pill" style={{ background: team.color }} />
      {cur.comp ? (
        <span>
          <b className="text-ink">{team.name}</b> добирает игрока после кражи — вне очереди. Выберите одного из
          пула, и очередь продолжится.
        </span>
      ) : (
        <span>
          Ход команды <b className="text-ink">{team.name}</b>: перетащите игрока из пула в состав или нажмите
          на него.
          {team.usedSteal ? null : <span className="text-muted"> · «Украсть» ещё доступно</span>}
        </span>
      )}
    </div>
  );
}
