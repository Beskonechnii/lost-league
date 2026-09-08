"use client";

// Экспортный постгейм: две отдельные картинки 1920×1080 на общей подложке —
// «сводка матча» (шапка, герои, баны, карта + график, события) и «статистика игроков»
// (две колонки карточек). Рендерим в 960×540 и снимаем PNG со scale ×2 → ровно 1920×1080:
// так внутренние размеры остаются в тех же порядках, что и на странице, а картинка выходит ретиновой.
// Подложка — public/templates/postgame/bg.png; файла нет → фирменный градиент, как в студийных шаблонах.

import { useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { Canvas } from "@/studio/Canvas";
import { Button } from "@/components/pouf/Button";
import { archiveShot, type ArchiveDraft, type ShotKind } from "../match-archive";
import { AdvantageChart, BuildingMap, EventBadges, HeroFrame, HeroPortrait, ItemsRow, TeamCrest } from "./blocks";
import { EXPORT_SKIN } from "./skin";
import { clock, fmt, kFmt1, pad, type MatchReport, type PlayerReport, type Side } from "./types";

export const EXPORT_W = 960;
export const EXPORT_H = 540;
export const EXPORT_SCALE = 2; // каждый PNG выходит 1920×1080

const BG_URL = "/templates/postgame/bg.png";
// Низ подложки занят партнёрской плашкой (лого лиги, спонсоры) — контент туда не заходит.
// В координатах холста 960×540: на исходнике 1920×1080 плашка занимает ~150px снизу.
const SAFE_BOTTOM = 76;

type Names = { radiant: string; dire: string };
type Logos = { radiant: string | null; dire: string | null };

// Общая рамка блока: градиент-заглушка снизу, поверх — подложка (если файл есть), поверх — контент.
// Здесь же живёт тёмная кожа постгейма: `EXPORT_SKIN` переопределяет `--pg-*` РОВНО внутри
// картинки. Общие блоки (иконки, график, карта) от этого темнеют только тут — на сайте те же
// компоненты остаются светлыми, потому что их значения по умолчанию заданы в globals.css.
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ width: EXPORT_W, height: EXPORT_H, ...EXPORT_SKIN, color: "var(--pg-ink)" }}
      className="relative overflow-hidden bg-gradient-to-br from-[#1a0f2e] via-[#0c0c14] to-[#2a0f3a]"
    >
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${BG_URL})` }} />
      {/* затемнение только над рабочей зоной: партнёрская плашка внизу остаётся как есть.
          Последние 48px гасим в ноль — иначе на границе видна ступенька */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          bottom: SAFE_BOTTOM,
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,.45) 0, rgba(0,0,0,.45) ${EXPORT_H - SAFE_BOTTOM - 48}px, rgba(0,0,0,0) 100%)`,
        }}
      />
      <div
        className="relative flex h-full w-full flex-col gap-2"
        style={{ padding: "16px 20px", paddingBottom: SAFE_BOTTOM }}
      >
        {children}
      </div>
    </div>
  );
}

// --- Шапка: команда · бейджи | центр со счётом | команда (зеркально) ---
function HeaderTeam({
  name,
  logo,
  won,
  chips,
  align,
}: {
  name: string;
  logo: string | null;
  won: boolean;
  chips: React.ReactNode;
  align: "left" | "right";
}) {
  const crest = <TeamCrest logo={logo} name={name} size={52} />;
  const info = (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : ""}`}>
      <div className="truncate text-[20px] font-bold leading-tight text-[var(--pg-ink)]">
        {name || (align === "left" ? "Свет" : "Тьма")}
      </div>
      <div className={`mt-1 flex items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
        <span
          className={`rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
            won ? "bg-violet-600 text-white" : "bg-[var(--pg-well)] text-[var(--pg-muted)]"
          }`}
        >
          {won ? "Победа" : "Поражение"}
        </span>
        {chips}
      </div>
    </div>
  );
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {align === "left" ? crest : info}
      {align === "left" ? info : crest}
    </div>
  );
}

