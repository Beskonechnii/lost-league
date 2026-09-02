"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { Eyebrow } from "@/components/pouf/text";
import { localHeroes, type LocalHero } from "@/lib/dota-constants";
import { assetUrl, assetFallback } from "@/lib/assets";

// Single draft: по одному случайному герою на каждую характеристику (сила, ловкость,
// интеллект, универсал). Пул героев локальный (dota-constants), поэтому вся логика на клиенте —
// сервер не нужен, «перекрутить» мгновенно.

type Attr = "str" | "agi" | "int" | "all";

// Характеристику называет подпись, а не цвет плашки: до Э11 каждая карточка носила свой
// сырой оттенок (rose/emerald/sky/violet) — четыре цвета мимо токенов ради того, что и так
// написано словом.
const ATTRS: { key: Attr; label: string }[] = [
  { key: "str", label: "Сила" },
  { key: "agi", label: "Ловкость" },
  { key: "int", label: "Интеллект" },
  { key: "all", label: "Универсал" },
];

const slug = (h: LocalHero) => h.name.replace(/^npc_dota_hero_/, "");
const pick = (pool: LocalHero[]) => pool[Math.floor(Math.random() * pool.length)];

function roll(): Record<Attr, LocalHero | null> {
  const all = localHeroes();
  const out = {} as Record<Attr, LocalHero | null>;
  for (const { key } of ATTRS) {
    const pool = all.filter((h) => h.primary_attr === key);
    out[key] = pool.length ? pick(pool) : null;
  }
  return out;
}

function HeroCard({ attr, hero }: { attr: (typeof ATTRS)[number]; hero: LocalHero | null }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-surface p-4 font-pouf cushion-card">
      <Eyebrow>{attr.label}</Eyebrow>
      <div className="flex flex-col items-center gap-3 pt-4">
        {hero ? (
          <>
            {/* иконка героя: локальный ассет → фолбэк на CDN Valve при 404 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl("heroes", slug(hero))}
              alt={hero.localized_name}
              className="h-auto w-full max-w-[220px] rounded-lg ring-1 ring-black/50"
              onError={(e) => {
                const img = e.currentTarget;
                const fb = assetFallback("heroes", slug(hero));
                if (!img.src.endsWith(fb)) img.src = fb;
              }}
            />
            <div className="text-center text-[15px] font-black tracking-[-0.2px] text-ink">{hero.localized_name}</div>
          </>
        ) : (
          // Первый рендер (до броска в эффекте) — не «пусто», а «сейчас будет»: лунка размером
          // с картинку держит место, чтобы страница не прыгала на монтировании.
          <div className="h-[140px] w-full rounded-blob bg-surface-2 cushion-field" />
        )}
      </div>
    </div>
  );
}

export function SingleDraft() {
  // Первый рендер — пустой (одинаков на сервере и клиенте), героев кидаем в эффекте:
  // Math.random() в рендере разошёлся бы между SSR и гидрацией.
  const [draft, setDraft] = useState<Record<Attr, LocalHero | null> | null>(null);
  const reroll = useCallback(() => setDraft(roll()), []);
  // Первый бросок — ровно на монтировании: это не «производное состояние», а клиентский Math.random,
  // которому нельзя в рендер (разъедется с SSR). Правило про setState-в-эффекте этот случай не ловит.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => reroll(), [reroll]);

  return (
    <div className="mt-8 font-pouf">
      <Button onClick={reroll} tone="orange">
        <Icon name="sparkle" size="sm" /> Перекрутить
      </Button>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {ATTRS.map((a) => (
          <HeroCard key={a.key} attr={a} hero={draft?.[a.key] ?? null} />
        ))}
      </div>
    </div>
  );
}
