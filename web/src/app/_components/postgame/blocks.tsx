"use client";

// Общие блоки постгейм-отчёта: иконки, инвентарь, таланты, график преимущества,
// карта строений и бейджи событий. Их рендерят и страница матча (адаптивная),
// и экспортный холст (фиксированные пиксели) — поэтому здесь нет media-брейкпоинтов:
// при снятии PNG media-query могут пересчитаться и сломать раскладку.
//
// Цвета блоки не выбирают: всё, что не иконка Доты, нарисовано на `var(--pg-*)`.
// Экранная (светлая) кожа объявлена в `globals.css`, тёмная кожа выгрузки —
// в `skin.ts`, её вешает на свою рамку экспортный холст. Так один и тот же
// компонент светел на сайте и тёмен на картинке, и сайт не носит тёмную тему.

import { useState, type MouseEvent } from "react";
import { assetUrl, assetFallback, type AssetKind } from "@/lib/assets";
import {
  clock,
  fmt,
  initials,
  kFmt,
  niceCeil,
  pad,
  type Entity,
  type Lane,
  type MatchEvents,
  type MatchReport,
  type PlayerReport,
  type Side,
  type TalentOpt,
  type TalentTier,
} from "./types";

// Иконка ассета. src — локальный /assets/…; при 404 один раз пробуем CDN Valve, потом прячем.
export function Icon({ kind, slug, name, h = 24, className = "" }: { kind: AssetKind; slug: string; name: string; h?: number; className?: string }) {
  if (!slug) return null;
  return (
    // крошечные иконки-спрайты + фолбэк на внешний CDN — next/image здесь избыточен
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetUrl(kind, slug)}
      alt={name}
      title={name}
      loading="lazy"
      style={{ height: h, width: "auto" }}
      onError={(e) => {
        const img = e.currentTarget;
        const fb = assetFallback(kind, slug);
        if (!img.src.endsWith(fb)) img.src = fb;
        else img.style.visibility = "hidden";
      }}
      className={`inline-block shrink-0 rounded-sm ring-1 ring-[var(--pg-ring)] ${className}`}
    />
  );
}

// Рамка вокруг иконки героя для бана/пика: аккуратная карточка вместо голой иконки на пустом фоне.
// banned — приглушает и перечёркивает (бан), иначе просто тонированная по стороне рамка (пик).
export function HeroFrame({
  hero,
  side,
  h = 22,
  banned = false,
  title,
  className = "",
}: {
  hero: Entity;
  side: Side;
  h?: number;
  banned?: boolean;
  title?: string;
  className?: string;
}) {
  const tint =
    side === "radiant"
      ? "border-[var(--pg-radiant-line)] bg-[var(--pg-radiant-soft)]"
      : "border-[var(--pg-dire-line)] bg-[var(--pg-dire-soft)]";
  return (
    <div title={title ?? hero.name} className={`relative inline-flex shrink-0 rounded-md border p-0.5 ${tint} ${className}`}>
      <Icon kind="heroes" slug={hero.slug} name={hero.name} h={h} className={`!ring-0 ${banned ? "opacity-55 grayscale" : ""}`} />
      {banned && (
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center font-black text-[var(--pg-dire)]"
          // крестик тянется за размером иконки, иначе на крупных банах он теряется
          style={{ fontSize: Math.round(h * 0.5), lineHeight: 1, textShadow: "0 1px 2px rgba(0,0,0,.55)" }}
        >
          ✕
        </span>
      )}
    </div>
  );
}

// Портрет героя во всю ширину колонки (у скорборда своя раскладка, не Icon).
export function HeroPortrait({ hero, dim }: { hero: Entity; dim?: boolean }) {
  if (!hero.slug) return <div className="aspect-video w-full rounded-md bg-[var(--pg-well)]" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetUrl("heroes", hero.slug)}
      alt={hero.name}
      title={hero.name}
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        const fb = assetFallback("heroes", hero.slug);
        if (!img.src.endsWith(fb)) img.src = fb;
        else img.style.opacity = "0";
      }}
      className={`block w-full rounded-md ring-1 ring-[var(--pg-ring)] ${dim ? "opacity-60 grayscale" : ""}`}
    />
  );
}

