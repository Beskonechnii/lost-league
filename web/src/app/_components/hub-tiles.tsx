import Link from "next/link";
import { SectionHeader } from "@/components/pouf/blocks";
import { Card } from "@/components/pouf/surface";
import { Heading } from "@/components/pouf/text";
import { Badge } from "@/components/pouf/media";
import { Icon, type IconName } from "@/components/pouf/Icon";

// Плитки-хаб раздела: вместо ряда вкладок — карточки с иконкой, названием и одной строкой описания.
// Один вид для админки и продукта («архивный» pouf: surface-1, мягкая тень, подъём на hover),
// чтобы разделы выглядели одним набором. Сам <main> задаёт вызывающая страница/layout.

export type HubTile = {
  href: string;
  label: string;
  desc: string;
  icon: IconName;
  soon?: boolean;
  /** Сколько новых ждёт внутри (очередь модерации). Ноль и undefined — плитка без индикатора. */
  badge?: number;
};

// Раскладка сетки под число плиток: 3 (дивизион, админка) и 4 (сезон) — самые частые.
const COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** Сама сетка карточек — общая для плоского хаба и для хаба, разбитого на блоки. */
function TileGrid({ tiles, cols }: { tiles: HubTile[]; cols: 2 | 3 | 4 }) {
  return (
    <div className={`grid gap-4 ${COLS[cols]}`}>
      {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="group block">
            <Card motion="lift">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-accent-fill text-[var(--on-accent)] cushion-blob">
                  <Icon name={t.icon} size="md" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Heading level={3}>{t.label}</Heading>
                    {t.soon && <Badge tone="warn">в разработке</Badge>}
                    {/* индикатор новых: то же число, что и на вкладке раздела */}
                    {!!t.badge && <Badge tone="warn">{t.badge}</Badge>}
                  </div>
                  <p className="mt-1 text-sm font-bold text-muted">{t.desc}</p>
                </div>
              </div>
            </Card>
        </Link>
      ))}
    </div>
  );
}

export function HubTiles({
  eyebrow,
  title,
  tiles,
  cols = 3,
}: {
  eyebrow: string;
  title: string;
  tiles: HubTile[];
  cols?: 2 | 3 | 4;
}) {
  return (
    <div className="font-pouf">
      <SectionHeader eyebrow={eyebrow} title={title} />
      <div className="mt-6">
        <TileGrid tiles={tiles} cols={cols} />
      </div>
    </div>
  );
}

export type HubGroup = { title: string; tiles: HubTile[] };

/**
 * Тот же хаб, но плитки разложены по блокам с подписью. Нужен там, где инструментов больше десятка:
 * плоской сеткой уже не видно, что к чему относится. Пустые блоки (все плитки срезаны правами) не рисуем.
 */
export function HubGroupedTiles({
  eyebrow,
  title,
  groups,
  cols = 3,
}: {
  eyebrow: string;
  title: string;
  groups: HubGroup[];
  cols?: 2 | 3 | 4;
}) {
  return (
    <div className="font-pouf">
      <SectionHeader eyebrow={eyebrow} title={title} />

      <div className="mt-8 space-y-8">
        {groups
          .filter((g) => g.tiles.length > 0)
          .map((g) => (
            <section key={g.title}>
              <h2 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted">{g.title}</h2>
              <TileGrid tiles={g.tiles} cols={cols} />
            </section>
          ))}
      </div>
    </div>
  );
}
