import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

/* Атомы профиля — из артборда Кита «Профиль · атомы» (макет «Профиль игрока»).
 *
 * Живут здесь, а не на странице игрока: бублик, монеты, строка-запись, факт-бокс и
 * рельс внахлёст нужны и профилю команды, и карточке встречи. Страница собирает из
 * них композицию, но не описывает, как они выглядят.
 *
 * Без "use client": всё это чистая разметка, раскрытие рельса — на :hover в CSS,
 * поэтому атомы тянутся в серверные страницы напрямую.
 */

/**
 * Бублик показателя: кольцо-conic с дыркой-подушкой посередине. Крупное число
 * в дырке — то, ради чего на блок и смотрят (винрейт), кольцо даёт долю «на глаз».
 *
 * Дырка — отдельная приподнятая поверхность (`cushion-row`), а не вырез фона:
 * кольцо тогда читается как надетое на подушку, а не как нарисованное пятно.
 */
export function Donut({
  pct,
  value,
  caption,
  size = 206,
}: {
  /** Доля кольца, 0..100. */
  pct: number;
  value: ReactNode;
  caption: ReactNode;
  size?: number;
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="relative shrink-0 rounded-pill [box-shadow:0_0_0_1px_rgba(255,255,255,.5),inset_0_0_0_1px_rgba(120,108,78,.14),0_12px_26px_-6px_rgba(120,108,78,.28)]"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--accent-fill) 0 ${p}%, var(--line-strong) ${p}% 100%)`,
      }}
    >
      <div className="absolute inset-[24px] flex flex-col items-center justify-center gap-0.5 rounded-pill bg-surface cushion-row">
        <div className="text-[44px] font-black leading-none tracking-[-1px] tabular-nums text-[var(--accent-ink)]">{value}</div>
        <div className="text-[11px] font-extrabold uppercase tracking-[1px] text-ink-subtle">{caption}</div>
      </div>
    </div>
  );
}

/**
 * Монета показателя: круглый диск с иконкой, под ним значение и подпись.
 * Стоят рядом с бубликом — то, что не влезло в его дырку, но читается одним взглядом.
 */
export function StatCoin({ icon, value, label }: { icon: IconName; value: ReactNode; label: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-[9px]">
      <div className="grid h-[60px] w-[60px] place-items-center rounded-pill text-[var(--accent-ink)] [background:linear-gradient(135deg,#ffffff,#e6f4ee)] [box-shadow:0_0_0_1px_rgba(255,255,255,.5),inset_1px_1px_2px_rgba(255,255,255,.95),inset_-1px_-3px_5px_rgba(70,140,105,.34),0_5px_9px_-1px_rgba(40,100,76,.3)]">
        <Icon name={icon} size="md" />
      </div>
      <div className="whitespace-nowrap text-center text-base font-black tracking-[-0.4px] tabular-nums text-ink">{value}</div>
      <div className="-mt-[5px] text-center text-[10px] font-extrabold uppercase tracking-[0.5px] text-ink-subtle">{label}</div>
    </div>
  );
}

/**
 * Строка записи: миниатюра, две строки текста, значение справа. Одна форма на
 * последние игры и на героев — в макете это одна и та же строка, и разводить их
 * в две вёрстки значило бы чинить потом обе.
 */
export function DataRow({
  thumb,
  title,
  sub,
  aside,
}: {
  thumb?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-control-sm bg-surface px-3 py-[11px] cushion-row">
      {thumb}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-black text-ink">{title}</span>
        {sub && <span className="mt-0.5 truncate text-xs font-bold text-muted">{sub}</span>}
      </span>
      {aside}
    </div>
  );
}

/** Факт-бокс: подпись и значение маленькой подушкой. Россыпью в две колонки — «Данные» профиля. */
export function FactBox({
  label,
  value,
  accent = false,
  small = false,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Акцентный цвет значения — для того факта, ради которого на россыпь и смотрят (TP). */
  accent?: boolean;
  /** Значение словом, а не числом («Immortal», «Минск») — крупный кегль ему велик. */
  small?: boolean;
}) {
  return (
    <div className="rounded-chip bg-surface px-3.5 py-3 cushion-row">
      <div className="mb-[3px] text-[10px] font-extrabold uppercase tracking-[0.6px] text-ink-subtle">{label}</div>
      <div
        className={`font-black tracking-[-0.3px] ${small ? "text-base" : "text-[19px]"} ${accent ? "text-[var(--accent-ink)]" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Рельс внахлёст: круглые пилюли, наезжающие друг на друга, раскрываются по наведению
 * в имя/подпись. Экономит строку там, где элементов много, а места мало (ссылки, состав).
 * Наезд даёт «стопку», а не сетку: набор читается как одно целое.
 */
export function OverlapRail({ children, size = "sm" }: { children: ReactNode; size?: "sm" | "lg" }) {
  return (
    <div className={`flex items-center ${size === "lg" ? "pb-1.5 pt-3.5" : "h-[54px] pt-1"}`}>{children}</div>
  );
}

/**
 * Пилюля рельса. Ссылкой — потому что каждая пилюля куда-то ведёт (профиль соседа,
 * внешний профиль игрока); нераскрытая показывает только знак, раскрытая — подпись.
 *
 * `max-width` в переходе, а не `width`: у подписи ширина по контенту, и анимировать
 * её напрямую нельзя. Потолок берём с запасом — раскрытая пилюля обжимает текст сама.
 */
export function OverlapPill({
  href,
  external = false,
  title,
  glyph,
  children,
  size = "sm",
  highlight = false,
}: {
  href: string;
  external?: boolean;
  title?: string;
  /** Знак пилюли: иконка или аватар — то, что видно, пока пилюля не раскрыта. */
  glyph: ReactNode;
  children: ReactNode;
  size?: "sm" | "lg";
  /** Своя пилюля в наборе (сам игрок в составе) — обводка акцентом. */
  highlight?: boolean;
}) {
  const lg = size === "lg";
  const cls = [
    "group relative flex shrink-0 items-center overflow-hidden rounded-pill bg-surface cushion-row",
    "transition-[max-width,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none",
    "hover:z-10 hover:-translate-y-1 hover:cushion-row-hover",
    "border-[3px]",
    highlight ? "border-[var(--accent-fill)]" : "border-[var(--bg)]",
    lg
      ? "h-[66px] max-w-[66px] hover:max-w-[220px] -ml-[26px] first:ml-0"
      : "h-12 max-w-12 hover:max-w-[220px] -ml-4 first:ml-0",
  ].join(" ");

  const body = (
    <>
      {glyph}
      <span
        className={`whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none ${
          lg ? "pl-[11px] pr-[15px]" : "pr-5"
        }`}
      >
        {children}
      </span>
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" title={title} className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} title={title} className={cls}>
      {body}
    </Link>
  );
}
