"use client";

import { Button, IconButton } from "@/components/pouf/Button";
import { DragBoard, DragCard, dropClasses, useDropTarget } from "@/components/pouf/board";
import { Capacity } from "@/components/pouf/capacity";
import { StatusPill } from "@/components/pouf/feedback";
import { DropdownMenu } from "@/components/pouf/menu";
import { Icon } from "@/components/pouf/Icon";
import { PlayerLine } from "@/components/pouf/player-line";
import { Segmented } from "@/components/pouf/Segmented";
import { Card } from "@/components/pouf/surface";
import { Eyebrow } from "@/components/pouf/text";
import type { TeamIdx } from "@/lib/fearless";
import {
  ROLE_LABEL,
  SIDE_COACHES,
  SIDE_PLAYERS,
  captainOf,
  sideBlocker,
  sideCoaches,
  sidePlayers,
  sideReady,
  undecided,
  type LobbyMemberView,
  type LobbyRole,
  type LobbyRoom,
} from "@/lib/lobby-room";
import { PlayerAvatar } from "../../roster/_components/avatar";
import type { Send } from "./room";

/**
 * Стадия сбора: три лунки — «Сторона A · Неопределившиеся · Сторона B» (ТЗ 42в, DESIGN-7).
 *
 * Два пути в состав, и это не дублирование: **игрок ставит себя кнопками** (тянуть себя мышью на
 * телефоне нельзя, а выбор стороны — его собственное действие), **админ комнаты двигает любого** —
 * мышью или тем же меню в строке. Перетаскивание есть только у админа: игроку двигать чужих
 * нечего, а себя он ставит кнопкой.
 *
 * Лимит 5+1 рисуется `Capacity` в шапке лунки, но держит его сервер: переполнение приходит
 * ОТКАЗОМ ТЕКСТОМ, а не погашенной кнопкой — вкладка шестого могла узнать о пятом секунду назад.
 */
