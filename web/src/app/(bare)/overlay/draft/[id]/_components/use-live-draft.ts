"use client";

import { useEffect, useRef, useState } from "react";
import { lastMovedPlayer, type DraftState } from "@/lib/draft";

/**
 * Живой снимок сессии для эфирной сцены: опрос раз в ~1.5с. OBS держит сцену открытой всё
 * эфирное время, поэтому опрос дешевле сокета и не требует отдельного канала — сервер отдаёт
 * готовый payload, пул резолвится на клиенте по id.
 *
 * `lastPickId` — не поле payload (формат не меняем), а разница между соседними тиками: `prevRef`
 * держит срез с прошлого тика, первый тик сравнивать не с чем.
 *
 * Отдельным файлом, а не внутри вида: сцен две — UNDERBEER (`overlay-live.tsx`) и Mix Cup
 * (`overlay-mixcup.tsx`), — а опрос у них один и тот же.
 */
export function useLiveDraft(sessionId: number, initialState: DraftState) {
  const [state, setState] = useState<DraftState>(initialState);
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

  return { state, lastPickId };
}
