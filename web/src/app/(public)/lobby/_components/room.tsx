"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { SectionHeader } from "@/components/pouf/blocks";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { Card } from "@/components/pouf/surface";
import { Eyebrow } from "@/components/pouf/text";
import { useChatEvents, useLive } from "@/app/_components/chat-live";
import type { TeamIdx } from "@/lib/fearless";
import {
  ROLE_LABEL,
  captainOf,
  meIn,
  sideBlocker,
  sidePlayers,
  sideReady,
  type LobbyMemberView,
  type LobbyRoom,
} from "@/lib/lobby-room";
import { PlayerAvatar, TeamLogo } from "../../roster/_components/avatar";
import { FearlessRun } from "../../../(admin)/admin/fearless-draft/_components/fearless-run";
import { fmtTime, type HeroRef, type TeamRef } from "../../../(admin)/admin/fearless-draft/_components/types";
import { PHASE } from "./phase";

/**
 * Комната встречи до первого хода (ТЗ 22а).
 *
 * Экран отвечает на три вопроса в этом порядке: в какой мы стадии, кто со мной в комнате, что
 * я могу нажать. Поэтому сверху стадия одной пилюлей, ниже две стороны борд-о-борд, а мои кнопки
 * живут ВНУТРИ моей стороны — они относятся к ней, а не к экрану.
 *
 * Состояние комнаты приезжает снимком по живому каналу чата (`chat-live`): своего механизма и
 * тем более опроса не заводим — в 22б цена решения секунды хода, а вкладок в комнате десятки.
 * Клиент шлёт НАМЕРЕНИЕ и ждёт снимок в ответ, а не считает новое состояние сам.
 *
 * Борд драфта — принятая раскладка 15а, взятая как есть и в режиме просмотра: ходы вносит
 * оператор на своём экране, право хода капитану приезжает в 22б.
 */

type Send = { intent: string; side?: TeamIdx; value?: unknown; block?: "side" | "order" };

