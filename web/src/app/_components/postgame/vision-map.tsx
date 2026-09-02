"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ward } from "./types";
import { assetUrl } from "@/lib/assets";

// Время в mm:ss; отрицательное (префейз) — со знаком «−».
function clock(sec: number): string {
  const s = Math.round(sec);
  const sign = s < 0 ? "−" : "";
  const a = Math.abs(s);
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}

// Параметры как на OpenDota (/matches/<id>/vision), снятые с их разметки:
// заливка круга — по типу варда, обводка — по команде, диаметр — доля ширины карты.
const SIDE_BORDER = { radiant: "#66bb6a", dire: "#ff4c4c" } as const; // свет / тьма
const TYPE_FILL = { obs: "rgba(255,171,64,0.30)", sen: "rgba(102,187,255,0.30)" } as const; // обзор / true sight
const TYPE_DIAM = { obs: 0.1333, sen: 0.0833 } as const; // диаметр радиуса в долях карты

type Filters = { radiant: boolean; dire: boolean; obs: boolean; sen: boolean };

// Иконка варда — тим-цветная картинка OpenDota: {good,bad}guys_{observer,sentry}.png.
const wardIcon = (w: Ward) =>
  `/assets/map/${w.side === "radiant" ? "good" : "bad"}guys_${w.type === "obs" ? "observer" : "sentry"}.png`;

