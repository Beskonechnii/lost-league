"use client";

import { useEffect, useMemo, useState } from "react";
import type { TeamIdx } from "@/lib/fearless";
import type { LobbyBoard } from "@/lib/lobby-room";
import { CoinFlip, type DraftHero } from "@/components/pouf/draft";
import { DraftBoard } from "@/app/(public)/lobby/_components/draft-board";

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
  heroes: DraftHero[];
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

  // Ходить отсюда нельзя вовсе: права хода борду не передаём, и ни одна плитка не кликается.
  // Часы приходят с сервера — без них борд завёл бы собственный секундомер и врал бы в эфир.
  const turn = {
    startedAt: board.turn.startedAt === null ? null : board.turn.startedAt - (board.turn.now - recv),
    reserve: board.turn.reserve,
    autoFrom: board.turn.autoFrom,
  };

  return (
    <div className="min-h-screen bg-canvas p-4 font-pouf">
      {/* Монетка в эфире — та же анимация и та же серверная отметка, что в комнате: зритель
          видит бросок одновременно с капитанами, а не готовый результат (ТЗ 42г). */}
      {board.status === "coin" && board.coin && (
        <div className="mx-auto max-w-[640px]">
          <CoinFlip
            names={[board.sides[0].name, board.sides[1].name]}
            colors={[board.sides[0].color, board.sides[1].color]}
            winner={board.coin.winner}
            at={board.coin.at === null ? null : board.coin.at - (board.turn.now - recv)}
          />
        </div>
      )}
      {board.state ? (
        <DraftBoard
          state={board.state}
          heroById={heroById}
          sides={board.sides}
          captains={board.captains}
          turn={turn}
          mainSec={board.state.mainSec}
          reserveSec={board.state.reserveSec}
        />
      ) : (
        board.status !== "coin" && <Waiting board={board} />
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
