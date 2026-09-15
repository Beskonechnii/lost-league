"use client";

import { useEffect, useMemo, useState } from "react";
import type { TeamIdx } from "@/lib/fearless";
import type { LobbyBoard } from "@/lib/lobby-room";
import { FearlessRun, type LiveTurn } from "@/app/(admin)/admin/fearless-draft/_components/fearless-run";
import type { HeroRef, TeamRef } from "@/app/(admin)/admin/fearless-draft/_components/types";
import { TeamLogo } from "@/app/(public)/roster/_components/avatar";

/**
 * Борд комнаты для сцены OBS (ТЗ 22в §4): весь драфт и ничего больше — ни чата, ни состава
 * комнаты, ни кнопок.
 *
 * Живость — опросом раз в 1.5 с, по прецеденту `overlay/underbeer`: живой канал требует куки, а у
 * браузерного источника OBS её нет, и третьего механизма рядом с `presence.ts` заводить нельзя
 * (§8). Одна вкладка на эфир — цена опроса здесь меньше, чем в комнате с десятком участников.
 *
 * Кожа СВЕТЛАЯ и продуктовая (решение 10) — тот же борд, что видят капитаны. Отсюда и непрозрачный
 * фон: группа `(bare)` гасит фон страницы до прозрачного ради оверлея составов, который лежит
 * ПОВЕРХ кадра игры, а этот вид кадром и является — на прозрачном светлый борд был бы нечитаем.
 * Поэтому подложку красим здесь, а правило группы не трогаем.
 */
export function ObsBoard({
  obsKey,
  initial,
  heroes,
}: {
  obsKey: string;
  initial: LobbyBoard;
  heroes: HeroRef[];
}) {
  // Снимок вместе с моментом получения — как в комнате: часы считает сервер, и разницу с часами
  // машины, на которой стоит OBS, надо снять один раз на снимок.
  const [{ board, recv }, setSnap] = useState(() => ({ board: initial, recv: Date.now() }));

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/lobby/obs/${obsKey}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as LobbyBoard;
        if (alive) setSnap({ board: next, recv: Date.now() });
      } catch {
        // сеть моргнула — на экране остаётся последний снимок, следующий тик подхватит
      }
    };
    const timer = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [obsKey]);

  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const teamRefs: TeamRef[] = useMemo(
    () =>
      board.sides.map((s, i) => ({
        id: s.teamId,
        name: s.name,
        color: s.color,
        logo: s.logo,
        captain: board.captains[i] ? { ...board.captains[i]!, mmr: null } : null,
      })),
    [board],
  );

  // Ходить отсюда нельзя вовсе: `myTurn` всегда false, `onNext` всегда null. Объект `live` нужен
  // ради ОДНОГО — часов сервера: без него борд завёл бы собственный секундомер и врал бы в эфир.
  const live: LiveTurn = {
    clock: {
      startedAt: board.turn.startedAt === null ? null : board.turn.startedAt - (board.turn.now - recv),
      reserve: board.turn.reserve,
    },
    myTurn: false,
    busy: false,
    onPick: () => {},
    onNext: null,
    autoFrom: board.turn.autoFrom,
  };

  return (
    <div className="min-h-screen bg-canvas p-4 font-pouf">
      {board.state ? (
        <FearlessRun
          state={board.state}
          setState={() => {}}
          heroById={heroById}
          teams={teamRefs}
          readOnly
          pinCurrent
          live={live}
        />
      ) : (
        <Waiting board={board} />
      )}
    </div>
  );
}

/**
 * До монетки драфта ещё нет — показывать нечего, кроме того, кто с кем играет. Пустой экран в
 * эфире читается как «трансляция сломалась», поэтому заглушка именованная: видно, что сцена жива
 * и чего она ждёт.
 */
function Waiting({ board }: { board: LobbyBoard }) {
  const label = board.status === "coin" ? "Монетка: стороны выбирают сторону и очередь" : "Команды собираются в комнате";
  return (
    <div className="grid min-h-[calc(100vh-2rem)] place-items-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-6">
          {([0, 1] as TeamIdx[]).map((i) => (
            <div key={i} className="flex items-center gap-3">
              {i === 1 && <span className="text-2xl font-black text-muted">—</span>}
              <TeamLogo team={{ name: board.sides[i].name, logo: board.sides[i].logo }} size={64} />
              <span className="text-3xl font-black text-ink">{board.sides[i].name}</span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-lg font-black text-muted">
          {label} · Bo{board.bestOf}
        </p>
      </div>
    </div>
  );
}
