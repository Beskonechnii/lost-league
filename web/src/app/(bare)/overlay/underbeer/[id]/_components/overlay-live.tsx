"use client";

import { useEffect, useState } from "react";
import { currentTurn, memberIds, type DraftState, type PoolPlayer } from "@/lib/draft";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";

// Живой оверлей: опрашивает сессию раз в ~1.5с и перерисовывает составы, пока идёт драфт.
// OBS держит сцену открытой всё эфирное время, поэтому опрос дешевле любого сокета и не требует
// отдельного канала — сервер отдаёт готовый payload, пул резолвим на клиенте по id.
//
// Единственный экран проекта, который НЕ переезжает на Light Clay (Э11): это не страница, а слой
// поверх картинки игры в OBS-сцене. Тёмные полупрозрачные карточки читаются на любом кадре, а
// светлые — нет. Поэтому здесь свои цвета и `text-white`: токены Кита рассчитаны на бумагу.
// После Э3 (`--ink` стал тёмным) оверлей унаследовал тёмный текст на тёмной карточке и в эфире
// был нечитаем — цвета проставлены явно, чтобы это не повторилось при следующей смене палитры.

export function OverlayLive({
  sessionId,
  initialState,
  pool,
}: {
  sessionId: number;
  initialState: DraftState;
  pool: PoolPlayer[];
}) {
  const [state, setState] = useState<DraftState>(initialState);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/underbeer/${sessionId}`, { cache: "no-store" });
        if (!res.ok) return;
        const session = (await res.json()) as { payload: string };
        const next = JSON.parse(session.payload) as DraftState;
        if (alive) setState(next);
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

  return (
    <div className="min-h-screen p-6 text-white">
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
            <div
              key={team.id}
              className={`overflow-hidden rounded-2xl border bg-neutral-950/85 backdrop-blur transition-[box-shadow] ${
                isCurrent ? "ring-2 ring-amber-400" : ""
              }`}
              style={{ borderColor: isCurrent ? "#fbbf24" : `${team.color}88` }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ background: `${team.color}22` }}>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: team.color }} />
                  <span className="text-lg font-bold">{team.name}</span>
                </div>
                <span className="text-xs text-white/60">Σ MMR {mmrSum.toLocaleString("ru-RU")}</span>
              </div>
              <div className="space-y-2 p-3">
                {members.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl bg-neutral-900/70 p-2">
                    <PlayerAvatar photo={p.photo} nickname={p.nickname} color={team.color} size={44} className="!rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{p.nickname}</span>
                        {team.captainId === p.id && (
                          <span className="rounded bg-amber-400/25 px-1 text-[10px] font-bold text-amber-200">КАП</span>
                        )}
                        {team.locked.includes(p.id) && <span title="Закреплён">🔒</span>}
                      </div>
                      {p.realName && <div className="truncate text-xs text-white/55">{p.realName}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium">{p.mmr ? p.mmr.toLocaleString("ru-RU") : "—"}</div>
                      <div className="text-[10px] text-white/45">MMR</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
