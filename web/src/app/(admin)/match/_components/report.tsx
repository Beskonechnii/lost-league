"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AdvantageChart,
  BuildingMap,
  EventBadges,
  HeroFrame,
  HeroPortrait,
  Icon,
  ItemsRow,
  TalentTreeMini,
  TeamCrest,
} from "@/app/_components/postgame/blocks";
import { PostgameExport } from "@/app/_components/postgame/export-canvas";
import { VisionMap } from "@/app/_components/postgame/vision-map";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import {
  clock,
  fmt,
  initials,
  kFmt1,
  pad,
  type MatchReport,
  type PickBan,
  type PlayerReport,
  type Side,
  type TalentOpt,
  type TalentTier,
} from "@/app/_components/postgame/types";

// Отчёт по матчу. Всё состояние — в адресе (`/match/<id>?src=&tab=&radiant=&dire=`):
// ссылкой на разбор можно поделиться, и она откроется ровно тем же, что видел отправитель.
// Данные тянутся с клиента через /api/<src>/match/<id> — те же роуты, что и раньше.

// Команда из ростера — для подстановки наших лого/тегов по названию или составу матча.
type RosterTeam = {
  name: string;
  tag: string | null;
  logo: string | null;
  /** Дивизион («Division 1»/«Division 2»): одноимённые команды из разных дивизионов — разные записи. */
  group: string | null;
  /** Состав команды: steam32 → ник из ростера. См. `lineupOf` в src/lib/roster-data.ts. */
  lineup: { accountId: string; nickname: string }[];
};

export type MatchSource = "opendota" | "steam";