// Герб команды: лого (из ростера или OpenDota), при отсутствии/ошибке — монограмма-заглушка.
export function TeamCrest({ logo, name, size = 44 }: { logo: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (logo && !broken)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        title={name}
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-lg object-contain ring-1 ring-[var(--pg-ring)]"
      />
    );
  return (
    <div
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.32),
        background: "var(--pg-crest)",
        color: "var(--pg-crest-ink)",
      }}
      className="grid shrink-0 place-items-center rounded-lg font-black shadow"
    >
      {initials(name)}
    </div>
  );
}

// Слот предмета фиксированного размера: иконка либо пустая ячейка (item-иконки ~4:3).
export function ItemSlot({ item, h, className = "" }: { item: Entity | null; h: number; className?: string }) {
  if (!item || !item.slug)
    return (
      <div
        style={{ height: h, width: Math.round(h * 1.35) }}
        className="rounded-sm bg-[var(--pg-well)] ring-1 ring-inset ring-[var(--pg-well-line)]"
      />
    );
  return <Icon kind="items" slug={item.slug} name={item.name} h={h} className={className} />;
}

// Инвентарь в одну строку: 6 базовых | 3 рюкзака | нейтрал | Аганим · Шард (секции разделены).
// size — высота базовой иконки: страница рендерит 22, экспортный холст — компактнее.
export function ItemsRow({ p, size = 22 }: { p: PlayerReport; size?: number }) {
  const base = pad(p.items, 6);
  const back = pad(p.backpack, 3);
  const small = Math.max(10, Math.round(size * 0.72));
  const neutral = p.neutral && p.neutral.slug ? p.neutral : null;
  const sep = "border-l border-[var(--pg-line)] pl-1.5";
  return (
    <div className="flex items-center gap-1.5">
      {/* 6 базовых */}
      <div className="flex gap-0.5">
        {base.map((it, i) => (
          <ItemSlot key={i} item={it} h={size} />
        ))}
      </div>
      {/* рюкзак (3) */}
      <div className={`flex gap-0.5 ${sep}`}>
        {back.map((it, i) => (
          <ItemSlot key={i} item={it} h={small} />
        ))}
      </div>
      {/* нейтральный предмет */}
      <div className={sep}>
        {neutral ? (
          <Icon kind="items" slug={neutral.slug} name={neutral.name} h={size} className="!rounded-full !ring-[var(--pg-gold-line)]" />
        ) : (
          <div style={{ width: size, height: size }} className="rounded-full bg-[var(--pg-well)] ring-1 ring-inset ring-[var(--pg-gold-line)]" />
        )}
      </div>
      {/* Аганим (скипетр) + Шард — подсвечены при наличии */}
      <div className={`flex gap-1 ${sep}`}>
        <Icon
          kind="items"
          slug="ultimate_scepter"
          name="Аганим (скипетр)"
          h={small}
          className={p.hasScepter ? "!ring-fuchsia-500/70" : "opacity-20 grayscale"}
        />
        <Icon
          kind="items"
          slug="aghanims_shard"
          name="Аганим (шард)"
          h={small}
          className={p.hasShard ? "!ring-sky-500/70" : "opacity-20 grayscale"}
        />
      </div>
    </div>
  );
}

// Компактное дерево талантов для строки: 4 яруса (25→10), лево | уровень | право.
// Позиции лево/право — как в игре; выбранная сторона золотая. Полный текст — в подсказке.
export function TalentTreeMini({ talents }: { talents: TalentTier[] }) {
  if (talents.length === 0) return <div className="text-center text-[10px] text-[var(--pg-muted)]">—</div>;
  const cell = (opt: TalentOpt | null, lvl: number, side: string) => (
    <span
      title={opt ? `${lvl} ур. (${side}): ${opt.name}` : undefined}
      className={`h-2.5 w-3 rounded-[2px] ${
        opt?.picked ? "bg-[var(--pg-gold)] ring-1 ring-[var(--pg-gold-line)]" : "bg-[var(--pg-well)]"
      }`}
    />
  );
  return (
    <div className="mx-auto flex w-fit flex-col gap-0.5">
      {talents.map((t) => (
        <div key={t.heroLevel} className="flex items-center gap-0.5">
          {cell(t.left, t.heroLevel, "лево")}
          <span className="w-3.5 text-center text-[8px] tabular-nums text-[var(--pg-muted)]">{t.heroLevel}</span>
          {cell(t.right, t.heroLevel, "право")}
        </div>
      ))}
    </div>
  );
}