export function LobbyView({
  initial,
  me,
  admin,
  heroes,
}: {
  initial: LobbyRoom;
  me: number;
  /** Админ лиги (право `tools`) — админ комнаты, но не игрок: кнопок стороны у него нет. */
  admin: boolean;
  heroes: HeroRef[];
}) {
  const [room, setRoom] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { players: online } = useLive();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/lobby/${initial.id}`);
    if (res.ok) setRoom((await res.json()) as LobbyRoom);
  }, [initial.id]);

  const send = useCallback(
    async (body: Send) => {
      setBusy(body.intent);
      setError(null);
      try {
        const res = await fetch(`/api/lobby/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as LobbyRoom & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Не получилось");
          return;
        }
        setRoom(data);
      } catch {
        setError("Нет связи с сервером");
      } finally {
        setBusy(null);
      }
    },
    [initial.id],
  );

  // «Я зашёл» — факт комнаты, а не присутствия вкладки: приглашённый, не открывавший комнату,
  // и человек, закрывший её на минуту, — разные истории, и вторую в списке гасить нельзя.
  useEffect(() => {
    // Мимо `send`: тот ставит «занято» сразу в теле, а синхронный setState в эффекте — каскад
    // перерисовок. Здесь состояние меняется только в колбэке ответа.
    void fetch(`/api/lobby/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "join" }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<LobbyRoom>) : null))
      .then((data) => data && setRoom(data))
      .catch(() => {});
  }, [initial.id]);

  useChatEvents((event) => {
    if (event.type === "lobby" && event.room.id === initial.id) setRoom(event.room);
  });

  // Живой канал рвётся (сон вкладки, мобильная сеть) и чинится сам, но пропущенные события
  // повторно не приезжают. Возврат на вкладку — единственный момент, когда это заметно, и он же
  // самый дешёвый повод перечитать снимок. Опроса при этом не появляется.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const mine = meIn(room, me);
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  // Карточка команды борду нужна за лого и капитаном; капитана берём из комнаты, а не из ростера:
  // в лобби капитан тот, кого выбрала сторона, а не тот, у кого галочка в составе.
  const teamRefs: TeamRef[] = useMemo(
    () =>
      room.sides.map((s, i) => {
        const cap = captainOf(room, i as TeamIdx);
        return {
          id: s.teamId,
          name: s.name,
          color: s.color,
          logo: s.logo,
          captain: cap ? { nickname: cap.nickname, photo: cap.photo, mmr: null } : null,
        };
      }),
    [room],
  );

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Лига · комната встречи"
        title={room.title}
        aside={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={PHASE[room.status].tone}>{PHASE[room.status].label}</StatusPill>
            <span className="text-[11px] font-bold text-muted">
              ход {fmtTime(room.mainSec)} · банк {fmtTime(room.reserveSec)} · Bo{room.bestOf}
            </span>
          </span>
        }
      />

      {error && <Alert tone="err">{error}</Alert>}

      {room.status === "coin" && room.coin && (
        <Coin room={room} me={me} busy={busy} onPick={(block, value) => send({ intent: "coin", block, value })} />
      )}

      {room.state && (
        <FearlessRun state={room.state} setState={() => {}} heroById={heroById} teams={teamRefs} readOnly />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {([0, 1] as TeamIdx[]).map((side) => (
          <Side
            key={side}
            room={room}
            side={side}
            mine={mine}
            admin={admin || room.ownerAccountId === me}
            online={online}
            busy={busy}
            onSend={send}
          />
        ))}
      </div>
    </div>
  );
}

/** Одна сторона: кто в ней, кто капитан, кто готов — и мои кнопки, если сторона моя. */
function Side({
  room,
  side,
  mine,
  admin,
  online,
  busy,
  onSend,
}: {
  room: LobbyRoom;
  side: TeamIdx;
  mine: LobbyMemberView | null;
  admin: boolean;
  online: Set<number>;
  busy: string | null;
  onSend: (body: Send) => void;
}) {
  const team = room.sides[side];
  const players = sidePlayers(room, side);
  const others = room.members.filter((m) => m.side === side && m.role !== "player");
  const cap = captainOf(room, side);
  const ready = sideReady(room, side);
  const blocker = sideBlocker(room, side);
  const gathering = room.status === "gather";
  // Кнопки — только у игрока ЭТОЙ стороны. Админ комнаты и тренер смотрят (решение 3).
  const isMySide = mine?.side === side && mine.role === "player";

  return (
    <Card variant="tight">
      <div className="font-pouf">
        <div className="flex items-center gap-2">
          <TeamLogo team={{ name: team.name, logo: team.logo }} size={28} />
          <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-black text-ink">{team.name}</h2>
          <StatusPill tone={ready ? "ok" : "neutral"}>{ready ? "сторона готова" : (blocker ?? "ждём")}</StatusPill>
        </div>

        <div className="mt-3 space-y-1">
          {players.length === 0 && <p className="text-[13px] font-bold text-muted">За сторону никого не позвали.</p>}
          {players.map((m) => (
            <Line key={m.id} m={m} online={online} />
          ))}
        </div>

        {others.length > 0 && (
          <>
            <Eyebrow className="mt-4 mb-1.5">Не в составе</Eyebrow>
            <div className="space-y-1">
              {others.map((m) => (
                <Line key={m.id} m={m} online={online} />
              ))}
            </div>
          </>
        )}

        {(isMySide || (admin && cap)) && gathering && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
            {isMySide && !cap && (
              <Button size="sm" loading={busy === "captain"} onClick={() => onSend({ intent: "captain" })}>
                Стать капитаном
              </Button>
            )}
            {/* Перехвата нет: капитан — первый нажавший, у остальных кнопка гаснет и показывает,
                кто им стал. Иначе гонку за кнопку решала бы скорость руки. */}
            {isMySide && cap && !mine?.captain && (
              <Button size="sm" variant="quiet" disabled>
                капитан: {cap.nickname}
              </Button>
            )}
            {isMySide && mine?.captain && (
              <Button size="sm" variant="quiet" loading={busy === "resign"} onClick={() => onSend({ intent: "resign" })}>
                Отдать капитанство
              </Button>
            )}
            {isMySide && (
              <Button
                size="sm"
                variant={mine?.ready ? "quiet" : "solid"}
                tone={mine?.ready ? "purple" : "orange"}
                loading={busy === "ready"}
                onClick={() => onSend({ intent: "ready", value: !mine?.ready })}
              >
                {mine?.ready ? "Я не готов" : "Готов"}
              </Button>
            )}
            {/* Выход из тупика «капитан отвалился»: отмены и подмены хода в лобби нет, и без этой
                кнопки комната встала бы навсегда. Дальше сторона выбирает капитана заново. */}
            {admin && cap && (
              <Button
                size="sm"
                variant="quiet"
                tone="down"
                loading={busy === "unseat"}
                onClick={() => onSend({ intent: "unseat", side })}
              >
                Снять капитана
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Строка участника: кто он в комнате, зашёл ли, капитан ли, готов ли. */
function Line({ m, online }: { m: LobbyMemberView; online: Set<number> }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 ${m.joined ? "" : "opacity-50"}`}>
      <PlayerAvatar photo={m.photo} nickname={m.nickname} size={28} shape="circle" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-black text-ink">{m.nickname}</span>
          {m.playerId !== null && online.has(m.playerId) && (
            <span
              title="В сети"
              className="inline-block h-[9px] w-[9px] shrink-0 rounded-pill bg-[var(--up)] [box-shadow:0_0_0_2px_var(--surface)]"
            />
          )}
        </span>
        <span className="block truncate text-[11px] font-bold text-muted">
          {m.captain ? "капитан" : ROLE_LABEL[m.role]}
          {!m.joined && " · не заходил"}
        </span>
      </span>
      {m.role === "player" && (
        <span className={`shrink-0 text-[11px] font-black ${m.ready ? "text-[var(--accent-ink)]" : "text-muted"}`}>
          {m.ready ? <Icon name="ok" size="sm" /> : "ждём"}
        </span>
      )}
    </div>
  );
}

