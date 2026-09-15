"use client";

import { Icon } from "@/components/pouf/Icon";
import { Separator } from "@/components/pouf/separator";
import { Eyebrow } from "@/components/pouf/text";
import { TeamLogo } from "@/app/(public)/roster/_components/avatar";
import {
  SEQUENCE,
  firstPickOf,
  radiantOf,
  type FearlessState,
  type Seq,
  type TeamIdx,
} from "@/lib/fearless";
import { Panel } from "../../../_components/panel";
import { CaptainLine } from "./captain-line";
import type { HeroRef, TeamRef } from "./types";

/**
 * Колонка одной стороны карты: шапка команды, её пики, её баны, капитан подвалом.
 *
 * До ТЗ 15 это была одна узкая панель сбоку с номерным рельсом по центру (`Sequence`). Рельс
 * между двумя колонками, которые теперь разнесены по краям пула, физически невозможен — значит
 * номер переезжает в сам слот, а сквозной список ходов распадается на две группы по действию.
 * Ради этого этап и делался: «что взяла эта команда» читается одним взглядом, а пять пиков подряд
 * одного размера — и есть картинка референса. Номера ходов никуда не деваются, они в слотах.
 *
 * Своя разметка, а не китовая таблица: это не список данных, а расписание с портретом,
 * действием и номером. Второго потребителя у неё нет.
 */
export function TeamColumn({
  state,
  gameIdx,
  team,
  teamRef,
  heroById,
  side,
  past,
}: {
  state: FearlessState;
  /** Какая карта показана — активная или просматриваемая сыгранная. */
  gameIdx: number;
  team: TeamIdx;
  /** Лого и капитан из ростера. Может не найтись — команду могли переименовать после старта. */
  teamRef: TeamRef | undefined;
  heroById: Map<number, HeroRef>;
  side: "left" | "right";
  /** Показываем сыгранную карту: текущего хода на ней нет, пики выбыли из серии. */
  past: boolean;
}) {
  const moves = state.games[gameIdx]?.moves ?? [];
  const mySeq: Seq = team === firstPickOf(state, gameIdx) ? 0 : 1;
  const slots = SEQUENCE.flatMap((s, i) => (s.seq === mySeq ? [{ i, action: s.action }] : []));
  const picks = slots.filter((s) => s.action === "pick");
  const bans = slots.filter((s) => s.action === "ban");

  const curIdx = past ? -1 : moves.length;
  const myTurn = !past && curIdx < SEQUENCE.length && SEQUENCE[curIdx]?.seq === mySeq;
  const color = state.teams[team].color;
  const light = radiantOf(state, gameIdx) === team;

  const slotOf = (i: number) => {
    const move = moves[i];
    return {
      n: i + 1,
      hero: move ? heroById.get(move.heroId) : undefined,
      current: i === curIdx,
    };
  };

  return (
    // Обводка цветом команды на всю колонку — тот же приём, что у статусной строки хода
    // (outline + offset). Один приём «сейчас ходит эта сторона» на экране, а не два.
    <div
      className="rounded-card"
      style={myTurn ? { outline: `2px solid ${color}`, outlineOffset: 2 } : undefined}
    >
      <Panel>
        <div className="flex min-w-0 items-center gap-2">
          {teamRef && <TeamLogo team={{ name: teamRef.name, logo: teamRef.logo }} size={28} />}
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-ink">{state.teams[team].name}</div>
            <div className="text-[11px] font-bold uppercase tracking-[1px] text-muted">
              {light ? "свет" : "тьма"}
            </div>
          </div>
        </div>

        <Eyebrow className="mb-1.5 mt-4">Пики</Eyebrow>
        <ol className="space-y-1">
          {picks.map(({ i }) => {
            const { n, hero, current } = slotOf(i);
            return (
              <li key={i} aria-current={current ? "step" : undefined}>
                <PickSlot n={n} hero={hero} color={color} current={current} locked={past && !!hero} side={side} />
              </li>
            );
          })}
        </ol>

        <Eyebrow className="mb-1.5 mt-4">Баны</Eyebrow>
        {/* Плитка закреплена в 40px, а не тянется по ширине колонки: бан остаётся мелкой
            справочной плиткой рядом с крупным пиком, и ряд не раздувается ни в стеке ниже xl
            (там колонка во всю страницу), ни при другом числе банов в регламенте. Сколько
            плиток — считает SEQUENCE, число здесь не пишется. */}
        <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${bans.length}, 40px)` }}>
          {bans.map(({ i }) => {
            const { n, hero, current } = slotOf(i);
            return (
              <li key={i} className="min-w-0" aria-current={current ? "step" : undefined}>
                <BanSlot n={n} hero={hero} current={current} />
              </li>
            );
          })}
        </ol>

        <Separator />
        <CaptainLine captain={teamRef?.captain} color={color} />
      </Panel>
    </div>
  );
}

/** Номер хода плашкой в углу портрета: отдельная колонка под номер съела бы 28px из 224
 *  внутренних, и длинное имя героя перестало бы помещаться. */
function SlotNumber({ n, side }: { n: number; side: "left" | "right" }) {
  return (
    <span
      className={`absolute bottom-0 ${side === "right" ? "right-0 rounded-tl-[8px]" : "left-0 rounded-tr-[8px]"} bg-surface px-1 text-[11px] font-black tabular-nums text-muted`}
    >
      {n}
    </span>
  );
}

/** Слот пика: портрет 96×54 (16:9) и имя героя строкой. */
function PickSlot({
  n,
  hero,
  color,
  current,
  locked,
  side,
}: {
  n: number;
  hero: HeroRef | undefined;
  color: string;
  current: boolean;
  /** Пик сыгранной карты: выбыл из серии до её конца — то же слово, что на плитке пула. */
  locked: boolean;
  side: "left" | "right";
}) {
  return (
    <div className={`flex items-center gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
      <div
        className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded-[10px]"
        // Цвет команды — сырой hex: его выбирает оператор эфира, и он же горит в трансляции.
        style={{ boxShadow: hero ? `inset 0 0 0 2px ${color}` : undefined }}
      >
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.img} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className={`grid h-full w-full place-items-center text-[10px] font-black uppercase ${
              current ? "bg-accent-fill text-[var(--on-accent)] cushion-row" : "bg-surface-2 text-muted cushion-field"
            }`}
          >
            {current ? "сейчас" : "пик"}
          </div>
        )}
        {locked && (
          <span className={`absolute top-0 ${side === "right" ? "left-0" : "right-0"} bg-surface px-1 py-0.5 text-err-ink`}>
            <Icon name="lock" size="sm" label="выбыл из серии" />
          </span>
        )}
        <SlotNumber n={n} side={side} />
      </div>
      <div className={`min-w-0 flex-1 ${side === "right" ? "text-right" : ""}`}>
        <span className="block truncate text-xs font-black text-ink">{hero?.name ?? ""}</span>
        {locked && <span className="block text-[10px] font-bold uppercase text-muted">в серии</span>}
      </div>
    </div>
  );
}