// Интерактивный график преимущества: золото (заливка + линия) и опыт (пунктир), общая шкала.
// Ось Y слева подписана значениями золота (верх — Свет, низ — Тьма), по X — тики времени.
// Наведение → вертикальный курсор с золотом/опытом на этой минуте.
// interactive={false} — статичный вариант для экспорта в PNG (без hover-состояний).
// w/h задают viewBox: экспорт подбирает пропорции под свой холст.
export function AdvantageChart({
  gold,
  xp,
  interactive = true,
  w = 660,
  h = 200,
}: {
  gold: number[];
  xp: number[];
  interactive?: boolean;
  w?: number;
  h?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = gold.length;
  if (n < 2) return null;
  const hasXp = xp.length === n;
  const W = w,
    H = h,
    padL = 46,
    padR = 10,
    padT = 12,
    padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const mid = padT + plotH / 2;
  const maxAbs = Math.max(1, ...gold.map(Math.abs), ...(hasXp ? xp.map(Math.abs) : []));
  const top = niceCeil(maxAbs);
  const x = (i: number) => padL + (i / (n - 1)) * plotW;
  const y = (v: number) => mid - (v / top) * (plotH / 2);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const goldLine = path(gold);
  const xpLine = hasXp ? path(xp) : "";
  const area = `${goldLine} L${x(n - 1).toFixed(1)},${mid} L${padL},${mid} Z`;
  const yTicks = [top, top / 2, 0, -top / 2, -top];
  const xStep = Math.max(1, Math.round((n - 1) / 6)); // ~6 подписей времени
  // Цвет по лидеру: верхняя половина (Свет) — зелёный, нижняя (Тьма) — красный.
  // Значения — из кожи, а не литералами: на бумаге и на тёмной картинке они разные.
  const EMERALD = "var(--pg-radiant)";
  const ROSE = "var(--pg-dire)";

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((svgX - padL) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--pg-muted)]">
        <span>Преимущество по минутам</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-[var(--pg-ink)]" />золото
          </span>
          {hasXp && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0 w-4 border-t border-dashed border-[var(--pg-muted)]" />опыт
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-[var(--pg-radiant)]" />Свет
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-[var(--pg-dire)]" />Тьма
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none overflow-hidden rounded-lg"
        onMouseMove={interactive ? onMove : undefined}
        onMouseLeave={interactive ? () => setHover(null) : undefined}
      >
        <defs>
          <linearGradient id="adv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pg-radiant)" stopOpacity="0.3" />
            <stop offset="50%" stopColor="var(--pg-muted)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--pg-dire)" stopOpacity="0.3" />
          </linearGradient>
          {/* верх/низ графика — для двухцветной линии (лидирует Свет / Тьма) */}
          <clipPath id="advTop">
            <rect x={padL} y={padT - 2} width={plotW} height={plotH / 2 + 2} />
          </clipPath>
          <clipPath id="advBot">
            <rect x={padL} y={mid} width={plotW} height={plotH / 2 + 2} />
          </clipPath>
        </defs>
        {/* Никакой подложки-картинки: поле графика — просто затемнение с тонкой рамкой,
            чтобы плот отделялся от фона карточки и не спорил с линиями (реф — блок graph). */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="var(--pg-plot)"
          stroke="var(--pg-grid)"
          strokeWidth="0.5"
        />
        {/* сетка + подписи оси Y (без минуса: верх — Свет, низ — Тьма) */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              y1={y(v)}
              x2={W - padR}
              y2={y(v)}
              stroke={v === 0 ? "var(--pg-zero)" : "var(--pg-grid)"}
              strokeWidth={v === 0 ? 1 : 0.5}
              strokeDasharray={v === 0 ? "4 4" : undefined}
            />
            <text
              x={padL - 6}
              y={y(v) + 3}
              textAnchor="end"
              fill={v > 0 ? "var(--pg-radiant)" : v < 0 ? "var(--pg-dire)" : "var(--pg-muted)"}
              style={{ fontSize: 9 }}
            >
              {kFmt(Math.abs(v))}
            </text>
          </g>
        ))}
        {/* тики времени по X */}
        {Array.from({ length: n }, (_, i) => i)
          .filter((i) => i % xStep === 0 || i === n - 1)
          .map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fill="var(--pg-muted)" style={{ fontSize: 9 }}>
              {clock(i * 60)}
            </text>
          ))}
        <path d={area} fill="url(#adv)" />
        {/* линии рисуются дважды с клипом по половинам: над нулём — зелёные, под — красные */}
        {hasXp && (
          <>
            <path d={xpLine} clipPath="url(#advTop)" fill="none" stroke={EMERALD} strokeWidth="1.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.8" />
            <path d={xpLine} clipPath="url(#advBot)" fill="none" stroke={ROSE} strokeWidth="1.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.8" />
          </>
        )}
        <path d={goldLine} clipPath="url(#advTop)" fill="none" stroke={EMERALD} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={goldLine} clipPath="url(#advBot)" fill="none" stroke={ROSE} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {/* курсор наведения */}
        {interactive && hover != null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB} stroke="var(--pg-muted)" strokeWidth="0.6" />
            <circle cx={x(hover)} cy={y(gold[hover])} r="2.6" fill={gold[hover] >= 0 ? EMERALD : ROSE} />
            {hasXp && <circle cx={x(hover)} cy={y(xp[hover])} r="2.4" fill={xp[hover] >= 0 ? EMERALD : ROSE} />}
            {/* тултип: без минусов — цвет говорит, кто ведёт */}
            <g transform={`translate(${Math.min(x(hover) + 6, W - 128)}, ${padT + 4})`}>
              <rect width="122" height={hasXp ? 46 : 32} rx="4" fill="var(--pg-tip)" stroke="var(--pg-zero)" strokeWidth="0.5" />
              <text x="8" y="14" fill="var(--pg-tip-ink)" style={{ fontSize: 9 }}>
                {`${hover} мин`}
              </text>
              <text x="8" y="27" style={{ fontSize: 9 }} fill={gold[hover] >= 0 ? "var(--pg-radiant)" : "var(--pg-dire)"}>
                {`золото ${fmt(Math.abs(gold[hover]))}`}
              </text>
              {hasXp && (
                <text x="8" y="40" style={{ fontSize: 9 }} fill={xp[hover] >= 0 ? "var(--pg-radiant)" : "var(--pg-dire)"}>
                  {`опыт ${fmt(Math.abs(xp[hover]))}`}
                </text>
              )}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

