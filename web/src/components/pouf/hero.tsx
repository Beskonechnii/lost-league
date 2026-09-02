import type { ReactNode } from "react";
import Link from "next/link";

/* Атомы hero-шапки — артборд Кита «Hero-шапка команды» (Э6 RELEASE-PLAN).
 *
 * Кит рисует шапку команды парной к шапке игрока: та же подложка с мятным светом,
 * те же вложенные чипы. Здесь лежит то, что у них общее и что переиспользуют другие
 * страницы (турнир, ростер): оболочка с подсветкой, крупный знак, чип шапки и строка
 * состава. Композицию собирает страница.
 *
 * Без "use client": чистая разметка.
 *
 * Третьей ступени текста (`--subtle`, 1.81:1 на бумаге) здесь нет — в Ките на ней
 * набраны тег и подписи ролей, у нас всё читаемое живёт на `--muted`. То же решение,
 * что на турнирном блоке (WORKLOG Э5); Кит не правится.
 */

/**
 * Оболочка шапки: подушка страницы с мятной подсветкой из левого верхнего угла
 * (Кит `.hero` + `.herowash`). Подсветка — отдельным слоем под контентом, поэтому
 * тело шапки обязано быть `relative`; за это отвечает сам компонент.
 */
export function Hero({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`relative overflow-hidden rounded-card bg-surface font-pouf cushion-card ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(70%_120%_at_8%_0%,rgba(140,203,173,.5),transparent_55%)]"
      />
      {children}
    </section>
  );
}

/**
 * Полоса под шапкой — плитки чисел на бумаге шапки, отделённые волоском (Кит: низ `.hero`).
 * Отдельным атомом, потому что и у команды, и у турнира это один и тот же приём.
 */
export function HeroFooter({ children }: { children: ReactNode }) {
  return <div className="relative border-t border-hairline px-5 py-4 sm:px-[30px]">{children}</div>;
}

/**
 * Крупный знак: лого команды, а файла нет — монограмма на мятной подушке (Кит `.biglogo`).
 * Логотип садится на ту же подушку, но на светлую: цветной PNG на мятном градиенте грязнится.
 */
export function HeroLogo({
  logo,
  fallback,
  name,
}: {
  logo?: string | null;
  /** Монограмма — обычно тег команды. */
  fallback: string;
  name?: string;
}) {
  // Два размера прямо из Кита: 96px на 390px и 150px на 1220px. Классами, а не inline-стилем,
  // иначе размер нельзя было бы переключить по брейкпоинту — inline перебивает утилиты.
  const box = "h-24 w-24 shrink-0 rounded-[28px] sm:h-[150px] sm:w-[150px] sm:rounded-[38px]";
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={name ?? ""} className={`${box} bg-surface object-contain p-3 cushion-card`} />
  ) : (
    <span
      title={name}
      className={`${box} grid place-items-center bg-accent-fill text-[26px] font-black uppercase leading-none tracking-[-1px] text-[var(--on-accent)] cushion-control sm:text-[38px]`}
    >
      {fallback}
    </span>
  );
}

/**
 * Чип шапки (Кит `.herochip`): приподнятая капсула, а не вдавленная, как обычный `Chip`.
 * `accent` — мятная пара (`.herochip.tp`): ей помечают то, ради чего на шапку смотрят.
 */
export function HeroChip({
  children,
  accent = false,
  title,
}: {
  children: ReactNode;
  accent?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex w-fit shrink-0 items-center gap-[7px] whitespace-nowrap rounded-pill px-[15px] py-2 font-pouf text-[13px] font-extrabold ${
        accent ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "bg-surface text-muted cushion-row"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Строка состава (Кит `.rostline`): знак, имя с подписью, ярлык места справа.
 * Ниже мини-карточки игрока по весу — состав в шапке читается списком, а не витриной.
 */
export function RosterLine({
  glyph,
  name,
  sub,
  aside,
  href,
  dim = false,
}: {
  glyph?: ReactNode;
  name: ReactNode;
  sub?: ReactNode;
  /** Правый ярлык: «Основа», «Запас», номер позиции. */
  aside?: ReactNode;
  href?: string;
  /** Приглушённая строка — запасной или неактуальный состав. */
  dim?: boolean;
}) {
  const cls = `flex items-center gap-3 rounded-blob bg-surface px-3.5 py-2.5 font-pouf cushion-row ${
    dim ? "opacity-75" : ""
  } ${href ? "transition duration-200 hover:-translate-y-0.5 hover:cushion-row-hover" : ""}`;
  const body = (
    <>
      {glyph}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-sm font-black text-ink">{name}</span>
        {sub && <span className="mt-px block truncate text-[11px] font-extrabold text-muted">{sub}</span>}
      </span>
      {aside && (
        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.8px] text-muted">{aside}</span>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
