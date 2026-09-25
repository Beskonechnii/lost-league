"use client";

import { currentTurn, memberIds, type DraftState, type PoolPlayer } from "@/lib/draft";
import { DraftPlayerLine } from "@/app/(admin)/underbeer/[id]/_components/player-line";
import { StatusPill } from "@/components/pouf/feedback";
import { Icon } from "@/components/pouf/Icon";
import { Card } from "@/components/pouf/surface";
import { useLiveDraft } from "./use-live-draft";

// Живой оверлей UNDERBEER: опрос сессии (`useLiveDraft`) и составы команд поверх игры.
//
// Кожа — Light Clay по умолчанию (ТЗ 35). Карточка НЕПРОЗРАЧНА (бумага Кита
// `bg-surface`+`cushion-card`): она перекрывает игру под собой полностью, полупрозрачность ей
// не нужна. Страница прозрачна — это накладка на игру, а не самостоятельная сцена.
//
// Сцена Mix Cup — соседний файл `overlay-mixcup.tsx` (ТЗ 44): у неё своя раскладка (8 команд,
// пул, полоса знаков), тёмная кожа и фон события. Разводит их `page.tsx` по `tournament.kind`,
// чтобы правка эфира Mix Cup не утаскивала за собой вид чужого инструмента.

export function OverlayLive({
  sessionId,
  initialState,
  pool,
  showMmr,
}: {
  sessionId: number;
  initialState: DraftState;
  pool: PoolPlayer[];
  /** Показывает ли лига MMR. Числа в пуле уже сняты на сервере, но без флага «Σ MMR 0» и пустая
   *  подпись «MMR» остались бы в эфире: подпись уходит вместе со значением. */
  showMmr: boolean;
}) {
  const { state, lastPickId } = useLiveDraft(sessionId, initialState);

  const byId = new Map(pool.map((p) => [p.id, p]));
  const cur = currentTurn(state);
  // Драфт не идёт и не завершён — сцена открыта раньше эфира (OBS держит её загруженной заранее).
  const notStarted = state.phase !== "draft" && state.phase !== "done";

  return (
    <div className="min-h-screen p-6 font-pouf">
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
                        <DraftPlayerLine player={p} hideValue={!showMmr} roleWords />
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
    </div>
  );
}
