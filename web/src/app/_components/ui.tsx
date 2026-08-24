import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

// Переиспользуемые презентационные примитивы UI. Без "use client" — можно тянуть в серверные
// страницы. Задают единый ритм заголовков, чипов и плашек, чтобы страницы выглядели одним набором,
// а не собранными вручную каждая по-своему. Интерактивные варианты (сегменты с onClick) живут
// в клиентских компонентах рядом с их состоянием.

/**
 * Единая ширина контента сайта — один токен на шапку, подменю и колонку каждой страницы, чтобы они
 * совпадали по краю и не разъезжались (раньше было вразнобой 72–96rem). 96rem (1536px) — баланс:
 * заметно шире прежних 72–86rem, на широком экране остаётся воздух по краям, но не «поле в пустоте».
 * Плей-офф — исключение: его сетка нарочно во всю ширину экрана (full-bleed), см. страницу плей-офф.
 */
export const SITE_MAX_W = "max-w-[96rem]";

/**
 * Колонка чтения — для страниц одной сущности, которые читают сверху вниз (встреча, регламент).
 * Уже витрины намеренно: строка длиной во весь экран читается плохо.
 */
export const READ_MAX_W = "max-w-6xl";

/**
 * Колонка формы — анкеты, мастера, списки-настройки в служебной части. Ещё уже: поле ввода во всю
 * ширину экрана попасть мышью труднее, чем прочитать.
 *
 * Три токена и ни одного литерала: ширина страницы всегда называется словом, поэтому видно, к какому
 * из трёх типов страница себя относит, и правится она в одном месте (UI-GUIDELINES §4).
 */
export const FORM_MAX_W = "max-w-3xl";

/** Надпись-категория над заголовком секции: uppercase, положительный трекинг, шрифт pouf.
    Визуал 1st-Pouf — единый eyebrow на весь сайт (совпадает с pouf Eyebrow). */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-pouf text-[13px] font-extrabold uppercase tracking-[2px] text-muted ${className}`}>{children}</p>
  );
}

/** Шапка секции: eyebrow + заголовок слева, счётчик/действие справа.
    Заголовок — крупный жирный Nunito в духе pouf Heading. */
export function SectionHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    // На узком экране заголовок и правая приписка встают друг под друга: в строку они налезали
    // друг на друга — «сыграно 56 из 56» уезжало на H1.
    <div className="flex flex-col gap-2 font-pouf sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="text-[28px] font-black leading-[1.2] tracking-[-0.5px] text-ink md:text-4xl">{title}</h1>
      </div>
      {aside && <div className="font-pouf text-sm font-bold text-muted sm:shrink-0 sm:pb-1">{aside}</div>}
    </div>
  );
}

/** Небольшой чип-метка (роль, тег, статус). Тихая «подушка»-капсула в стиле pouf:
    поверхность с внутренним cushion-field, без пастельной заливки — чтобы много чипов
    в ряду не кричали, но читались как один набор с остальным визуалом. */
export function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={`gap-1 rounded-pill border-none bg-surface-2 px-3 py-1 font-pouf text-[11px] font-bold text-ink-muted cushion-field ${className}`}
    >
      {children}
    </Badge>
  );
}

/** Плитка показателя: подпись сверху, крупное число, опциональная сноска.
    «Подушка» pouf: поверхность с cushion-card, крупное жирное число Nunito. */
export function StatTile({
  label,
  value,
  hint,
  valueClass = "text-ink",
  accent = false,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  valueClass?: string;
  /** Акцентная плитка — подсветка ключевого показателя (место, очки). */
  accent?: boolean;
}) {
  return (
    <div
      // Отступы — на шкале pouf: s3 по вертикали, смещённые на половину «губы» (--lip), из-за которой
      // подушка кажется вдавленной вниз. Раньше здесь стояли те же числа литералами (0.75rem±5px).
      className={`rounded-blob px-[var(--s4)] pb-[calc(var(--s3)+var(--lip)/2)] pt-[calc(var(--s3)-var(--lip)/2)] font-pouf ${
        accent
          ? "bg-purple text-[var(--on-accent)] cushion-control"
          : "bg-surface-1 cushion-card"
      }`}
    >
      <div className={`text-[11px] font-extrabold uppercase tracking-[1px] ${accent ? "text-[var(--on-accent-muted)]" : "text-muted"}`}>{label}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums tracking-[-0.5px] ${accent ? "" : valueClass}`}>{value}</div>
      {hint && <div className={`mt-0.5 text-xs font-bold ${accent ? "text-[var(--on-accent-muted)]" : "text-muted"}`}>{hint}</div>}
    </div>
  );
}

/**
 * Полоска силы 0–100% в акценте. Показывает величину «на глаз» рядом с числом —
 * MMR игрока, урон, что угодно нормированное. Ширину считает вызывающий.
 */
export function Meter({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-[6px] overflow-hidden rounded-pill bg-surface-3 ${className}`}>
      <div
        className="h-full rounded-pill bg-purple [box-shadow:inset_0_-2px_0_rgba(0,0,0,0.15)]"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
