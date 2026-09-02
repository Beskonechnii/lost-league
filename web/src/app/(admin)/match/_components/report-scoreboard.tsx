"use client";

import { HeroPortrait, ItemsRow, TalentTreeMini } from "@/app/_components/postgame/blocks";
import { fmt, type PlayerReport, type Side } from "@/app/_components/postgame/types";
import { Chip, Meter } from "@/components/pouf/blocks";
import { TeamMark } from "@/components/pouf/table";

/* Скорборд матча.
 *
 * ВАЖНО про Кит: скорборда в нём НЕТ — §A RELEASE-PLAN числит его в «важном, чего не
 * хватает». Поэтому экран собран по месту из уже нарисованных атомов Кита: подушка
 * карточки (`cushion-card`), знак команды (`TeamMark` из таблицы), чип (`Chip`),
 * полоска силы (`Meter`) и вдавленные лунки под цифры (`bg-surface-2 cushion-field`).
 * Ничего нового не изобретено — когда скорборд появится артбордом, заменить надо будет
 * только этот файл. Что именно собрано по месту, записано в WORKLOG Э6.
 *
 * Стороны Свет/Тьма — кожа постгейма (`--pg-radiant`/`--pg-dire`), общая со страницей
 * встречи, графиком и картой строений. */

/** Маленькая лунка под число: «XPM 612». Кит: вдавленное поле, а не чип-капсула. */
function Well({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-chip bg-surface-2 px-2 py-[3px] text-[10px] font-black tabular-nums text-ink cushion-field">
      <span className="font-extrabold text-muted">{label} </span>
      {value}
    </span>
  );
}

/**
 * Карточка игрока: портрет с уровнем, ник и роль, KDA, XPM/GPM, полоска ценности,
 * урон и ЛХ/ДН, дерево талантов и инвентарь.
 */
function HeroCard({ p, side, tag, maxNet }: { p: PlayerReport; side: Side; tag: string; maxNet: number }) {
  return (
    <div
      className="rounded-blob p-2.5"
      style={{
        background: side === "radiant" ? "var(--pg-radiant-soft)" : "var(--pg-dire-soft)",
        boxShadow: `inset 0 0 0 1px ${side === "radiant" ? "var(--pg-radiant-line)" : "var(--pg-dire-line)"}`,
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* портрет + уровень */}
        <div className="relative w-14 shrink-0">
          <HeroPortrait hero={p.hero} />
          <span
            className="absolute -bottom-1.5 -left-1.5 grid h-[22px] w-[22px] place-items-center rounded-pill bg-surface text-[10px] font-black tabular-nums text-ink cushion-row"
            title={`Уровень ${p.level}`}
          >
            {p.level}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className="shrink-0 text-[10px] font-black uppercase"
              style={{ color: side === "radiant" ? "var(--pg-radiant)" : "var(--pg-dire)" }}
            >
              {tag}
            </span>
            <span className="truncate text-sm font-black text-ink" title={p.name}>
              {p.name}
            </span>
            {p.role && <span className="ml-auto shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-muted">{p.role}</span>}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black tabular-nums" title="Убийства / смерти / помощь">
              <span className="font-extrabold text-muted">KDA </span>
              <span className="text-[var(--pg-radiant)]">{p.kills}</span>
              <span className="text-muted">/</span>
              <span className="text-[var(--pg-dire)]">{p.deaths}</span>
              <span className="text-muted">/</span>
              <span className="text-[var(--color-info-ink)]">{p.assists}</span>
            </span>
            <Well label="XPM" value={p.xpm} />
            <Well label="GPM" value={p.gpm} />
          </div>

          {/* Ценность: полоска Кита относительно максимума в матче, число рядом — на бумаге
              оно читается лучше, чем белые цифры внутри заливки (так было в тёмной теме). */}
          <div className="mt-2 flex items-center gap-2">
            <Meter pct={(p.netWorth / maxNet) * 100} className="min-w-0 flex-1" />
            <span className="shrink-0 text-[11px] font-black tabular-nums text-ink" title="Ценность (net worth)">
              {fmt(p.netWorth)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[10px] font-bold tabular-nums text-ink">
            <span title="Урон по героям">
              <span className="font-extrabold text-muted">УРОН </span>
              {fmt(p.heroDamage)}
            </span>
            <span title="Ласт-хиты / денаи">
              <span className="font-extrabold text-muted">ЛХ/ДН </span>
              {p.lastHits}/{p.denies}
            </span>
          </div>
        </div>

        {/* дерево талантов */}
        <div className="shrink-0 pl-1">
          <TalentTreeMini talents={p.talents} />
        </div>
      </div>

      {/* предметы */}
      <div className="mt-2 overflow-x-auto border-t border-hairline pt-2">
        <ItemsRow p={p} />
      </div>
    </div>
  );
}

function CardTeam({
  side,
  fallback,
  teamName,
  logo,
  tag,
  maxNet,
  players,
  score,
  won,
}: {
  side: Side;
  fallback: string;
  teamName: string;
  logo: string | null;
  tag: string;
  maxNet: number;
  players: PlayerReport[];
  score: number;
  won: boolean;
}) {
  const name = teamName || fallback;
  return (
    // min-w-0: без него карточка команды — грид-элемент с `min-width:auto` — раздувается до
    // min-content своего инвентаря (12 иконок в ряд) и уносит страницу за правый край на 375px.
    <div className="min-w-0 rounded-card bg-surface p-3 font-pouf cushion-card">
      <div className="mb-2.5 flex items-center gap-2.5">
        {/* рейка стороны — тот же приём, что у зоны выхода в таблице дивизиона */}
        <span
          aria-hidden
          className="inline-block h-6 w-[7px] shrink-0 rounded-pill"
          style={{ background: side === "radiant" ? "var(--pg-radiant)" : "var(--pg-dire)" }}
        />
        <TeamMark logo={logo} tag={tag} name={name} size={28} />
        <span className="min-w-0 truncate text-sm font-black text-ink">{name}</span>
        {won && <Chip accent>Победа</Chip>}
        <span className="ml-auto text-lg font-black tabular-nums text-ink">{score}</span>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => (
          <HeroCard key={i} p={p} side={side} tag={tag} maxNet={maxNet} />
        ))}
      </div>
    </div>
  );
}

export function CardScoreboard({
  radiant,
  dire,
  names,
  logos,
  tags,
  maxNet,
  radiantScore,
  direScore,
  radiantWin,
}: {
  radiant: PlayerReport[];
  dire: PlayerReport[];
  names: { radiant: string; dire: string };
  logos: { radiant: string | null; dire: string | null };
  tags: { radiant: string; dire: string };
  maxNet: number;
  radiantScore: number;
  direScore: number;
  radiantWin: boolean;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <CardTeam
        side="radiant"
        fallback="Свет"
        teamName={names.radiant}
        logo={logos.radiant}
        tag={tags.radiant}
        maxNet={maxNet}
        players={radiant}
        score={radiantScore}
        won={radiantWin}
      />
      <CardTeam
        side="dire"
        fallback="Тьма"
        teamName={names.dire}
        logo={logos.dire}
        tag={tags.dire}
        maxNet={maxNet}
        players={dire}
        score={direScore}
        won={!radiantWin}
      />
    </div>
  );
}
