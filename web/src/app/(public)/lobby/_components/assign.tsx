"use client";

import { useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Capacity } from "@/components/pouf/capacity";
import { DataCell, DataRow, DataTable } from "@/components/pouf/data-table";
import { Alert } from "@/components/pouf/feedback";
import { DropdownMenu } from "@/components/pouf/menu";
import { Badge } from "@/components/pouf/media";
import { Eyebrow } from "@/components/pouf/text";
import { DraftHeroButton, type DraftHero } from "@/components/pouf/draft";
import {
  ASSIGNS_TOTAL,
  assignsOf,
  teamPicksOf,
  type FearlessState,
  type TeamIdx,
} from "@/lib/fearless";
import { sidePlayers, type LobbyMemberView, type LobbyRoom } from "@/lib/lobby-room";
import type { Send } from "./room";

/**
 * Стадия «выбери своего героя» (ТЗ 42д, DESIGN-5) и она же — запись прошлой карты (DESIGN-6).
 *
 * Таймера здесь нет намеренно: организатор подгоняет голосом. Герой занимается первым нажавшим,
 * свой выбор переносится нажатием на другую плитку — подтверждения не спрашиваем, потому что
 * карта ещё не закрыта и действие обратимо.
 *
 * Прошлая карта — не «та же панель без кнопок», а таблица: на ней важно не «кто ещё не выбрал»,
 * а «кто каким героем играл», и это ряд «Сторона · Игрок · Герой».
 */