// --- Шапка со счётом (блок 1 референса: лого · имя · бейджи | время · счёт · дата | имя · лого) ---
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
  const mono = <TeamCrest logo={logo} name={name} />;
  const nameBlock = (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : ""}`}>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        // В адрес правка уходит по уходу из поля, а не на каждую букву: иначе история
        // браузера засоряется, а каждый символ стоит перерисовки маршрута.
        onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="Название команды"
        className={`w-full bg-transparent text-base font-bold text-ink outline-none placeholder:text-ink-subtle md:text-lg ${
          align === "right" ? "text-right" : ""
        }`}
      />
      <div className={`mt-1 flex flex-wrap items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            won ? "bg-accent text-accent-contrast" : "bg-surface-2 text-ink-muted"
          }`}
        >
          {won ? "Победа" : "Поражение"}
        </span>
        {chips}
      </div>
    </div>
  );
  return (
    <div className="flex flex-1 items-center gap-3">
      {align === "left" ? (
        <>
          {mono}
          {nameBlock}
        </>
      ) : (
        <>
          {nameBlock}
          {mono}
        </>
      )}
    </div>
  );
}

function ScoreHeader({
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
  const chip = (v: number, label: string, cls: string) => (
    <span
      key={label}
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 ${cls}`}
      title={`Итоговое преимущество: ${label}`}
    >
      +{kFmt1(Math.abs(v))} {label}
    </span>
  );
  const sideChips = (side: Side) => (
    <>
      {gold !== 0 && (side === "radiant") === gold > 0 && chip(gold, "золото", "bg-amber-500/15 text-amber-700 ring-amber-500/30")}
      {xp !== 0 && (side === "radiant") === xp > 0 && chip(xp, "опыт", "bg-sky-500/15 text-sky-700 ring-sky-500/30")}
    </>
  );
  const d = match.startTime ? new Date(match.startTime * 1000) : null;
  return (
    <div className="flex items-center gap-3 md:gap-5">
      <TeamSide
        name={names.radiant}
        onName={(v) => setNames((s) => ({ ...s, radiant: v }))}
        onCommit={commitNames}
        logo={logos.radiant}
        won={match.radiantWin}
        chips={sideChips("radiant")}
        align="left"
      />
      <div className="flex shrink-0 flex-col items-center px-2">
        <div className="text-[10px] uppercase tracking-widest text-ink-subtle">⏱ {clock(match.durationSeconds)}</div>
        <div className="text-3xl font-black tabular-nums md:text-4xl">
          <span className="text-emerald-700">{match.radiantScore}</span>
          <span className="text-ink-subtle"> – </span>
          <span className="text-rose-700">{match.direScore}</span>
        </div>
        <div className="text-[10px] text-ink-subtle">
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

// --- Полоса героев (блок 2 референса): 5+5 портретов, под каждым ник ---
function HeroStrip({ radiant, dire }: { radiant: PlayerReport[]; dire: PlayerReport[] }) {
  const group = (list: PlayerReport[], side: Side) => (
    <div
      key={side}
      className={`grid flex-1 grid-cols-5 gap-1.5 rounded-lg p-2 ${side === "radiant" ? "bg-emerald-100" : "bg-rose-100"}`}
    >
      {pad(list, 5).map((p, i) =>
        p ? (
          <div key={i} className="flex min-w-0 flex-col items-center gap-1">
            <HeroPortrait hero={p.hero} />
            <span
              className="w-full truncate text-center text-[11px] font-semibold text-ink"
              title={`${p.name}${p.role ? ` · ${p.role}` : ""}`}
            >
              {p.name}
            </span>
          </div>
        ) : (
          <div key={i} className="aspect-video w-full rounded-md bg-surface-2/40" />
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

// --- Баны (блок 4 референса): одна полоса, кластеры по командам, иконки перечёркнуты ---
function BansStrip({ picksBans }: { picksBans: PickBan[] }) {
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
      <span className="shrink-0 text-[10px] uppercase tracking-widest text-ink-subtle">Баны</span>
      {group("dire")}
    </div>
  );
}

function Draft({ picksBans, names }: { picksBans: PickBan[]; names: { radiant: string; dire: string } }) {
  if (picksBans.length === 0) return null;
  const Row = ({ pb }: { pb: PickBan }) => (
    <div
      className={`flex items-center gap-1.5 rounded border py-0.5 pl-1 pr-1.5 text-[11px] ${
        pb.isPick ? "border-hairline-strong" : "border-hairline opacity-60"
      } ${pb.side === "radiant" ? "text-emerald-700" : "text-rose-700"}`}
    >
      <span className="w-4 shrink-0 text-right tabular-nums text-ink-subtle">{pb.order + 1}.</span>
      <HeroFrame hero={pb.hero} side={pb.side} h={18} banned={!pb.isPick} />
      <span className="truncate">
        {pb.isPick ? "" : "бан "}
        {pb.hero.name}
      </span>
    </div>
  );
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-ink-muted">Пики и баны (по очереди)</div>
      <div className="grid grid-cols-2 gap-4">
        {(["radiant", "dire"] as const).map((side) => (
          <div key={side}>
            <div
              className={`mb-2 truncate text-[11px] font-bold uppercase tracking-wide ${
                side === "radiant" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {(side === "radiant" ? names.radiant : names.dire) || (side === "radiant" ? "Свет" : "Тьма")}
            </div>
            <div className="flex flex-col gap-1">
              {picksBans
                .filter((pb) => pb.side === side)
                .map((pb) => (
                  <Row key={pb.order} pb={pb} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Скорборд карточками (реф 2, панель «Statistics» cyberscore) ---
// Карточка героя в тоне команды: портрет+уровень, тег+ник+роль, XPM/GPM,
// KDA, NET-бар (относительно максимума в матче), урон, ЛХ/ДН, предметы, таланты.
function HeroCard({
  p,
  side,
  tag,
  maxNet,
}: {
  p: PlayerReport;
  side: Side;
  tag: string;
  maxNet: number;
}) {
  const tint =
    side === "radiant"
      ? "border-emerald-200 bg-emerald-100 hover:bg-emerald-100"
      : "border-rose-200 bg-rose-100 hover:bg-rose-100";
  const box = (label: string, v: number) => (
    <span key={label} className="rounded bg-surface-2/70 px-1.5 py-0.5 text-[10px] tabular-nums text-ink">
      <span className="text-ink-subtle">{label} </span>
      <span className="font-bold">{v}</span>
    </span>
  );
  return (
    <div className={`rounded-lg border p-2 transition-colors ${tint}`}>
      <div className="flex items-start gap-2">
        {/* портрет + уровень */}
        <div className="relative w-14 shrink-0">
          <HeroPortrait hero={p.hero} />
          <span
            className="absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-canvas text-[10px] font-bold tabular-nums text-amber-700 ring-1 ring-amber-500/50"
            title={`Уровень ${p.level}`}
          >
            {p.level}
          </span>
        </div>
        {/* тег+ник+роль → XPM/GPM + KDA → NET-бар + опыт + ЛХ/ДН */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className={`shrink-0 text-[10px] font-black uppercase ${side === "radiant" ? "text-emerald-700" : "text-rose-700"}`}>
              {tag}
            </span>
            <span className="truncate text-sm font-semibold text-ink" title={p.name}>
              {p.name}
            </span>
            {p.role && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-ink-subtle">{p.role}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {box("XPM", p.xpm)}
            {box("GPM", p.gpm)}
            <span className="text-[11px] font-semibold tabular-nums" title="Убийства / смерти / помощь">
              <span className="text-ink-subtle">KDA </span>
              <span className="text-emerald-700">{p.kills}</span>
              <span className="text-ink-subtle">/</span>
              <span className="text-rose-700">{p.deaths}</span>
              <span className="text-ink-subtle">/</span>
              <span className="text-sky-700">{p.assists}</span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded bg-surface-2/60" title="Ценность (net worth)">
              <div
                className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-amber-600 to-amber-400"
                style={{ width: `${Math.max(4, (p.netWorth / maxNet) * 100)}%` }}
              />
              <span
                className="absolute inset-0 grid place-items-center text-[10px] font-bold text-white"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,.8)" }}
              >
                {fmt(p.netWorth)}
              </span>
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-ink-muted" title="Урон по героям">
              <span className="text-ink-subtle">УРОН </span>
              {fmt(p.heroDamage)}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-ink-muted" title="Ласт-хиты / денаи">
              <span className="text-ink-subtle">ЛХ/ДН </span>
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
  side: "radiant" | "dire";
  fallback: string;
  teamName: string;
  logo: string | null;
  tag: string;
  maxNet: number;
  players: PlayerReport[];
  score: number;
  won: boolean;
}) {
  const accent = side === "radiant" ? "text-emerald-700" : "text-rose-700";
  const bar = side === "radiant" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="rounded-card bg-surface cushion-card p-3 ">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-4 w-1 rounded ${bar}`} />
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={teamName} className="h-5 w-5 rounded object-contain" />
        )}
        <span className={`truncate text-sm font-bold ${accent}`}>{teamName || fallback}</span>
        {won && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-contrast">
            Победа
          </span>
        )}
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

function CardScoreboard({
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

// Полное дерево талантов в стиле игры: ярусы 25→10, слева/справа стороны,
// в центре золотой кружок уровня, выбранная сторона светится золотом.
function TalentTree({ talents }: { talents: TalentTier[] }) {
  if (talents.length === 0) return null;
  const Side = ({ opt, align }: { opt: TalentOpt | null; align: "left" | "right" }) => (
    <div
      title={opt?.name}
      className={`flex-1 self-stretch px-2 py-1 text-[11px] leading-tight ${align === "right" ? "text-right" : "text-left"} ${
        opt?.picked ? "bg-amber-500/10 font-semibold text-amber-700" : "text-ink-muted"
      }`}
    >
      {opt?.name ?? ""}
    </div>
  );
  return (
    <div className="mb-2">
      <div className="mb-1 text-ink-subtle">Таланты</div>
      <div className="flex flex-col gap-1.5">
        {talents.map((t) => (
          <div
            key={t.heroLevel}
            className="flex items-center overflow-hidden rounded bg-gradient-to-r from-amber-500/5 via-black/30 to-amber-500/5 ring-1 ring-hairline"
          >
            <Side opt={t.left} align="right" />
            <div
              className="grid h-6 w-6 flex-none place-items-center rounded-full bg-canvas text-[11px] font-bold tabular-nums text-amber-700 ring-1 ring-amber-500/40"
              style={{ boxShadow: "0 0 8px rgba(183,154,0,0.5)" }}
            >
              {t.heroLevel}
            </div>
            <Side opt={t.right} align="left" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Доп. информация: скиллы и покупки ---
function PlayerDetails({ p }: { p: PlayerReport }) {
  return (
    <div className="rounded-md border border-hairline bg-surface-1/40 p-3 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <Icon kind="heroes" slug={p.hero.slug} name={p.hero.name} h={22} />
        <span className="font-semibold text-ink">{p.name}</span>
        <span className="text-ink-subtle">
          {p.role} · {p.hero.name}
        </span>
      </div>
      {p.buffs.length > 0 && (
        <div className="mb-2 text-ink-muted">
          Баффы: {p.buffs.map((b) => `${b.name}${b.stacks ? ` ×${b.stacks}` : ""}`).join(", ")}
        </div>
      )}
      <TalentTree talents={p.talents} />
      {p.abilityOrder.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-ink-subtle">Порядок способностей</div>
          <ol className="flex flex-wrap gap-1">
            {p.abilityOrder.map((a, i) => (
              <li key={i} className="flex items-center gap-1 rounded bg-surface-2/70 px-1 py-0.5">
                <span className="text-[10px] text-ink-subtle">{i + 1}</span>
                <Icon kind="abilities" slug={a.slug} name={a.name} h={18} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {p.purchases.length > 0 && (
        <div>
          <div className="mb-1 text-ink-subtle">Покупки (время)</div>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {p.purchases.map((q, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <Icon kind="items" slug={q.slug} name={q.name} h={18} />
                <span className="text-ink-subtle">{clock(q.time)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: "report", label: "Отчёт" },
  { key: "extra", label: "Доп. статистика" },
  { key: "vision", label: "Варды" },
  { key: "export", label: "Экспорт PNG" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const SOURCES: { key: MatchSource; label: string; hint: string }[] = [
  { key: "opendota", label: "OpenDota", hint: "Полный разбор: график золота, тайминги покупок, события, ники" },
  { key: "steam", label: "Steam", hint: "Первоисточник Valve: без графика золота, таймингов покупок, событий и ников" },
];

export function MatchReportView({ matchId, canArchive }: { matchId: string; canArchive: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Источник и вкладка живут в адресе, а не в state: ссылка воспроизводит ровно то, что видел отправитель.
  const src: MatchSource = params.get("src") === "steam" ? "steam" : "opendota";
  const tab: Tab = (TABS.find((t) => t.key === params.get("tab")) ?? TABS[0]).key;

  // Ответ помечен запросом, на который он пришёл (id + источник). Отдельного флага «грузится» нет:
  // пока метка не совпала с текущим адресом — на экране загрузка, а поздний ответ на прошлый
  // запрос просто не совпадёт меткой и ничего не перепишет.
  const key = `${matchId}|${src}`;
  const [data, setData] = useState<{ key: string; match: MatchReport | null; error: string | null }>({
    key: "",
    match: null,
    error: null,
  });
  // Ручные правки названий: печатаются локально, в адрес уходят по уходу из поля (см. TeamSide).
  const [manual, setManual] = useState({ radiant: params.get("radiant") ?? "", dire: params.get("dire") ?? "" });
  const [roster, setRoster] = useState<RosterTeam[]>([]);

  /** Правка адреса без записи в историю: назад из отчёта должно вести на форму, а не на прошлую вкладку. */
  function patchUrl(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Команды лиги — для подстановки наших лого и тегов по названию (наши ассеты приоритетнее OpenDota).
  useEffect(() => {
    fetch("/api/roster/teams")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: RosterTeam[]) => setRoster(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  // Матч грузится по адресу: сменился id или источник — перезапрос.
  useEffect(() => {
    fetch(`/api/${src}/match/${matchId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!json.ok) throw new Error(json.error ?? "Ошибка запроса");
        return json.match as MatchReport;
      })
      .then((match) => setData({ key: `${matchId}|${src}`, match, error: null }))
      .catch((e: unknown) =>
        setData({ key: `${matchId}|${src}`, match: null, error: e instanceof Error ? e.message : String(e) }),
      );
  }, [matchId, src]);

  const loading = data.key !== key;
  const match = loading ? null : data.match;
  const error = loading ? null : data.error;

  // account_id → команды лиги (СПИСОК, а не одна): один человек может стоять в двух составах
  // (играющий за две команды, дубль-ростер). Схлопни его в одну — и распознавание стороны
  // качнётся к случайной из них. Список сохраняем, а неоднозначность разрешаем ниже в `detected`.
  const teamsByAccount = useMemo(() => {
    const m = new Map<string, RosterTeam[]>();
    for (const t of roster) for (const x of t.lineup) m.set(x.accountId, [...(m.get(x.accountId) ?? []), t]);
    return m;
  }, [roster]);

  // account_id → ник из ростера. В клиенте Доты человек может называться как угодно и менять имя
  // между матчами; в лиге у него одно имя, и во всех наших разделах должно стоять именно оно.
  // Неузнанный игрок (стендин, чужой матч) остаётся под своим именем из OpenDota.
  const nickByAccount = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of roster) for (const x of t.lineup) m.set(x.accountId, x.nickname);
    return m;
  }, [roster]);

  /** Отчёт с подменёнными на ростерные никами — дальше всё рисуется по нему. */
  const withRosterNames = (list: PlayerReport[]) =>
    list.map((p) => {
      const nick = p.accountId != null ? nickByAccount.get(String(p.accountId)) : undefined;
      return nick && nick !== p.name ? { ...p, name: nick } : p;
    });

  // Команды обеих сторон распознаём СОВМЕСТНО, а не каждую по отдельности argmax'ом — иначе
  // дубль-ростерный игрок тянет сторону к своей второй команде (классика: игрок 300$, стоящий
  // ещё и в U.S.Burgers, переголосовывал 300$ в «Бургеров»). Два ключа устойчивости:
  //   • solid — сколько на стороне игроков, состоящих ТОЛЬКО в этой команде; они и есть истина,
  //     дубль-ростерные лишь поддерживают. Ранжируем по (solid, затем всего), порог — двое своих;
  //   • назначаем жадно от самой уверенной стороны и запрещаем одну команду обеим сторонам —
  //     стендин из чужой команды (один голос) команду перебить не может.
  const detected = useMemo((): { radiant: RosterTeam | null; dire: RosterTeam | null } => {
    const rank = (players: PlayerReport[]) => {
      const score = new Map<RosterTeam, number>();
      const solid = new Map<RosterTeam, number>();
      for (const p of players) {
        const ts = p.accountId != null ? teamsByAccount.get(String(p.accountId)) : undefined;
        if (!ts?.length) continue;
        for (const t of ts) score.set(t, (score.get(t) ?? 0) + 1);
        if (ts.length === 1) solid.set(ts[0], (solid.get(ts[0]) ?? 0) + 1);
      }
      return [...score.entries()]
        .map(([t, n]) => ({ t, n, solid: solid.get(t) ?? 0 }))
        .filter((x) => x.n >= 2)
        .sort((a, b) => b.solid - a.solid || b.n - a.n);
    };
    const rRank = rank(match?.players.filter((p) => p.side === "radiant") ?? []);
    const dRank = rank(match?.players.filter((p) => p.side === "dire") ?? []);
    const rTop = rRank[0], dTop = dRank[0];
    // Вторую сторону выбираем после первой: исключаем занятую команду, а среди равных по (solid, n)
    // предпочитаем ТОТ ЖЕ ДИВИЗИОН, что у соперника. Так ReMix D1 и ReMix D2 не путаются: если по
    // составу вышла ничья двух одноимённых команд, дивизион уже определён другой стороной матча.
    const pickOther = (ranked: typeof rRank, taken: RosterTeam | null): RosterTeam | null => {
      const avail = ranked.filter((x) => x.t !== taken);
      if (!avail.length) return null;
      const best = avail[0];
      const tied = avail.filter((x) => x.solid === best.solid && x.n === best.n);
      return ((taken && tied.find((x) => x.t.group === taken.group)) ?? best).t;
    };
    // Первой фиксируем более уверенную сторону (по solid, затем по числу своих).
    const radiantFirst = !dTop || (!!rTop && (rTop.solid > dTop.solid || (rTop.solid === dTop.solid && rTop.n >= dTop.n)));
    if (radiantFirst) {
      const radiant = rTop?.t ?? null;
      return { radiant, dire: pickOther(dRank, radiant) };
    }
    const dire = dTop?.t ?? null;
    return { dire, radiant: pickOther(rRank, dire) };
  }, [teamsByAccount, match]);

  const radiant = withRosterNames((match?.players.filter((p) => p.side === "radiant") ?? []).slice().sort((a, b) => a.pos - b.pos));
  const dire = withRosterNames((match?.players.filter((p) => p.side === "dire") ?? []).slice().sort((a, b) => a.pos - b.pos));
  const byPos = [...radiant, ...dire];

  // Итоговые названия сторон — производные (не в state), поэтому распознавание срабатывает и когда
  // ростер догрузился после матча: ручной ввод → команда по составу → название из OpenDota → пусто.
  const names = {
    radiant: manual.radiant || detected.radiant?.name || match?.radiantTeam || "",
    dire: manual.dire || detected.dire?.name || match?.direTeam || "",
  };
  const setNames = (u: (s: { radiant: string; dire: string }) => { radiant: string; dire: string }) =>
    setManual((m) => u({ radiant: m.radiant, dire: m.dire }));
  const commitNames = () => patchUrl({ radiant: manual.radiant || null, dire: manual.dire || null });

  // Команда лиги по введённому названию (или тегу) — без учёта регистра.
  const fromRoster = (name: string): RosterTeam | null => {
    const q = name.trim().toLowerCase();
    if (!q) return null;
    return roster.find((t) => t.name.toLowerCase() === q || (t.tag ?? "").toLowerCase() === q) ?? null;
  };
  // Лого и тег берём у РАСПОЗНАННОГО объекта команды, а не ищем заново по имени: две команды из
  // разных дивизионов могут называться одинаково (ReMix в D1 и D2 — разные записи, разные лого),
  // и поиск по строке «ReMix» взял бы первую попавшуюся. Ручной ввод имени резолвим по названию.
  const rosterTeams = {
    radiant: manual.radiant ? fromRoster(manual.radiant) : detected.radiant ?? fromRoster(names.radiant),
    dire: manual.dire ? fromRoster(manual.dire) : detected.dire ?? fromRoster(names.dire),
  };
  // Лого: наш ассет по названию → лого OpenDota → монограмма (в TeamCrest).
  const logos = {
    radiant: rosterTeams.radiant?.logo ?? match?.radiantLogo ?? null,
    dire: rosterTeams.dire?.logo ?? match?.direLogo ?? null,
  };
  // Теги команд для бейджей и карточек: ростер → OpenDota → инициалы введённого имени.
  const tags = {
    radiant: (rosterTeams.radiant?.tag || match?.radiantTag || initials(names.radiant || "Свет")).slice(0, 4),
    dire: (rosterTeams.dire?.tag || match?.direTag || initials(names.dire || "Тьма")).slice(0, 4),
  };
  // Максимум net worth в матче — база для NET-баров карточек.
  const maxNet = Math.max(1, ...(match?.players.map((p) => p.netWorth) ?? [1]));

  return (
    <main className="flex-1 px-4 py-8 font-pouf md:px-6">
      <div className={`mx-auto w-full ${SITE_MAX_W} space-y-4`}>
        {/* Шапка отчёта: возврат к форме, номер матча и переключатель источника. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 cushion-card">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/match"
              title="К вводу другого матча"
              className="rounded-[12px] bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted cushion-field transition-colors hover:text-[var(--accent-ink)]"
            >
              ← Другой матч
            </Link>
            <h1 className="truncate text-lg font-black uppercase tracking-[-0.3px] text-ink md:text-xl">
              Postgame <span className="tabular-nums text-ink-subtle">#{matchId}</span>
            </h1>
            {match && !match.parsed && (
              <span className="text-[11px] font-bold text-amber-700" title="OpenDota ещё не разобрала реплей">
                ⚠ не распарсен
              </span>
            )}
          </div>
          {/* Источник — часть адреса: «почему тут пустой график» видно и в ссылке, и в интерфейсе. */}
          <div className="flex gap-1.5">
            {SOURCES.map((s) => (
              <button
                key={s.key}
                onClick={() => patchUrl({ src: s.key === "opendota" ? null : s.key })}
                title={s.hint}
                className={`rounded-[14px] px-3.5 py-[7px] text-xs font-black transition-[box-shadow,transform,background] ${
                  src === s.key ? "bg-accent-fill text-[var(--on-accent)] cushion-control-active [transform:translateY(1px)]" : "bg-surface text-ink-subtle cushion-field hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <p className="rounded-control bg-surface px-3 py-2 text-sm font-bold text-muted cushion-field">
            Загружаю матч из {src === "steam" ? "Steam" : "OpenDota"}…
          </p>
        )}

        {error && (
          <div className="rounded-control bg-warn px-3 py-2 text-sm font-bold text-[var(--on-accent)]">
            {error}
            {/* Второй источник живёт независимо: когда OpenDota лежит, разбор всё равно соберётся. */}
            <button
              onClick={() => patchUrl({ src: src === "opendota" ? "steam" : null })}
              className="ml-3 rounded-[10px] bg-[rgba(255,255,255,0.45)] px-2 py-0.5 text-xs font-black text-[var(--on-accent)] hover:bg-[rgba(255,255,255,0.7)]"
            >
              Попробовать {src === "opendota" ? "Steam" : "OpenDota"}
            </button>
          </div>
        )}

        {match && (
          <>
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => patchUrl({ tab: t.key === "report" ? null : t.key })}
                  className={`rounded-[14px] px-4 py-[9px] text-[13px] font-black transition-[box-shadow,transform,background] ${
                    tab === t.key
                      ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
                      : "bg-surface text-ink-muted cushion-field hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "report" && (
              <>
                {/* Блок 1 — сводка матча единым блоком (по референсу):
                    шапка → герои → баны → низ: карта строений + события | график преимущества */}
                <div className="divide-y divide-hairline overflow-hidden rounded-card bg-surface cushion-card ">
                  <div className="p-3 md:p-4">
                    <ScoreHeader match={match} names={names} setNames={setNames} commitNames={commitNames} logos={logos} />
                  </div>
                  <div className="p-3">
                    <HeroStrip radiant={radiant} dire={dire} />
                  </div>
                  <div className="px-3 py-2">
                    <BansStrip picksBans={match.picksBans} />
                  </div>
                  {/* карта — узкая фиксированная колонка, график забирает всю остальную ширину */}
                  <div className="grid gap-4 p-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <BuildingMap buildings={match.buildings} radiantWin={match.radiantWin} />
                      <EventBadges events={match.events} tags={tags} />
                    </div>
                    {match.goldAdv.length >= 2 && (
                      <div className="min-w-0">
                        <AdvantageChart gold={match.goldAdv} xp={match.xpAdv} />
                      </div>
                    )}
                  </div>
                </div>

                <CardScoreboard
                  radiant={radiant}
                  dire={dire}
                  names={names}
                  logos={logos}
                  tags={tags}
                  maxNet={maxNet}
                  radiantScore={match.radiantScore}
                  direScore={match.direScore}
                  radiantWin={match.radiantWin}
                />
              </>
            )}

            {tab === "extra" && (
              <>
                <div className="rounded-card bg-surface cushion-card p-4 ">
                  <div className="mb-3 text-sm font-medium text-ink-muted">Скиллы и покупки (по игрокам)</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {byPos.map((p, i) => (
                      <PlayerDetails key={i} p={p} />
                    ))}
                  </div>
                </div>
                <div className="rounded-card bg-surface cushion-card p-4 ">
                  <Draft picksBans={match.picksBans} names={names} />
                </div>
              </>
            )}

            {tab === "vision" && (
              match.wards?.length ? (
                <VisionMap wards={match.wards} durationSeconds={match.durationSeconds} sideLabels={names} />
              ) : (
                <div className="rounded-card bg-surface p-6 text-center text-sm font-bold text-muted cushion-card">
                  Расстановка вардов доступна только у распарсенных матчей OpenDota.
                  {src === "steam" && " Переключитесь на источник OpenDota."}
                </div>
              )
            )}

            {tab === "export" && (
              <div className="rounded-card bg-surface p-4 cushion-card">
                {/* В архив уходит подпись ровно с теми названиями, что нарисованы на картинке. */}
                <PostgameExport
                  match={match}
                  names={names}
                  tags={tags}
                  logos={logos}
                  canArchive={canArchive}
                  meta={{
                    matchId: match.matchId,
                    source: src,
                    radiant: names.radiant || "Свет",
                    dire: names.dire || "Тьма",
                    radiantScore: match.radiantScore,
                    direScore: match.direScore,
                    radiantWin: match.radiantWin,
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