export function VisionMap({
  wards,
  durationSeconds = 0,
  sideLabels,
  timeline = true,
}: {
  wards: Ward[];
  durationSeconds?: number;
  sideLabels: { radiant: string; dire: string };
  // false — режим сводной карты: без полоски, всегда видны все варды (наложение за все карты).
  timeline?: boolean;
}) {
  // Полоска идёт от 0:00 до конца матча. Точка 0:00 — особый режим «вся расстановка за матч».
  const tEnd = durationSeconds || Math.max(1, ...wards.map((w) => w.left ?? w.placed));

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showRadius, setShowRadius] = useState(true);
  const [filters, setFilters] = useState<Filters>({ radiant: true, dire: true, obs: true, sen: true });
  const [hover, setHover] = useState<number | null>(null);

  // Сводный режим — всегда «всё сразу»; в режиме полоски то же на точке 0:00.
  const overview = !timeline || time <= 0;

  // Проигрывание: ~30 игровых секунд в реальную секунду.
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      if (last.current) {
        const next = time + ((now - last.current) / 1000) * 30;
        if (next >= tEnd) {
          setTime(tEnd);
          setPlaying(false);
          last.current = 0;
          return;
        }
        setTime(next);
      }
      last.current = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      last.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, tEnd]);

  const passesFilter = (w: Ward) => filters[w.side] && (w.type === "obs" ? filters.obs : filters.sen);
  // Вард активен в момент time: уже поставлен и ещё не снят.
  const isActive = (w: Ward) => w.placed <= time && (w.left == null || w.left > time);
  // Показываем: в обзоре — все прошедшие фильтр, иначе — только активные сейчас.
  const shown = wards.map((w, i) => ({ w, i })).filter(({ w }) => passesFilter(w) && (overview || isActive(w)));

  const count = (side: Ward["side"], type: Ward["type"]) =>
    wards.filter((w) => w.side === side && w.type === type && (overview || isActive(w))).length;

  const toggle = (k: keyof Filters) => setFilters((f) => ({ ...f, [k]: !f[k] }));

  // Деления полоски — каждые 10 минут.
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= tEnd; t += 600) out.push(t);
    return out;
  }, [tEnd]);

  return (
    <div className="rounded-2xl border border-hairline bg-surface-1 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_14px_40px_-28px_rgba(0,0,0,0.9)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-widest text-ink-muted">Карта вардов</span>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <FilterChip on={filters.radiant} onClick={() => toggle("radiant")} dot={SIDE_BORDER.radiant}>
            {sideLabels.radiant || "Свет"}
          </FilterChip>
          <FilterChip on={filters.dire} onClick={() => toggle("dire")} dot={SIDE_BORDER.dire}>
            {sideLabels.dire || "Тьма"}
          </FilterChip>
          <span className="mx-1 h-4 w-px bg-hairline" />
          <FilterChip on={filters.obs} onClick={() => toggle("obs")} dot="#ffab40">
            Обсы
          </FilterChip>
          <FilterChip on={filters.sen} onClick={() => toggle("sen")} dot="#66bbff">
            Сентри
          </FilterChip>
          <FilterChip on={showRadius} onClick={() => setShowRadius((v) => !v)}>
            Радиус
          </FilterChip>
        </div>
      </div>

      {/* Карта */}
      <div className="relative mx-auto aspect-square w-full max-w-[480px] overflow-hidden rounded-lg ring-1 ring-[var(--pg-ring)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/map/minimap.jpg" alt="Карта Dota 2" className="absolute inset-0 h-full w-full object-cover" />

        {/* Радиусы (обзор обсов / true sight сентри) — под иконками */}
        {showRadius &&
          shown.map(({ w, i }) => {
            const d = TYPE_DIAM[w.type];
            return (
              <span
                key={`r-${i}`}
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: `${(w.x - d / 2) * 100}%`,
                  top: `${(w.y - d / 2) * 100}%`,
                  width: `${d * 100}%`,
                  height: `${d * 100}%`,
                  background: TYPE_FILL[w.type],
                  border: `2px solid ${SIDE_BORDER[w.side]}`,
                }}
              />
            );
          })}

        {/* Иконки вардов */}
        {shown.map(({ w, i }) => (
          <span
            key={`w-${i}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{ left: `${w.x * 100}%`, top: `${w.y * 100}%`, width: "4.2%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wardIcon(w)} alt="" className="block w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
            {hover === i && <WardTip w={w} />}
          </span>
        ))}
      </div>

      {/* Счётчики */}
      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-ink-muted">
        {(["radiant", "dire"] as const).map((side) => (
          <span key={side} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SIDE_BORDER[side] }} />
            <span className="tabular-nums">
              {count(side, "obs")} обс · {count(side, "sen")} сентри
            </span>
          </span>
        ))}
      </div>

      {/* Полоска времени с делениями по 10 минут — только в режиме одной карты */}
      {timeline && (
        <>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => {
                if (time >= tEnd) setTime(0);
                setPlaying((p) => !p);
              }}
              className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-fill text-[var(--on-accent)] cushion-control"
              aria-label={playing ? "Пауза" : "Играть"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={tEnd}
                step={1}
                value={Math.round(time)}
                onChange={(e) => {
                  setPlaying(false);
                  setTime(Number(e.target.value));
                }}
                className="vision-slider w-full"
              />
              {/* Деления: 0, 10, 20… минут. Клик по метке — перейти к ней. */}
              <div className="relative mt-1 h-4">
                {ticks.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setPlaying(false);
                      setTime(t);
                    }}
                    className={`absolute top-0 -translate-x-1/2 text-[10px] tabular-nums transition ${
                      Math.abs(time - t) < 30 ? "font-bold text-ink" : "text-muted hover:text-ink"
                    }`}
                    style={{ left: `${(t / tEnd) * 100}%` }}
                    title={t === 0 ? "Вся расстановка за матч" : clock(t)}
                  >
                    {t === 0 ? "0:00" : `${t / 60}`}
                  </button>
                ))}
              </div>
            </div>
            <span className="w-12 flex-none text-right text-sm font-semibold tabular-nums text-ink">{clock(time)}</span>
          </div>
          <div className="mt-1 text-center text-[10px] font-bold text-muted">
            {overview ? "0:00 — вся расстановка вардов за матч" : "варды, активные в этот момент"}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  on,
  onClick,
  dot,
  children,
}: {
  on: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition ${
        on ? "bg-surface-2 text-ink" : "text-muted line-through opacity-70"
      }`}
    >
      {dot && <span className="inline-block h-2 w-2 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}

function WardTip({ w }: { w: Ward }) {
  const life = w.left == null ? "до конца" : `${clock(w.placed)} → ${clock(w.left)}`;
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-[180px] -translate-x-1/2 rounded-md bg-surface px-2 py-1 text-left text-[10px] leading-tight text-ink cushion-row">
      <span className="flex items-center gap-1 font-semibold">
        {w.hero.slug && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl("heroes", w.hero.slug)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
        )}
        {w.hero.name}
      </span>
      <span className="mt-0.5 block text-ink-muted">
        {w.type === "obs" ? "Обсервер" : "Сентри"} · {life}
      </span>
      {w.killer && <span className="block text-rose-700">снят: {w.killer.name}</span>}
    </span>
  );
}