export function AssignPanel({
  room,
  state,
  gameIdx,
  heroById,
  mine,
  admin,
  busy,
  onSend,
  past = false,
}: {
  room: LobbyRoom;
  state: FearlessState;
  gameIdx: number;
  heroById: Map<number, DraftHero>;
  mine: LobbyMemberView | null;
  admin: boolean;
  busy: string | null;
  onSend: (body: Send) => void;
  /** Смотрим сыгранную карту: только запись, ни одной кнопки. */
  past?: boolean;
}) {
  // Играющий ролик ровно один на панель — как в пуле: иначе вкладка держит пять декодеров.
  const [hot, setHot] = useState<number | null>(null);

  const assigns = assignsOf(state, gameIdx);
  const byHero = new Map(assigns.map((a) => [a.heroId, a]));
  const memberById = new Map(room.members.map((m) => [m.id, m]));
  // В `done` комната читается, но не пишется — кнопок нет ни у кого (ТЗ 42д §5).
  const locked = past || room.status !== "draft";

  if (past) return <PastTable room={room} state={state} gameIdx={gameIdx} heroById={heroById} />;

  // Сначала своя сторона: на ней работа, на чужой — только просмотр.
  const mySide = mine?.role === "player" ? mine.side : null;
  const order: TeamIdx[] = mySide === 1 ? [1, 0] : [0, 1];
  const waiting = ([0, 1] as TeamIdx[]).flatMap((s) =>
    sidePlayers(room, s).filter((m) => !assigns.some((a) => a.memberId === m.id)),
  );

  return (
    <div className="space-y-4">
      <Alert tone={locked ? "info" : "ok"} block>
        {locked
          ? "Карта закрыта — вот кто каким героем играл."
          : "Карта задрафчена. Каждый игрок берёт своего героя из пятёрки своей стороны — таймера нет."}
      </Alert>

      <div>
        <Capacity taken={assigns.length} limit={ASSIGNS_TOTAL} unit="players" size="sm" />
        {waiting.length > 0 && (
          <p className="mt-1 text-[13px] font-bold text-muted">
            Ещё не выбрали: {waiting.map((m) => m.nickname).join(", ")}.
          </p>
        )}
      </div>

      {order.map((side) => (
        <div key={side}>
          <Eyebrow className="mb-1.5">
            {room.sides[side].name}
            {side === mySide ? " · ваша сторона" : ""}
          </Eyebrow>
          <div className="pouf-assign">
            {teamPicksOf(state, gameIdx, side).map((heroId) => {
              const hero = heroById.get(heroId);
              if (!hero) return null;
              const a = byHero.get(heroId);
              const who = a ? (memberById.get(a.memberId)?.nickname ?? "игрок") : null;
              const isMine = !!a && a.memberId === mine?.id;
              const canTake = !locked && side === mySide && !a;
              const tile = isMine ? "chosen" : a ? "taken" : canTake ? "free" : "view";
              // Админ переставляет назначение любому игроку этой стороны — он же разруливает
              // спор, если игроки договорились иначе (ТЗ 42д §3).
              const seats = sidePlayers(room, side).map((m) => ({
                label: `Отдать ${m.nickname}`,
                disabled: a?.memberId === m.id,
                onClick: () => onSend({ intent: "assign", heroId, memberId: m.id }),
              }));

              return (
                <div key={heroId} className="pouf-assign__item">
                  <DraftHeroButton
                    hero={hero}
                    state={tile}
                    big
                    playing={hot === heroId}
                    onHot={setHot}
                    onPick={canTake ? () => onSend({ intent: "assign", heroId, memberId: null }) : undefined}
                  >
                    {who && (
                      <span className="pouf-assign__badge">
                        <Badge tone={a?.byAdmin ? "warn" : isMine ? "mint" : "purple"}>
                          {isMine ? "Вы" : who}
                        </Badge>
                      </span>
                    )}
                  </DraftHeroButton>
                  <span className="pouf-assign__aside min-w-0">
                    <span className="block truncate text-[13px] font-black text-ink">{hero.name}</span>
                    <span className="block truncate text-[11px] font-bold text-muted">
                      {who ? (isMine ? "Вы" : who) : canTake ? "свободен" : "ещё не занят"}
                      {a?.byAdmin ? " · переставил админ" : ""}
                    </span>
                  </span>
                  {admin && !locked && (
                    <DropdownMenu items={seats} label={`Кому отдать ${hero.name}`}>
                      <Button size="sm" variant="quiet" loading={busy === "assign"}>
                        Отдать
                      </Button>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Запись сыгранной карты: кто каким героем играл (DESIGN-6). */
function PastTable({
  room,
  state,
  gameIdx,
  heroById,
}: {
  room: LobbyRoom;
  state: FearlessState;
  gameIdx: number;
  heroById: Map<number, DraftHero>;
}) {
  const assigns = assignsOf(state, gameIdx);
  const memberById = new Map(room.members.map((m) => [m.id, m]));
  const rows = ([0, 1] as TeamIdx[]).flatMap((side) =>
    teamPicksOf(state, gameIdx, side).map((heroId) => {
      const a = assigns.find((x) => x.heroId === heroId);
      return {
        side,
        heroId,
        // Игрок называется НИКОМ, а не идентификатором (ТЗ 42д §6): участника могли и удалить.
        nickname: a ? (memberById.get(a.memberId)?.nickname ?? "игрок") : "—",
      };
    }),
  );

  return (
    <DataTable
      caption={`Карта ${gameIdx + 1}: кто каким героем играл`}
      columns={[{ label: "Сторона" }, { label: "Игрок" }, { label: "Герой" }]}
    >
      {rows.map((r) => (
        <DataRow key={r.heroId}>
          <DataCell muted nowrap>
            {room.sides[r.side].name}
          </DataCell>
          <DataCell>{r.nickname}</DataCell>
          <DataCell>
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroById.get(r.heroId)?.img ?? ""}
                alt=""
                className="h-[27px] w-12 shrink-0 rounded-[8px] object-cover"
              />
              <span className="min-w-0 truncate">{heroById.get(r.heroId)?.name ?? `#${r.heroId}`}</span>
            </span>
          </DataCell>
        </DataRow>
      ))}
    </DataTable>
  );
}
