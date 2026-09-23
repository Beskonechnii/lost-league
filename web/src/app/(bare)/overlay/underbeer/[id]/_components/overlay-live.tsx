"use client";

import { useEffect, useRef, useState } from "react";
import { currentTurn, lastMovedPlayer, memberIds, type DraftState, type PoolPlayer } from "@/lib/draft";
import { DraftPlayerLine } from "@/app/(admin)/underbeer/[id]/_components/player-line";
import { StatusPill } from "@/components/pouf/feedback";
import { Icon } from "@/components/pouf/Icon";
import { PartnerMark } from "@/components/pouf/media";
import { Card } from "@/components/pouf/surface";
import { OVERLAY_DARK_SKIN } from "./skin";

// Живой оверлей: опрашивает сессию раз в ~1.5с и перерисовывает составы, пока идёт драфт.
// OBS держит сцену открытой всё эфирное время, поэтому опрос дешевле любого сокета и не требует
// отдельного канала — сервер отдаёт готовый payload, пул резолвим на клиенте по id.
//
// Кожа — Light Clay по умолчанию (ТЗ 35). Карточка НЕПРОЗРАЧНА (бумага Кита
// `bg-surface`+`cushion-card`): она перекрывает игру под собой полностью, полупрозрачность ей
// не нужна.
//
// ФОН СОБЫТИЯ (23.09.2026, решение Стаса): у события с партнёром под карточки ложится его
// картинка. Это отменяет прозрачность страницы для таких событий — оверлей перестаёт быть
// накладкой поверх игры и становится самостоятельной сценой OBS. У обычного UNDERBEER фона нет,
// прозрачность сохраняется как была (правило группы `(bare)`).
//
// ТЁМНАЯ КОЖА (23.09.2026, решение Стаса — отменяет 15.09.2026 «тёмной эфирной кожи не делаем
// нигде»): на тёмной картинке события светлая бумага Кита читается наклейкой. `OVERLAY_DARK_SKIN`
// (см. `skin.ts`) вешается на ту же рамку, что и картинка, и ТОЛЬКО когда она есть — у обычного
// UNDERBEER кожи по-прежнему нет, вёрстка остаётся светлой и прозрачной без единой правки.