export function Gather({
  room,
  mine,
  admin,
  online,
  busy,
  onSend,
  onLeave,
}: {
  room: LobbyRoom;
  /** Я в этой комнате; null — я админ лиги, только что открывший чужую комнату. */
  mine: LobbyMemberView | null;
  /** Админ комнаты: право `tools` или владелец. Ему и только ему — перенос людей. */
  admin: boolean;
  online: Set<number>;
  busy: string | null;
  onSend: (body: Send) => void;
  onLeave: () => void;
}) {
  /** Бросок: `m:<id>` из строки, `seat:<side|x>:<role>` из лунки. Что это значит, знает экран. */
  function onDrop(from: string, to: string | null) {
    if (!to || !from.startsWith("m:")) return;
    const [, rawSide, role] = to.split(":");
    onSend({
      intent: "seat",
      memberId: Number(from.slice(2)),
      side: rawSide === "x" ? null : (Number(rawSide) as TeamIdx),
      role: role as LobbyRole,
    });
  }

  const overlay = (from: string) => {
    const m = room.members.find((x) => x.id === Number(from.slice(2)));
    return m ? <Row m={m} online={online} admin={false} room={room} onSend={onSend} /> : null;
  };

  return (
    <DragBoard id={`lobby-${room.id}`} onDrop={onDrop} overlay={overlay}>
      {/* На 390 «Неопределившиеся» идут ПЕРВЫМИ: вошедший попадает туда, и первое, что он обязан
          увидеть, — себя и кнопки выбора стороны, а не чужой состав. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SideLane
          side={0}
          className="order-2 lg:order-1"
          room={room}
          mine={mine}
          admin={admin}
          online={online}
          busy={busy}
          onSend={onSend}
        />
        <Undecided
          className="order-1 lg:order-2"
          room={room}
          mine={mine}
          admin={admin}
          online={online}
          busy={busy}
          onSend={onSend}
          onLeave={onLeave}
        />
        <SideLane
          side={1}
          className="order-3"
          room={room}
          mine={mine}
          admin={admin}
          online={online}
          busy={busy}
          onSend={onSend}
        />
      </div>
    </DragBoard>
  );
}

/** Лунка стороны: состав, тренер, состояние готовности и кнопки того, кто в ней стоит. */
function SideLane({
  side,
  className,
  room,
  mine,
  admin,
  online,
  busy,
  onSend,
}: {
  side: TeamIdx;
  className: string;
  room: LobbyRoom;
  mine: LobbyMemberView | null;
  admin: boolean;
  online: Set<number>;
  busy: string | null;
  onSend: (body: Send) => void;
}) {
  const players = sidePlayers(room, side);
  const coaches = sideCoaches(room, side);
  const cap = captainOf(room, side);
  const ready = sideReady(room, side);
  const blocker = sideBlocker(room, side);
  const team = room.sides[side];
  const iAmHere = mine?.side === side;
  const iAmCaptain = !!mine?.captain && iAmHere;

  const { ref: seatsRef, isOver: seatsOver } = useDropTarget(`seat:${side}:player`, !admin);
  const { ref: benchRef, isOver: benchOver } = useDropTarget(`seat:${side}:coach`, !admin);

  return (
    // Раскладочные классы — на обёртке: `Card` Кита своего `className` не принимает намеренно,
    // и подмешивать их внутрь атома значит открыть ему раскладку по месту.
    <div className={`min-w-0 ${className}`}>
      <Card variant="tight">
        <div className="space-y-3 font-pouf">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />
            <h2 className="min-w-0 flex-1 truncate text-[17px] font-black text-ink">{team.name}</h2>
            <StatusPill tone={ready ? "ok" : "neutral"}>{ready ? "готова" : (blocker ?? "ждём")}</StatusPill>
          </div>

          <Capacity taken={players.length} limit={SIDE_PLAYERS} unit="players" size="sm" />

          <div
            ref={seatsRef}
            className={`min-h-[76px] space-y-1.5 rounded-blob p-1.5 transition-[box-shadow,background] ${dropClasses({ isOver: seatsOver, filled: players.length > 0 })}`}
          >
            {players.length === 0 ? (
              <p className="px-2 py-4 text-center text-[13px] font-bold text-muted">Пока никого.</p>
            ) : (
              players.map((m) => (
                <Row key={m.id} m={m} online={online} admin={admin} room={room} onSend={onSend} />
              ))
            )}
          </div>

          <div>
            <Eyebrow className="mb-1.5">Тренер</Eyebrow>
            <div
              ref={benchRef}
              className={`space-y-1.5 rounded-blob p-1.5 transition-[box-shadow,background] ${dropClasses({ isOver: benchOver, filled: coaches.length > 0 })}`}
            >
              {coaches.length === 0 ? (
                <p className="px-2 py-2 text-[13px] font-bold text-muted">
                  Место свободно — сторона играет и без тренера.
                </p>
              ) : (
                coaches.map((m) => (
                  <Row key={m.id} m={m} online={online} admin={admin} room={room} onSend={onSend} />
                ))
              )}
            </div>
          </div>

          {iAmHere && (
            <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
              {mine.role === "player" && !cap && (
                <Button size="sm" loading={busy === "captain"} onClick={() => onSend({ intent: "captain" })}>
                  Стать капитаном
                </Button>
              )}
              {iAmCaptain && (
                <>
                  <Button
                    size="sm"
                    variant={mine.ready ? "quiet" : "solid"}
                    tone={mine.ready ? "purple" : "orange"}
                    loading={busy === "ready"}
                    onClick={() => onSend({ intent: "ready", value: !mine.ready })}
                  >
                    {mine.ready ? "Мы не готовы" : "Сторона готова"}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    loading={busy === "resign"}
                    onClick={() => onSend({ intent: "resign" })}
                  >
                    Отдать капитанство
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="quiet"
                loading={busy === "sit"}
                onClick={() => onSend({ intent: "sit", side: null, role: "player" })}
              >
                Выйти из состава
              </Button>
            </div>
          )}

          {/* Права нет — кнопки нет вовсе (DESIGN-9): гасить её серым значило бы предлагать нажать. */}
          {iAmHere && mine.role === "player" && !iAmCaptain && cap && (
            <p className="text-[11px] font-bold text-muted">Готовность жмёт капитан: {cap.nickname}.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Лунка «Неопределившиеся»: вошли, но ещё не встали за сторону. Здесь же — мой выбор места. */
function Undecided({
  className,
  room,
  mine,
  admin,
  online,
  busy,
  onSend,
  onLeave,
}: {
  className: string;
  room: LobbyRoom;
  mine: LobbyMemberView | null;
  admin: boolean;
  online: Set<number>;
  busy: string | null;
  onSend: (body: Send) => void;
  onLeave: () => void;
}) {
  const waiting = undecided(room);
  const { ref, isOver } = useDropTarget("seat:x:player", !admin);
  const iAmWaiting = !!mine && mine.side === null && mine.role !== "admin" && mine.role !== "caster";

  return (
    // Раскладочные классы — на обёртке: `Card` Кита своего `className` не принимает намеренно,
    // и подмешивать их внутрь атома значит открыть ему раскладку по месту.
    <div className={`min-w-0 ${className}`}>
      <Card variant="tight">
        <div className="space-y-3 font-pouf">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[17px] font-black text-ink">Неопределившиеся</h2>
            <StatusPill tone="neutral">{waiting.length}</StatusPill>
          </div>

          <div
            ref={ref}
            className={`min-h-[76px] space-y-1.5 rounded-blob p-1.5 transition-[box-shadow,background] ${dropClasses({ isOver, filled: waiting.length > 0 })}`}
          >
            {waiting.length === 0 ? (
              <p className="px-2 py-4 text-center text-[13px] font-bold text-muted">Все разобрались по сторонам.</p>
            ) : (
              waiting.map((m) => (
                <Row key={m.id} m={m} online={online} admin={admin} room={room} onSend={onSend} />
              ))
            )}
          </div>

          {iAmWaiting && <MySeat room={room} mine={mine} busy={busy} onSend={onSend} />}

          {mine && (
            <div className="border-t border-hairline pt-3">
              <Button size="sm" variant="quiet" tone="down" loading={busy === "leave"} onClick={onLeave}>
                Покинуть комнату
              </Button>
              <p className="mt-1.5 text-[11px] font-bold leading-[1.5] text-muted">
                Вернуться можно по паролю или приглашению. После начала драфта выйти нельзя.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Мой выбор места: кем я иду и за какую сторону. Две кнопки, а не перетаскивание себя мышью. */
function MySeat({
  room,
  mine,
  busy,
  onSend,
}: {
  room: LobbyRoom;
  mine: LobbyMemberView;
  busy: string | null;
  onSend: (body: Send) => void;
}) {
  const role: "player" | "coach" = mine.role === "coach" ? "coach" : "player";

  return (
    <div className="space-y-2 border-t border-hairline pt-3">
      <Eyebrow>Я иду</Eyebrow>
      {/* Роль — выбор ОДНОГО из двух и меняется мгновенно, поэтому `Segmented`, а не `ChoiceChips`:
          те — множественный выбор внутри формы, отправляемой серверным экшеном. */}
      <Segmented
        label="Кем я иду"
        value={role}
        options={[
          { value: "player", label: "Игрок" },
          { value: "coach", label: "Тренер" },
        ]}
        onChange={(v) => onSend({ intent: "sit", side: null, role: v })}
      />
      <div className="flex flex-wrap gap-2">
        {([0, 1] as TeamIdx[]).map((side) => (
          <Button key={side} size="sm" loading={busy === "sit"} onClick={() => onSend({ intent: "sit", side, role })}>
            За «{room.sides[side].name}»
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Строка человека в лунке. Админу комнаты она же — ручка переноса: мышью или меню в конце строки.
 * Меню обязательно: на телефоне перетаскивания нет, а состав там тоже собирают.
 */
function Row({
  m,
  room,
  online,
  admin,
  onSend,
}: {
  m: LobbyMemberView;
  room: LobbyRoom;
  online: Set<number>;
  admin: boolean;
  onSend: (body: Send) => void;
}) {
  const sub = [
    m.captain ? "капитан" : ROLE_LABEL[m.role],
    m.playerId !== null && online.has(m.playerId) ? "в сети" : null,
    m.joined ? null : "не заходил",
  ]
    .filter(Boolean)
    .join(" · ");

  const seat = (side: TeamIdx | null, role: LobbyRole, label: string) => ({
    label,
    onClick: () => onSend({ intent: "seat", memberId: m.id, side, role }),
    disabled: m.side === side && m.role === role,
  });

  return (
    <div className={`flex items-center gap-1 rounded-control bg-surface cushion-row ${m.joined ? "" : "opacity-60"}`}>
      <DragCard id={`m:${m.id}`} muted={!admin} bare title={admin ? "Перетащите в другую лунку" : undefined}>
        <PlayerLine
          thumb={<PlayerAvatar photo={m.photo} nickname={m.nickname} size={28} shape="circle" />}
          nickname={m.nickname}
          sub={sub}
          hideValue
          dense
        />
      </DragCard>
      {m.captain && <span className="shrink-0 pr-1 text-[11px] font-black text-[var(--accent-ink)]">КАП</span>}
      {m.ready && m.captain && <Icon name="ok" size="sm" />}
      {admin && (
        <DropdownMenu
          label={`Место: ${m.nickname}`}
          items={[
            seat(0, "player", `${room.sides[0].name} · игрок`),
            seat(0, "coach", `${room.sides[0].name} · тренер`),
            seat(1, "player", `${room.sides[1].name} · игрок`),
            seat(1, "coach", `${room.sides[1].name} · тренер`),
            "separator",
            seat(null, "player", "В неопределившиеся"),
            seat(null, "admin", "В администрацию"),
            "separator",
            {
              label: m.captain ? "Снять капитанство" : "Назначить капитаном",
              disabled: m.side === null || m.role !== "player",
              onClick: () =>
                onSend({
                  intent: "unseat",
                  side: m.side as TeamIdx,
                  memberId: m.captain ? null : m.id,
                }),
            },
          ]}
        >
          <IconButton size="sm" variant="quiet" icon={<Icon name="dots" size="sm" />} label="Место в комнате" />
        </DropdownMenu>
      )}
    </div>
  );
}

/** Подсказка о лимите — одной строкой под доской, чтобы не повторять её в каждой лунке. */
export function GatherHint() {
  return (
    <p className="text-[11px] font-bold text-muted">
      Сторона — {SIDE_PLAYERS} игроков и {SIDE_COACHES} тренер. Администрация (админ комнаты, ОБС) мест в составе не
      занимает.
    </p>
  );
}