function Header({ match, names, logos }: { match: MatchReport; names: Names; logos: Logos }) {
  const gold = match.goldAdv.at(-1) ?? 0;
  const xp = match.xpAdv.at(-1) ?? 0;
  const chip = (v: number, label: string, cls: string) => (
    <span key={label} className={`rounded px-1.5 py-px text-[10px] font-bold tabular-nums ring-1 ${cls}`}>
      +{kFmt1(Math.abs(v))} {label}
    </span>
  );
  const sideChips = (side: Side) => (
    <>
      {gold !== 0 && (side === "radiant") === gold > 0 && chip(gold, "золото", "bg-amber-500/20 text-amber-300 ring-amber-500/40")}
      {xp !== 0 && (side === "radiant") === xp > 0 && chip(xp, "опыт", "bg-sky-500/20 text-sky-300 ring-sky-500/40")}
    </>
  );
  const d = match.startTime ? new Date(match.startTime * 1000) : null;
  return (
    <div className="flex shrink-0 items-center gap-3">
      <HeaderTeam name={names.radiant} logo={logos.radiant} won={match.radiantWin} chips={sideChips("radiant")} align="left" />
      <div className="flex w-[210px] shrink-0 flex-col items-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-300">SPIRIT/CTRL</div>
        <div className="text-[40px] font-black leading-none tabular-nums">
          <span className="text-[var(--pg-radiant)]">{match.radiantScore}</span>
          <span className="text-[var(--pg-muted)]"> – </span>
          <span className="text-[var(--pg-dire)]">{match.direScore}</span>
        </div>
        <div className="mt-1 text-[10px] tabular-nums text-[var(--pg-muted)]">
          ⏱ {clock(match.durationSeconds)}{d ? ` · ${d.toLocaleDateString("ru-RU")}` : ""} · #{match.matchId}
        </div>
      </div>
      <HeaderTeam name={names.dire} logo={logos.dire} won={!match.radiantWin} chips={sideChips("dire")} align="right" />
    </div>
  );
}

// --- Полоса героев: 5+5 портретов с никами, плашки в тонах сторон ---
function Heroes({ radiant, dire }: { radiant: PlayerReport[]; dire: PlayerReport[] }) {
  const group = (list: PlayerReport[], side: Side) => (
    <div
      key={side}
      className={`grid flex-1 grid-cols-5 gap-1 rounded-lg p-1.5 ${
        side === "radiant" ? "bg-[var(--pg-radiant-soft)]" : "bg-[var(--pg-dire-soft)]"
      }`}
    >
      {pad(list, 5).map((p, i) =>
        p ? (
          <div key={i} className="flex min-w-0 flex-col items-center gap-0.5">
            <HeroPortrait hero={p.hero} />
            <span className="w-full truncate text-center text-[10px] font-semibold text-[var(--pg-ink)]">{p.name}</span>
          </div>
        ) : (
          <div key={i} className="aspect-video w-full rounded-md bg-[var(--pg-well)]" />
        ),
      )}
    </div>
  );
  return (
    <div className="flex shrink-0 gap-2">
      {group(radiant, "radiant")}
      {group(dire, "dire")}
    </div>
  );
}

// --- Баны одной строкой: слева Свет, по центру подпись, справа Тьма ---
function Bans({ match }: { match: MatchReport }) {
  const bans = match.picksBans.filter((pb) => !pb.isPick);
  if (bans.length === 0) return null;
  const group = (side: Side) => (
    <div className={`flex items-center gap-0.5 ${side === "dire" ? "justify-end" : ""}`}>
      {bans
        .filter((b) => b.side === side)
        .map((b) => (
          <HeroFrame key={b.order} hero={b.hero} side={side} h={26} banned />
        ))}
    </div>
  );
  return (
    <div className="flex shrink-0 items-center justify-between gap-3">
      {group("radiant")}
      <span className="shrink-0 text-[10px] uppercase tracking-[0.25em] text-[var(--pg-muted)]">Баны</span>
      {group("dire")}
    </div>
  );
}