// --- Карта строений: миникарта из игры + иконки строений (как на OpenDota) ---
// Подложка — public/assets/map/minimap.jpg (это detailed_740.jpg из odota/web, свет — низ-лево),
// иконки — оттуда же: {good,bad}guys_{tower,rax,fort}[_angle].png.
// Координаты — дословная копия odota/web BuildingMap/buildingData733.ts: доля карты до ЛЕВОГО
// ВЕРХНЕГО угла иконки (не до центра). Пары «сверху, слева» в процентах.
// Пересчитывать в центры нельзя — расстановка должна совпадать с референсом один в один.
const TOWER_POS: Record<Side, Record<Lane, Record<1 | 2 | 3, [number, number]>>> = {
  radiant: {
    top: { 1: [36, 9.5], 2: [53, 9], 3: [68, 8] },
    mid: { 1: [54, 38], 2: [63, 27.5], 3: [71.5, 18.5] },
    bot: { 1: [82, 75], 2: [85, 46], 3: [83.5, 23] },
  },
  dire: {
    top: { 1: [12, 18], 2: [11, 49], 3: [12.5, 70] },
    mid: { 1: [43.5, 51], 2: [33, 64], 3: [24, 73] },
    bot: { 1: [60, 84], 2: [45, 85], 3: [28, 85.5] },
  },
};
// Казармы: +1% к «сверху» относительно таблицы odota. Это не правка на глаз — у них иконка
// лежит в инлайновом span и садится на базовую линию строки, из-за чего всё, что ниже строки
// (12px казарм против ~15px базовой линии), уезжает вниз на 3px от 300px карты. Вышки (16px)
// и трон (25px) в строку помещаются и не смещаются. Мы позиционируем абсолютно — вносим руками.
const RACK_POS: Record<Side, Record<Lane, { ranged: [number, number]; melee: [number, number] }>> = {
  radiant: {
    top: { ranged: [71.5, 6.5], melee: [71.5, 10.5] },
    mid: { ranged: [73, 15], melee: [75.5, 18] },
    bot: { ranged: [81.5, 20], melee: [85.5, 20] },
  },
  dire: {
    top: { ranged: [11, 74], melee: [15, 74] },
    mid: { ranged: [20.5, 74.5], melee: [23, 77.5] },
    bot: { ranged: [25, 84], melee: [25, 88] },
  },
};
// Вышки 4-го тира у трона (в битмаске Valve — «ancient top/bottom») и сам трон.
const ANCIENT_POS: Record<Side, { top: [number, number]; bottom: [number, number] }> = {
  radiant: { top: [79, 8], bottom: [82, 12] },
  dire: { top: [13, 81], bottom: [16, 84] },
};
const FORT_POS: Record<Side, [number, number]> = { radiant: [83, 5], dire: [9, 84] };
// Размер иконки в долях карты: у odota он задан в пикселях на карте 300px.
const ICON_SIZE = { tower: (16 / 300) * 100, rax: (12 / 300) * 100, fort: (25 / 300) * 100 };

