"use client";

import type { ReactNode } from "react";
import { HeroFrame, HeroPortrait, TeamCrest } from "@/app/_components/postgame/blocks";
import { clock, kFmt1, pad, type MatchReport, type PickBan, type PlayerReport, type Side } from "@/app/_components/postgame/types";
import { Chip } from "@/components/pouf/blocks";

/* Сводка матча — первый блок отчёта: шапка со счётом, полоса героев, баны.
 * Выделена из `report.tsx` на Э6 (файл был 913 строк — самый крупный в продукте).
 *
 * Свет и Тьма покрашены кожей постгейма (`--pg-radiant`/`--pg-dire`): те же цвета
 * стоят на графике, карте строений и странице встречи, поэтому «зелёный» на всех
 * четырёх экранах значит одно и то же и не спорит с мятным акцентом Кита. */

/** Половина шапки: герб, редактируемое имя, плашка исхода и чипы преимущества. */
function TeamSide({
  name,
  onName,
  onCommit,
  logo,
  won,
  chips,
  align,
}: {
  name: string;
  onName: (v: string) => void;
  onCommit: () => void;
  logo: string | null;
  won: boolean;
  chips: ReactNode;
  align: "left" | "right";
}) {
  const crest = <TeamCrest logo={logo} name={name} />;
  const nameBlock = (
    <div className={`min-w-0 flex-1 ${align === "right" ? "sm:text-right" : ""}`}>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        // В адрес правка уходит по уходу из поля, а не на каждую букву: иначе история
        // браузера засоряется, а каждый символ стоит перерисовки маршрута.
        onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="Название команды"
        className={`w-full bg-transparent text-base font-black text-ink outline-none placeholder:text-muted md:text-lg ${
          align === "right" ? "sm:text-right" : ""
        }`}
      />
      <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${align === "right" ? "sm:justify-end" : ""}`}>
        <Chip accent={won}>{won ? "Победа" : "Поражение"}</Chip>
        {chips}
      </div>
    </div>
  );
  // На узком экране обе стороны читаются слева направо: зеркальная половина там,
  // где под неё нет ширины, превращалась в кашу из прижатых к разным краям кусков.
  return (
    <div className={`flex flex-1 items-center gap-3 ${align === "right" ? "sm:flex-row-reverse" : ""}`}>
      {crest}
      {nameBlock}
    </div>
  );
}

export function ScoreHeader({
  match,
  names,
  setNames,
  commitNames,
  logos,
}: {
  match: MatchReport;
  names: { radiant: string; dire: string };
  setNames: (u: (s: { radiant: string; dire: string }) => { radiant: string; dire: string }) => void;
  commitNames: () => void;
  logos: { radiant: string | null; dire: string | null };
}) {
  // Итоговое преимущество (последний отсчёт adv) — чипами у стороны-лидера, как на рефе.
  const gold = match.goldAdv.at(-1) ?? 0;
  const xp = match.xpAdv.at(-1) ?? 0;
  const chip = (v: number, label: string) => (
    <Chip key={label} className="tabular-nums">
      +{kFmt1(Math.abs(v))} {label}
    </Chip>
  );
  const sideChips = (side: Side) => (
    <>
      {gold !== 0 && (side === "radiant") === gold > 0 && chip(gold, "золото")}
      {xp !== 0 && (side === "radiant") === xp > 0 && chip(xp, "опыт")}
    </>
  );
  const d = match.startTime ? new Date(match.startTime * 1000) : null;
  return (
    // Столбиком до sm: три колонки (команда · счёт · команда) в 375px не помещаются —
    // счёт вылезал за край карточки.
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:gap-5">
      <TeamSide
        name={names.radiant}
        onName={(v) => setNames((s) => ({ ...s, radiant: v }))}
        onCommit={commitNames}
        logo={logos.radiant}
        won={match.radiantWin}
        chips={sideChips("radiant")}
        align="left"
      />
      {/* Счёт — лунка Кита, та же, что в карточке встречи: цифры сидят во вдавленной плашке */}
      <div className="flex shrink-0 flex-col items-center gap-1 px-2">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted">{clock(match.durationSeconds)}</div>
        <div className="flex items-center justify-center gap-2 rounded-control bg-surface-2 px-4 py-2 tabular-nums cushion-field">
          <b className="text-3xl font-black leading-none text-[var(--pg-radiant)] md:text-4xl">{match.radiantScore}</b>
          <span className="font-black text-muted">:</span>
          <b className="text-3xl font-black leading-none text-[var(--pg-dire)] md:text-4xl">{match.direScore}</b>
        </div>
        <div className="text-[10px] font-bold text-muted">
          {d
            ? `${d.toLocaleDateString("ru-RU")} в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · `
            : ""}
          #{match.matchId}
        </div>
      </div>
      <TeamSide
        name={names.dire}
        onName={(v) => setNames((s) => ({ ...s, dire: v }))}
        onCommit={commitNames}
        logo={logos.dire}
        won={!match.radiantWin}
        chips={sideChips("dire")}
        align="right"
      />
    </div>
  );
}

/** Полоса героев: 5+5 портретов, под каждым ник. Подложка — сторона (Свет / Тьма). */
export function HeroStrip({ radiant, dire }: { radiant: PlayerReport[]; dire: PlayerReport[] }) {
  const group = (list: PlayerReport[], side: Side) => (
    <div
      key={side}
      className="grid flex-1 grid-cols-5 gap-1.5 rounded-blob p-2"
      style={{ background: side === "radiant" ? "var(--pg-radiant-soft)" : "var(--pg-dire-soft)" }}
    >
      {pad(list, 5).map((p, i) =>
        p ? (
          <div key={i} className="flex min-w-0 flex-col items-center gap-1">
            <HeroPortrait hero={p.hero} />
            <span
              className="w-full truncate text-center text-[11px] font-bold text-ink"
              title={`${p.name}${p.role ? ` · ${p.role}` : ""}`}
            >
              {p.name}
            </span>
          </div>
        ) : (
          <div key={i} className="aspect-video w-full rounded-md bg-surface-2" />
        ),
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      {group(radiant, "radiant")}
      {group(dire, "dire")}
    </div>
  );
}

/** Баны одной полосой: кластеры по командам, иконки перечёркнуты. */
export function BansStrip({ picksBans }: { picksBans: PickBan[] }) {
  const bans = picksBans.filter((pb) => !pb.isPick);
  if (bans.length === 0) return null;
  const group = (side: Side) => (
    // basis-0 flex-1 — половины делят ширину поровну, поэтому при переносе строки обе стороны
    // ломаются одинаково, а не «пять слева, четыре справа»
    <div className={`flex flex-1 basis-0 flex-wrap items-center gap-1 ${side === "dire" ? "justify-end" : ""}`}>
      {bans
        .filter((b) => b.side === side)
        .map((b) => (
          <HeroFrame key={b.order} hero={b.hero} side={side} h={32} banned title={`бан ${b.order + 1}: ${b.hero.name}`} />
        ))}
    </div>
  );
  return (
    <div className="flex items-center justify-between gap-4">
      {group("radiant")}
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-muted">Баны</span>
      {group("dire")}
    </div>
  );
}