// --- Карточка игрока: портрет+уровень+KDA, ник и цифры, NET-бар, предметы ---
function PlayerCard({ p, side, tag, maxNet }: { p: PlayerReport; side: Side; tag: string; maxNet: number }) {
  const tint =
    side === "radiant"
      ? "border-[var(--pg-radiant-line)] bg-[var(--pg-radiant-soft)]"
      : "border-[var(--pg-dire-line)] bg-[var(--pg-dire-soft)]";
  const box = (label: string, v: number) => (
    <span key={label} className="rounded bg-[var(--pg-well)] px-1 py-px text-[9px] tabular-nums text-[var(--pg-ink)]">
      <span className="text-[var(--pg-muted)]">{label} </span>
      <span className="font-bold">{v}</span>
    </span>
  );
  return (
    <div className={`flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-lg border p-1 ${tint}`}>
      <div className="flex gap-1.5">
        {/* портрет + уровень */}
        <div className="relative w-12 shrink-0 self-start">
          <HeroPortrait hero={p.hero} />
          <span className="absolute -bottom-1 -left-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--pg-tip)] text-[9px] font-bold tabular-nums text-[var(--pg-gold)] ring-1 ring-[var(--pg-gold-line)]">
            {p.level}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span
              className={`shrink-0 text-[10px] font-black uppercase ${
                side === "radiant" ? "text-[var(--pg-radiant)]" : "text-[var(--pg-dire)]"
              }`}
            >
              {tag}
            </span>
            <span className="truncate text-[12px] font-semibold leading-tight text-[var(--pg-ink)]">{p.name}</span>
            {p.role && <span className="ml-auto shrink-0 text-[8px] uppercase tracking-wide text-[var(--pg-muted)]">{p.role}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 leading-none">
            <span className="text-[10px] font-bold tabular-nums">
              <span className="text-[var(--pg-radiant)]">{p.kills}</span>
              <span className="text-[var(--pg-muted)]">/</span>
              <span className="text-[var(--pg-dire)]">{p.deaths}</span>
              <span className="text-[var(--pg-muted)]">/</span>
              <span className="text-sky-300">{p.assists}</span>
            </span>
            {box("XPM", p.xpm)}
            {box("GPM", p.gpm)}
          </div>
          {/* NET-бар относительно максимума в матче + урон и ЛХ/ДН справа */}
          <div className="mt-1 flex items-center gap-1.5">
            <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded bg-[var(--pg-well)]">
              <div
                className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-amber-600 to-amber-400"
                style={{ width: `${Math.max(5, (p.netWorth / maxNet) * 100)}%` }}
              />
              <span
                className="absolute inset-0 grid place-items-center text-[10px] font-bold leading-none text-white"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,.8)" }}
              >
                {fmt(p.netWorth)}
              </span>
            </div>
            <span className="shrink-0 text-[9px] tabular-nums text-[var(--pg-ink)]">
              <span className="text-[var(--pg-muted)]">УРОН </span>
              {fmt(p.heroDamage)}
            </span>
            <span className="shrink-0 text-[9px] tabular-nums text-[var(--pg-ink)]">
              <span className="text-[var(--pg-muted)]">ЛХ/ДН </span>
              {p.lastHits}/{p.denies}
            </span>
          </div>
        </div>
      </div>
      <ItemsRow p={p} size={14} />
    </div>
  );
}

function TeamColumn({
  players,
  side,
  name,
  logo,
  score,
  tag,
  maxNet,
}: {
  players: PlayerReport[];
  side: Side;
  name: string;
  logo: string | null;
  score: number;
  tag: string;
  maxNet: number;
}) {
  const accent = side === "radiant" ? "text-[var(--pg-radiant)]" : "text-[var(--pg-dire)]";
  const bar = side === "radiant" ? "bg-[var(--pg-radiant)]" : "bg-[var(--pg-dire)]";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex h-[26px] shrink-0 items-center gap-2">
        <span className={`h-5 w-1 rounded ${bar}`} />
        <TeamCrest logo={logo} name={name} size={24} />
        <span className={`truncate text-[14px] font-bold ${accent}`}>{name || (side === "radiant" ? "Свет" : "Тьма")}</span>
        <span className="ml-auto text-[16px] font-black leading-none tabular-nums text-[var(--pg-ink)]">{score}</span>
      </div>
      {players.slice(0, 5).map((p, i) => (
        <PlayerCard key={i} p={p} side={side} tag={tag} maxNet={maxNet} />
      ))}
    </div>
  );
}

// --- Блок 1: сводка матча ---
export function SummaryCanvas({ match, names, tags, logos }: { match: MatchReport; names: Names; tags: Names; logos: Logos }) {
  const radiant = match.players.filter((p) => p.side === "radiant").slice().sort((a, b) => a.pos - b.pos);
  const dire = match.players.filter((p) => p.side === "dire").slice().sort((a, b) => a.pos - b.pos);
  return (
    <Frame>
      <Header match={match} names={names} logos={logos} />
      <Heroes radiant={radiant} dire={dire} />
      <Bans match={match} />
      <div className="flex min-h-0 flex-1 gap-4">
        {/* ширина колонки = сторона карты: под ней ещё легенда и бейджи событий,
            вместе они должны уложиться в высоту ряда (~295px), иначе события срежет */}
        <div className="flex w-[175px] shrink-0 flex-col gap-1.5">
          <div className="w-full">
            <BuildingMap buildings={match.buildings} radiantWin={match.radiantWin} legend={false} />
          </div>
          {/* компактная легенда карты */}
          <div className="flex items-center justify-center gap-3 text-[9px] text-[var(--pg-muted)]">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[var(--pg-radiant)]" />Свет</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[var(--pg-dire)]" />Тьма</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[var(--pg-well-line)]" />уничтожено</span>
          </div>
          <EventBadges events={match.events} tags={tags} size={30} />
        </div>
        <div className="min-w-0 flex-1">
          {/* h подобрана под остаток ряда (~249px) минус легенда графика (~24px) */}
          <AdvantageChart gold={match.goldAdv} xp={match.xpAdv} interactive={false} w={729} h={222} />
        </div>
      </div>
    </Frame>
  );
}