/** Слот бана: плитка ~40×23 в ряду банов стороны, номер подписью под ней, имя — зачёркнутым.
 *  Плитка мала для плашки с номером, поэтому номер и ушёл под неё. */
function BanSlot({ n, hero, current }: { n: number; hero: HeroRef | undefined; current: boolean }) {
  return (
    <div className="min-w-0">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[6px]">
        {hero ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.img} alt="" className="h-full w-full object-cover opacity-40 grayscale" />
            {/* Значок в углу — третий носитель «это бан» рядом с обесцвечиванием и зачёркиванием:
                на стопкадре трансляции бан и пик обязаны различаться без цвета. */}
            <span className="absolute right-0 top-0 text-err-ink [&_svg]:h-3 [&_svg]:w-3">
              <Icon name="off" size="sm" label="бан" />
            </span>
          </>
        ) : (
          <div
            className={`grid h-full w-full place-items-center text-[8px] font-black uppercase ${
              current ? "bg-accent-fill text-[var(--on-accent)] cushion-row" : "bg-surface-2 text-muted cushion-field"
            }`}
          >
            {current ? "сейчас" : "бан"}
          </div>
        )}
      </div>
      <div className="mt-0.5 text-center text-[10px] font-black tabular-nums text-muted">{n}</div>
      {/* Строка держится всегда: иначе ряд плиток скакал бы по высоте по мере банов. */}
      <div className="min-h-[12px] truncate text-center text-[9px] font-bold leading-[1.3] text-muted line-through">
        {hero?.name ?? ""}
      </div>
    </div>
  );
}