export function OverlayLive({
  sessionId,
  initialState,
  pool,
  showMmr,
  partner,
}: {
  sessionId: number;
  initialState: DraftState;
  pool: PoolPlayer[];
  /** Показывает ли лига MMR. Числа в пуле уже сняты на сервере, но без флага «Σ MMR 0» и пустая
   *  подпись «MMR» остались бы в эфире: подпись уходит вместе со значением. */
  showMmr: boolean;
  /** Партнёр-организатор (Mix Cup by Eclipse, ТЗ 33) — не передан у обычного UNDERBEER.
   *  `background` — картинка под карточки; пока её нет, фон страницы остаётся прозрачным. */
  partner?: { name: string; src: string | null; background?: string | null };
}) {
  const [state, setState] = useState<DraftState>(initialState);
  // «Последний взятый» — не поле payload (ТЗ 35 не меняет формат), а разница между соседними
  // тиками опроса: `prevRef` держит срез с прошлого тика, первый тик сравнивать не с чем.
  const prevRef = useRef<DraftState | null>(null);
  const [lastPickId, setLastPickId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/underbeer/${sessionId}`, { cache: "no-store" });
        if (!res.ok) return;
        const session = (await res.json()) as { payload: string };
        const next = JSON.parse(session.payload) as DraftState;
        if (!alive) return;
        const moved = lastMovedPlayer(prevRef.current, next);
        if (next.phase === "draft" && moved != null) setLastPickId(moved);
        else if (next.phase !== "draft") setLastPickId(null);
        prevRef.current = next;
        setState(next);
      } catch {
        // сеть моргнула — оставляем последнее состояние, следующий тик подхватит
      }
    };
    const timer = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [sessionId]);

  const byId = new Map(pool.map((p) => [p.id, p]));
  const cur = currentTurn(state);
  // Драфт не идёт и не завершён — сцена открыта раньше эфира (OBS держит её загруженной заранее).
  const notStarted = state.phase !== "draft" && state.phase !== "done";

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat p-6 font-pouf"
      style={
        partner?.background
          ? { backgroundImage: `url(${partner.background})`, ...OVERLAY_DARK_SKIN }
          : undefined
      }
    >
      {notStarted ? (
        <div className="grid min-h-[calc(100vh-3rem)] place-items-center">
          <div className="rounded-card bg-surface px-8 py-6 text-center cushion-card">
            <p className="text-lg font-black text-ink">Драфт ещё не начался</p>
          </div>
        </div>
      ) : (
        <div
          className="mx-auto grid gap-4"
          style={{
            // auto-fit + минимум 240px: команды переносятся на новую строку, а не схлопываются
            // в нечитаемо-узкие колонки при большом их числе. Ширину контейнера ограничиваем по
            // числу команд, чтобы 2–3 команды не растягивались на весь экран.
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            maxWidth: `min(100%, ${Math.max(1, state.teams.length) * 340}px)`,
          }}
        >
          {state.teams.map((team) => {
            const members = memberIds(team)
              .map((pid) => byId.get(pid))
              .filter((p): p is PoolPlayer => !!p);
            const mmrSum = members.reduce((s, p) => s + (p.mmr ?? 0), 0);
            const isCurrent = cur?.teamId === team.id;
            return (
              <Card key={team.id} variant="flush">
                <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ background: `${team.color}22` }}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-pill" style={{ background: team.color }} />
                    <span className="min-w-0 truncate text-lg font-black text-ink">{team.name}</span>
                    {/* Название команды, чей сейчас ход — текстовая пилюля, а не только цветная
                        обводка карточки: зритель на стрим-захвате низкого битрейта её не различит. */}
                    {isCurrent && <StatusPill tone="warn">Ходит</StatusPill>}
                  </div>
                  {showMmr && (
                    <span className="shrink-0 text-xs font-bold text-muted">Σ MMR {mmrSum.toLocaleString("ru-RU")}</span>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  {members.map((p) => {
                    const isLastPick = lastPickId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-control bg-surface-2 p-1 cushion-field ${
                          // Тонкая рамка последнего взятого — тот же приём, что на борде (ТЗ 35
                          // п.4): другая толщина (1px), чем обводка хода команды.
                          isLastPick ? "outline outline-1 outline-offset-1 outline-[color:var(--accent-fill)]" : ""
                        }`}
                      >
                        <DraftPlayerLine player={p} hideValue={!showMmr} />
                        {(team.captainId === p.id || team.locked.includes(p.id)) && (
                          <div className="flex items-center gap-1.5 px-2 pb-1">
                            {team.captainId === p.id && (
                              <span className="rounded-pill bg-accent-fill px-1.5 py-0.5 text-[9px] font-black text-[var(--on-accent)]">
                                КАП
                              </span>
                            )}
                            {team.locked.includes(p.id) && (
                              <span title="Закреплён" className="text-muted">
                                <Icon name="lock" size="sm" label="Закреплён" />
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Знак организатора — фиксированный угол, вне грида команд: сетка центрирована по ширине
          экрана и по числу команд (2–8), угол гарантированно свободен при любом их числе (ТЗ 35
          п.7). 48px поля с каждой стороны на 1920×1080 — запас внутри вещательной safe area. */}
      {partner && (
        <div className="fixed bottom-12 right-12 flex flex-col items-center gap-1.5 rounded-card bg-surface px-4 py-3 cushion-card">
          <PartnerMark src={partner.src} name={partner.name} size="md" />
          <span className="text-[11px] font-bold text-muted">Организатор</span>
        </div>
      )}
    </div>
  );
}