// --- Блок 2: статистика игроков ---
export function PlayersCanvas({ match, names, tags, logos }: { match: MatchReport; names: Names; tags: Names; logos: Logos }) {
  const radiant = match.players.filter((p) => p.side === "radiant").slice().sort((a, b) => a.pos - b.pos);
  const dire = match.players.filter((p) => p.side === "dire").slice().sort((a, b) => a.pos - b.pos);
  const maxNet = Math.max(1, ...match.players.map((p) => p.netWorth));
  return (
    <Frame>
      <div className="flex min-w-0 flex-1 gap-3">
        <TeamColumn players={radiant} side="radiant" name={names.radiant} logo={logos.radiant} score={match.radiantScore} tag={tags.radiant} maxNet={maxNet} />
        <TeamColumn players={dire} side="dire" name={names.dire} logo={logos.dire} score={match.direScore} tag={tags.dire} maxNet={maxNet} />
      </div>
    </Frame>
  );
}

// --- Один блок: превью через студийный Canvas + скачивание и отправка в архив ---
function ExportBlock({
  title,
  kind,
  file,
  meta,
  canArchive,
  children,
}: {
  title: string;
  kind: ShotKind;
  file: string;
  meta: ArchiveDraft;
  canArchive: boolean;
  children: React.ReactNode;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"download" | "archive" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // масштаб превью снимаем на клоне; без явных width/height клон меряется по
  // ужатому bounding box превью и PNG выходит обрезанным. scale ×2 даёт 1920×1080.
  const shoot = () =>
    domToPng(node.current!, { width: EXPORT_W, height: EXPORT_H, scale: EXPORT_SCALE, style: { transform: "none" } });

  async function download() {
    if (!node.current) return;
    setBusy("download");
    try {
      const a = document.createElement("a");
      a.href = await shoot();
      a.download = `${file}.png`;
      a.click();
    } finally {
      setBusy(null);
    }
  }

  // В архив уходит ровно тот же снимок, что и в скачивание — второй раз ничего не пересобираем.
  async function toArchive() {
    if (!node.current) return;
    setBusy("archive");
    setNote(null);
    try {
      const blob = await (await fetch(await shoot())).blob();
      await archiveShot(meta, kind, blob);
      setNote("сохранено — картинка на полке в /match");
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 font-pouf">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-black text-ink">{title}</span>
        <Button type="button" size="sm" loading={busy === "download"} disabled={!!busy} onClick={() => void download()}>
          {busy === "download" ? "Готовлю PNG…" : `Скачать PNG ${EXPORT_W * EXPORT_SCALE}×${EXPORT_H * EXPORT_SCALE}`}
        </Button>
        {/* Архив — операторская полка, посетителю её не показываем (и запись всё равно закрыта паролем). */}
        {canArchive && (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            loading={busy === "archive"}
            disabled={!!busy}
            onClick={() => void toArchive()}
            title="Положить эту картинку в архив выгрузок"
          >
            {busy === "archive" ? "Сохраняю…" : "В архив"}
          </Button>
        )}
        {note && <span className="text-xs font-bold text-muted">{note}</span>}
      </div>
      <div className="h-[42vh] min-h-[240px]">
        <Canvas w={EXPORT_W} h={EXPORT_H} nodeRef={node}>
          {children}
        </Canvas>
      </div>
    </div>
  );
}

// --- Вкладка «Экспорт»: две картинки, каждая скачивается отдельно ---
export function PostgameExport({
  meta,
  canArchive,
  ...props
}: {
  match: MatchReport;
  names: Names;
  tags: Names;
  logos: Logos;
  meta: ArchiveDraft;
  canArchive: boolean;
}) {
  const block = { meta, canArchive };
  return (
    <div className="space-y-5">
      <p className="text-xs font-bold text-muted">
        Две картинки 1920×1080 на общей подложке <code className="text-ink-muted">public/templates/postgame/bg.png</code>.
        Файла нет — под контентом фирменный градиент. Названия команд и лого правятся во вкладке «Отчёт».
        {canArchive && " «В архив» кладёт картинку на полку под полем ввода — там она переживёт и патч Доты, и падение OpenDota."}
      </p>
      <ExportBlock title="Сводка матча" kind="summary" file={`postgame-${props.match.matchId}-summary`} {...block}>
        <SummaryCanvas {...props} />
      </ExportBlock>
      <ExportBlock title="Статистика игроков" kind="players" file={`postgame-${props.match.matchId}-players`} {...block}>
        <PlayersCanvas {...props} />
      </ExportBlock>
    </div>
  );
}