// legend={false} — экспортный холст рисует свою (компактную) легенду сам.
// radiantWin нужен только для трона: в битмасках его нет, целым рисуем трон победителя.
export function BuildingMap({
  buildings,
  radiantWin,
  legend = true,
}: {
  buildings: MatchReport["buildings"];
  radiantWin?: boolean;
  legend?: boolean;
}) {
  type MapIcon = { key: string; kind: keyof typeof ICON_SIZE; angle: boolean; side: Side; alive: boolean; top: number; left: number; title: string };
  const LANE_RU: Record<Lane, string> = { top: "верх", mid: "центр", bot: "низ" };
  const icons: MapIcon[] = [];
  for (const side of ["radiant", "dire"] as Side[]) {
    const b = buildings[side];
    const who = side === "radiant" ? "Свет" : "Тьма";
    for (const t of b.towers) {
      const [top, left] = TOWER_POS[side][t.lane][t.tier];
      icons.push({
        key: `${side}-tw-${t.lane}-${t.tier}`,
        kind: "tower",
        angle: t.lane === "mid",
        side,
        alive: t.alive,
        top,
        left,
        title: `${who} · ${LANE_RU[t.lane]} T${t.tier}${t.alive ? "" : " (уничтожена)"}`,
      });
    }
    for (const k of ["top", "bottom"] as const) {
      const [top, left] = ANCIENT_POS[side][k];
      icons.push({
        key: `${side}-t4-${k}`,
        kind: "tower",
        angle: false,
        side,
        alive: b.ancient[k],
        top,
        left,
        title: `${who} · вышка T4 у трона${b.ancient[k] ? "" : " (уничтожена)"}`,
      });
    }
    for (const r of b.racks) {
      const p = RACK_POS[side][r.lane];
      icons.push({
        key: `${side}-rax-r-${r.lane}`,
        kind: "rax",
        angle: r.lane === "mid",
        side,
        alive: r.ranged,
        top: p.ranged[0],
        left: p.ranged[1],
        title: `${who} · ${LANE_RU[r.lane]} казармы (дальние)${r.ranged ? "" : " — уничтожены"}`,
      });
      icons.push({
        key: `${side}-rax-m-${r.lane}`,
        kind: "rax",
        angle: r.lane === "mid",
        side,
        alive: r.melee,
        top: p.melee[0],
        left: p.melee[1],
        title: `${who} · ${LANE_RU[r.lane]} казармы (ближние)${r.melee ? "" : " — уничтожены"}`,
      });
    }
    // Трон: победитель — целый, проигравший — разрушенный. Без счёта считаем оба целыми.
    const fortAlive = radiantWin === undefined ? true : (side === "radiant") === radiantWin;
    const [ft, fl] = FORT_POS[side];
    icons.push({
      key: `${side}-fort`,
      kind: "fort",
      angle: false,
      side,
      alive: fortAlive,
      top: ft,
      left: fl,
      title: `Трон · ${who}${fortAlive ? "" : " (разрушен)"}`,
    });
  }
  return (
    <div>
      {legend && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--pg-muted)]">Строения</span>
          <span className="flex items-center gap-3 text-[10px] font-bold text-[var(--pg-muted)]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-[var(--pg-radiant)]" />Свет
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-[var(--pg-dire)]" />Тьма
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-[var(--pg-well-line)]" />уничтожено
            </span>
          </span>
        </div>
      )}
      <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-lg ring-1 ring-[var(--pg-ring)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/map/minimap.jpg" alt="Карта Dota 2" className="absolute inset-0 h-full w-full object-cover" />
        {icons.map((ic) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={ic.key}
            src={`/assets/map/${ic.side === "radiant" ? "good" : "bad"}guys_${ic.kind}${ic.angle ? "_angle" : ""}.png`}
            alt=""
            title={ic.title}
            className="absolute"
            style={{
              top: `${ic.top}%`,
              left: `${ic.left}%`,
              width: `${ICON_SIZE[ic.kind]}%`,
              // как в odota: целое — контрастнее, разрушенное — обесцвечено и притушено
              filter: ic.alive ? "contrast(150%)" : "grayscale(100%) brightness(70%)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// --- Бейджи событий (FB / FT / R + наш C — курьеры) ---
// Круг в цвете стороны, взявшей событие; под ним тег команды; детали — в подсказке.
export function EventBadges({ events, tags, size = 32 }: { events: MatchEvents; tags: { radiant: string; dire: string }; size?: number }) {
  const { firstBlood, firstTower, roshan, couriers } = events;
  const list: { label: string; hint: string; side: Side | null; title: string }[] = [];
  if (firstBlood)
    list.push({
      label: "FB",
      hint: "Первая кровь",
      side: firstBlood.side,
      title: `${firstBlood.killer ? `${firstBlood.killer.name} (${firstBlood.killer.hero.name})` : tags[firstBlood.side]} · ${clock(firstBlood.time)}`,
    });
  if (firstTower)
    list.push({
      label: "FT",
      hint: "Первая вышка",
      side: firstTower.side,
      title: `${firstTower.killer ? `${firstTower.killer.name} (${firstTower.killer.hero.name})` : tags[firstTower.side]} · ${clock(firstTower.time)}`,
    });
  if (roshan.kills.length > 0) {
    const side: Side =
      roshan.radiant === roshan.dire
        ? roshan.kills[roshan.kills.length - 1].side
        : roshan.radiant > roshan.dire
          ? "radiant"
          : "dire";
    list.push({
      label: "R",
      hint: "Рошан",
      side,
      title: `${roshan.radiant}:${roshan.dire} · ${roshan.kills.map((k) => clock(k.time)).join(", ")}`,
    });
  }
  if (couriers.kills.length > 0) {
    const side: Side | null =
      couriers.radiant === couriers.dire ? null : couriers.radiant > couriers.dire ? "radiant" : "dire";
    list.push({ label: "C", hint: "Курьеры", side, title: `${couriers.radiant}:${couriers.dire}` });
  }
  if (list.length === 0) return null;
  const cls = (s: Side | null) =>
    s === "radiant"
      ? "bg-[var(--pg-radiant-soft)] text-[var(--pg-radiant)] ring-[var(--pg-radiant-line)]"
      : s === "dire"
        ? "bg-[var(--pg-dire-soft)] text-[var(--pg-dire)] ring-[var(--pg-dire-line)]"
        : "bg-[var(--pg-well)] text-[var(--pg-muted)] ring-[var(--pg-well-line)]";
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {list.map((b) => (
        <div key={b.label} className="flex flex-col items-center gap-0.5" title={`${b.hint}: ${b.title}`}>
          <span
            style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
            className={`grid place-items-center rounded-full font-black ring-1 ${cls(b.side)}`}
          >
            {b.label}
          </span>
          <span className="max-w-12 truncate text-[9px] font-bold uppercase text-[var(--pg-muted)]">
            {b.side ? tags[b.side] : "="}
          </span>
        </div>
      ))}
    </div>
  );
}
