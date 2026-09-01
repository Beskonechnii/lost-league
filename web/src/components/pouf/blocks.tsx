import type { ReactNode } from "react";
import { Eyebrow } from "./text";

/* Блоки страницы — то, из чего собирается КОМПОЗИЦИЯ экрана: шапка секции, чип,
 * плитка показателя, полоска силы, и три токена ширины колонки. Уровень выше,
 * чем у атомов рядом (Button, Input, Text): здесь уже сказано, как элементы
 * стоят друг относительно друга.
 *
 * До Э3 файл лежал в `app/_components/ui.tsx` — третьей UI-библиотекой рядом с
 * pouf и shadcn. Библиотека теперь одна, поэтому блоки переехали сюда, к своим
 * атомам, и говорят на тех же токенах Кита.
 *
 * Без "use client" — можно тянуть в серверные страницы. Интерактивные варианты
 * (сегменты с onClick) живут в клиентских компонентах рядом со своим состоянием.
 */

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
 */
export const FORM_MAX_W = "max-w-3xl";

/**
 * Колонка входа — одинокая карточка по центру пустой страницы: вход по коду из бота и кабинет до
 * входа. Ширина взята из макета Кита «Вход» (420px) и потому названа отдельно, а не сведена к
 * `FORM_MAX_W`: у формы входа два поля и кнопка, на 48rem она растекается и перестаёт читаться
 * как карточка.
 *
 * Четыре токена и ни одного литерала: ширина страницы всегда называется словом, поэтому видно, к
 * какому из типов страница себя относит, и правится она в одном месте (UI-GUIDELINES §4).
 */
export const AUTH_MAX_W = "max-w-[420px]";

/** Шапка секции: eyebrow + заголовок слева, счётчик/действие справа.
    Заголовок — крупный жирный Nunito в духе Кита. */
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

/** Небольшой чип-метка (роль, тег, статус). Тихая «подушка»-капсула: поверхность
    с внутренним cushion-field, без акцентной заливки — чтобы много чипов в ряду
    не кричали, но читались как один набор с остальным визуалом.

    `accent` — вторая пара чипа из Кита (`.chip.sel`): выделенный в наборе. Пропом,
    а не классом снаружи: у чипа заливка и тень задаются двумя утилитами разом,
    и переопределить их одной строкой из вызова нельзя — они не каскадируют. */
export function Chip({
  children,
  accent = false,
  className = "",
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-pill px-3 py-1 font-pouf text-[11px] font-bold ${
        accent ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "bg-surface-2 text-ink-muted cushion-field"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Плитка показателя: подпись сверху, крупное число, опциональная сноска.
    «Подушка» Кита: поверхность с cushion-card, крупное жирное число Nunito. */
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
      // Отступы — на шкале Кита: s3 по вертикали, смещённые на половину «губы» (--lip), из-за которой
      // подушка кажется вдавленной вниз. Раньше здесь стояли те же числа литералами (0.75rem±5px).
      className={`rounded-blob px-[var(--s4)] pb-[calc(var(--s3)+var(--lip)/2)] pt-[calc(var(--s3)-var(--lip)/2)] font-pouf ${
        accent
          ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
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
    <div className={`h-[6px] overflow-hidden rounded-pill bg-surface-2 ${className}`}>
      <div
        className="h-full rounded-pill bg-accent-fill [box-shadow:inset_0_-2px_0_rgba(0,0,0,0.12)]"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
