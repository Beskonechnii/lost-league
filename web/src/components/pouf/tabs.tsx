import Link from "next/link";
import type { ReactNode } from "react";

/* Пилюля навигации — артборд Кита «Управление и формы» (пилюли L1/L2/L3).
 *
 * Зачем атомом. К Э8 одна и та же строка классов была скопирована в восьми
 * местах: подвкладки раздела, «Команды / Игроки», вкладки дивизиона, разрез
 * «в пуле / архив», сортировки ростера, фильтры рейтингов, «Основа / Штаб» в
 * карточке команды. Совпадали они не полностью — половина рисовала активную
 * пилюлю ВДАВЛЕННОЙ (`cushion-control-active`), половина приподнятой, — и на
 * одной странице рядом стояли два разных ответа на вопрос «где я сейчас».
 * Кит отвечает один раз: текущий пункт — приподнятая мятная подушка
 * (`.pill.on`), вдавленность в Ките означает нажатие, а не выбор.
 *
 * Без "use client": строитель классов и ссылка. Кнопочный вариант тянут
 * клиентские компоненты со своим состоянием.
 */

export type PillSize = "sm" | "md";

/**
 * Классы пилюли. Экспортируются отдельно (как `buttonClasses`) — рядам, которые
 * верстают свой `<a>` или `<button>` с чужими пропами, нужен именно строитель.
 *
 * `variant`:
 *   field — пилюля лежит на бумаге и сама держит поверхность (ряды в теле страницы);
 *   quiet — поверхности нет, пока не наведёшь (липкий ряд подвкладок над содержимым,
 *           где восемь подушек подряд читались бы как забор).
 */
export function pillClasses({
  active = false,
  size = "sm",
  variant = "field",
  className = "",
}: {
  active?: boolean;
  size?: PillSize;
  variant?: "field" | "quiet";
  className?: string;
} = {}): string {
  const box =
    size === "md"
      ? "px-4 py-[9px] text-[13px]"
      : "px-3.5 py-[7px] text-[13px]";
  const skin = active
    ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
    : variant === "quiet"
      ? "text-ink-muted hover:bg-surface-1 hover:text-ink hover:cushion-field"
      : "bg-surface text-ink-muted cushion-field hover:text-ink";
  // 44px тач-цели только до lg: на мыши высота не нужна (см. nav-scroll.ts).
  return `inline-flex shrink-0 items-center rounded-[14px] font-pouf font-black transition-[box-shadow,transform,background] max-lg:min-h-[44px] max-lg:items-center outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] ${box} ${skin} ${className}`;
}

/** Счётчик в пилюле («D1 12»): тише подписи и всегда с табличными цифрами,
 *  чтобы ряд не дёргался при смене чисел. */
export function PillCount({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={`ml-1.5 text-xs tabular-nums ${active ? "text-[var(--on-accent-muted)]" : "text-ink-subtle"}`}
    >
      {children}
    </span>
  );
}

/** Пилюля-кнопка: тот же рисунок там, где выбор живёт в состоянии клиента,
 *  а не в адресе (вкладки внутри карточки, режим формы). */
export function PillButton({
  active = false,
  size,
  variant,
  onClick,
  className,
  children,
}: {
  active?: boolean;
  size?: PillSize;
  variant?: "field" | "quiet";
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={pillClasses({ active, size, variant, className })}
    >
      {children}
    </button>
  );
}

/**
 * Вдавленная дорожка под ряд пилюль — `.segset` Кита. Нужна там, где выбор из
 * двух-трёх равных вариантов сам является элементом формы («Вход / Регистрация»
 * в окне входа): дорожка обводит группу и говорит, что варианты исчерпывающие.
 * Ряды-фильтры на бумаге дорожки не носят — иначе каждая страница обрастала бы
 * рамками вокруг каждой тройки пилюль.
 *
 * Внутрь кладутся пилюли `variant="quiet"`: подушка внутри вдавленной дорожки даёт
 * две глубины на одном элементе, и невыбранный вариант начинает спорить с выбранным.
 * В Ките (`.segset` + `.seg`) невыбранный сегмент — просто подпись.
 */
export function PillTrack({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-2 rounded-blob bg-surface-2 p-2 font-pouf cushion-field [&>*]:flex-1 [&>*]:justify-center"
    >
      {children}
    </div>
  );
}

/** Пилюля-ссылка: выбор разреза живёт в адресе, поэтому большинство рядов —
 *  именно ссылки (ссылку с нужной вкладкой можно кинуть в чат). */
export function PillLink({
  href,
  active = false,
  size,
  variant,
  count,
  title,
  className,
  ref,
  children,
}: {
  href: string;
  active?: boolean;
  size?: PillSize;
  variant?: "field" | "quiet";
  /** Сколько строк за вкладкой. Не у всех рядов есть — счётчик стоит там, где он дёшев. */
  count?: number;
  title?: string;
  className?: string;
  ref?: React.Ref<HTMLAnchorElement>;
  children: ReactNode;
}) {
  return (
    <Link
      ref={ref}
      href={href}
      title={title}
      aria-current={active ? "page" : undefined}
      className={pillClasses({ active, size, variant, className })}
    >
      {children}
      {count !== undefined && <PillCount active={active}>{count}</PillCount>}
    </Link>
  );
}
