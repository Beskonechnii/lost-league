"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveEvent } from "@/lib/chat-events";

// Клиентский конец живого канала: одно SSE-соединение на вкладку, из него и присутствие, и новые
// сообщения. Провайдер стоит в хроме (app-shell), то есть открыт на любой странице, — поэтому
// точка «в сети» у карточки игрока и счётчик в колонке работают везде, а не только в чате.
//
// Гость соединение не открывает: канал закрыт для не-игроков, и EventSource без конца долбился бы
// в 401. Ему достаётся снимок присутствия, снятый на сервере при рендере страницы, — цифра
// правдива на момент открытия и не притворяется живой.

type LiveState = {
  /** Игроки, кто сейчас в сети. */
  players: Set<number>;
  /** Сколько человек на сайте — считаются люди, а не вкладки. */
  count: number;
  /** Подписка на события беседы; возвращает отписку. */
  subscribe: (fn: (event: LiveEvent) => void) => () => void;
};

const LiveContext = createContext<LiveState>({ players: new Set(), count: 0, subscribe: () => () => {} });

export function ChatLiveProvider({
  live,
  initialPlayers,
  initialCount,
  children,
}: {
  /** Открывать ли канал: только для игрока лиги, у гостя его нет. */
  live: boolean;
  initialPlayers: number[];
  initialCount: number;
  children: React.ReactNode;
}) {
  const [players, setPlayers] = useState<Set<number>>(() => new Set(initialPlayers));
  const [count, setCount] = useState(initialCount);
  const listeners = useRef(new Set<(event: LiveEvent) => void>());
  const router = useRouter();

  const subscribe = useCallback((fn: (event: LiveEvent) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    const source = new EventSource("/api/chat/stream");

    source.onmessage = (e) => {
      const event = JSON.parse(e.data) as LiveEvent;
      if (event.type === "presence") {
        setPlayers(new Set(event.players));
        setCount(event.count);
        return;
      }
      if (event.type === "ping") return;

      listeners.current.forEach((fn) => fn(event));

      // Список бесед и счётчик непрочитанного рисует сервер — обновляем его тем же способом,
      // что и после отправки формы. Открытая беседа дорисовывает сообщение сама, по подписке:
      // ждать круга до сервера ради своей же реплики незачем.
      if (event.type === "message") router.refresh();
    };

    // Разрыв EventSource чинит сам (retry), но пока его не было — данные могли уйти вперёд.
    source.onerror = () => router.refresh();

    return () => source.close();
  }, [live, router]);

  const value = useMemo(() => ({ players, count, subscribe }), [players, count, subscribe]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);

/**
 * Подписка на события беседы. Обработчик держим в ref и обновляем эффектом: он замыкает состояние
 * страницы и меняется на каждый рендер, а переподписываться на каждый рендер — терять события
 * в промежутке между отпиской и подпиской.
 */
export function useChatEvents(handler: (event: LiveEvent) => void) {
  const { subscribe } = useLive();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => subscribe((event) => ref.current(event)), [subscribe]);
}

/**
 * Точка «в сети» у игрока. Ничего не рисует, если человека нет в онлайне: серая точка «оффлайн»
 * у каждого из сотни карточек — шум, а не факт.
 */
export function OnlineDot({ playerId, className = "" }: { playerId: number; className?: string }) {
  const { players } = useLive();
  if (!players.has(playerId)) return null;
  return (
    <span
      title="В сети"
      aria-label="В сети"
      className={`inline-block h-[9px] w-[9px] shrink-0 rounded-pill bg-[var(--up)] [box-shadow:0_0_0_2px_var(--surface)] ${className}`}
    />
  );
}

/** Строка «N в сети» в колонке навигации. */
export function OnlineCount() {
  const { count } = useLive();
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-extrabold text-muted">
      <span className="h-[9px] w-[9px] rounded-pill bg-[var(--up)]" aria-hidden />
      <span>
        {count} <span className="text-ink-subtle">в сети</span>
      </span>
    </div>
  );
}
