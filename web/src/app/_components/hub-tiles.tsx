import Link from "next/link";
import { SectionHeader } from "@/components/pouf/blocks";
import { Card } from "@/components/pouf/surface";
import { Heading } from "@/components/pouf/text";
import { Badge } from "@/components/pouf/media";
import { Icon, type IconName } from "@/components/pouf/Icon";
import { Grid } from "@/components/pouf/layout";

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

/** Сама сетка карточек — общая для плоского хаба и для хаба, разбитого на блоки.
 *  Сетка китовая (`Grid cols={3}`): своих порогов по месту не заводим, иначе три колонки
 *  встают уже с 1024 и плитка сжимается до 315px (ТЗ 27, DESIGN §4). */
export function TileGrid({ tiles }: { tiles: HubTile[] }) {
  return (
    <Grid cols={3}>
      {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group block rounded-card outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
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
    </Grid>
  );
}

export function HubTiles({
  eyebrow,
  title,
  tiles,
}: {
  eyebrow: string;
  title: string;
  tiles: HubTile[];
}) {
  return (
    <div className="font-pouf">
      <SectionHeader eyebrow={eyebrow} title={title} />
      <div className="mt-6">
        <TileGrid tiles={tiles} />
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
}: {
  eyebrow: string;
  title: string;
  groups: HubGroup[];
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
              <TileGrid tiles={g.tiles} />
            </section>
          ))}
      </div>
    </div>
  );
}

export type HubGroupCard = {
  href: string;
  title: string;
  desc: string;
  icon: IconName;
  /** Имена инструментов группы по порядку — строка состава под описанием. */
  tools: string[];
  /** Очереди словом: «3 анкеты», «1 дубль». Число само по себе на группе из девяти
   *  инструментов не говорит, три ЧЕГО (ТЗ 27, DESIGN §2). Ноль сюда не приходит. */
  queues?: string[];
};

/**
 * Входы в группы — верхний экран `/admin`. Та же семья, что и плитка инструмента, поэтому живёт
 * рядом с ней: разносить одну семью по двум файлам хуже, чем держать её целиком здесь.
 *
 * Две колонки, а не четыре: на 1440 в четыре колонки под карточку остаётся 336px, и девять имён
 * состава ложатся тремя строками мелочи.
 */
export function HubGroupCards({ cards }: { cards: HubGroupCard[] }) {
  return (
    <Grid cols={2}>
      {cards.map((c) => {
        const roster = c.tools.join(" · ");
        return (
          <Link
            key={c.href}
            href={c.href}
            className="group block rounded-card outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
            <Card motion="lift">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-accent-fill text-[var(--on-accent)] cushion-blob">
                  <Icon name={c.icon} size="md" />
                </div>
                <div className="min-w-0 flex-1">
                  {/* На узком экране индикаторы переносятся под заголовок, а не сжимают его. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Heading level={2}>{c.title}</Heading>
                    {c.queues?.map((q) => (
                      <Badge key={q} tone="warn">
                        {q}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-muted">{c.desc}</p>
                  {/* Состав — одной строкой с обрезкой, полный список в подсказке. Цвет --muted:
                      эту строку читают, выбирая группу, а не разглядывают как подпись. */}
                  <p className="mt-2 truncate text-xs font-bold text-muted" title={roster}>
                    {roster}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </Grid>
  );
}