/**
 * Монетка. Результат — событие, а не строка статуса: его видят все участники разом, и тут же
 * видно, чей сейчас выбор. Победитель берёт ОДИН блок — сторону или очередь; второй достаётся
 * сопернику, и его капитан выбирает в нём значение.
 */
function Coin({
  room,
  me,
  busy,
  onPick,
}: {
  room: LobbyRoom;
  me: number;
  busy: string | null;
  onPick: (block: "side" | "order", value: TeamIdx) => void;
}) {
  const coin = room.coin!;
  const first = coin.block === null;
  const turn: TeamIdx = first ? coin.winner : ((1 - coin.winner) as TeamIdx);
  const cap = captainOf(room, turn);
  const myTurn = cap?.accountId === me;
  const names = [room.sides[0].name, room.sides[1].name] as const;
  // Свободен тот блок, который ещё не разыгран: первым выбирает победитель, второй достаётся сопернику.
  const blocks: ("side" | "order")[] = first ? ["side", "order"] : coin.block === "side" ? ["order"] : ["side"];

  return (
    <Card variant="tight">
      <div className="space-y-3 font-pouf">
        <Alert tone="info" block>
          Монетку выиграла <b>{names[coin.winner]}</b>.{" "}
          {first
            ? "Её капитан берёт один блок — сторону или очередь; второй достаётся сопернику."
            : `Блок «${coin.block === "side" ? "сторона" : "очередь"}» разыгран — оставшийся выбирает ${names[turn]}.`}
        </Alert>

        {myTurn ? (
          blocks.map((block) => (
            <div key={block}>
              <Eyebrow className="mb-1.5">{block === "side" ? "Свет (Radiant)" : "Первый пик (FP)"}</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {([0, 1] as TeamIdx[]).map((v) => (
                  <Button key={v} size="sm" variant="quiet" loading={busy === "coin"} onClick={() => onPick(block, v)}>
                    {names[v]}
                  </Button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-[13px] font-bold text-muted">
            Ждём выбор капитана: <b className="text-ink">{cap?.nickname ?? names[turn]}</b>.
          </p>
        )}
      </div>
    </Card>
  );
}
