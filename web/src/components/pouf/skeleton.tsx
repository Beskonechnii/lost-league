// Мерцающая заглушка на время загрузки. Стили давно лежат в Ките (`.pouf-skeleton` в pouf.css),
// компонента к ним не было — поэтому и `loading.tsx` в проекте не было ни у одного раздела:
// собирать шиммер руками на каждой странице никто не стал.
//
// Скелет рисует ФОРМУ будущего экрана, а не «идёт загрузка»: полоса заголовка там, где заголовок,
// строки там, где строки. Иначе он не экономит ожидание, а только мигает.

type Variant = "text" | "row" | "card";

export function Skeleton({
  variant = "row",
  className = "",
  style,
}: {
  variant?: Variant;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden className={`pouf-skeleton pouf-skeleton--${variant} ${className}`} style={style} />;
}

/**
 * Ряд одинаковых заглушек — список, таблица, сетка карточек.
 *
 * `role="status"` с подписью для читалки: экран без текста для неё пуст, и человек не понимает,
 * почему ничего не читается. Сами полосы из дерева доступности убраны (`aria-hidden` выше).
 */
export function SkeletonList({
  count = 6,
  variant = "row",
  className = "",
  label = "Загружаем данные",
}: {
  count?: number;
  variant?: Variant;
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className={className}>
      {Array.from({ length: count }, (_, i) => (
        // Затухание к концу списка: нижние строки ещё дальше от появления, чем верхние.
        <Skeleton key={i} variant={variant} style={{ opacity: 1 - i * (0.6 / count) }} className="mb-2 last:mb-0" />
      ))}
    </div>
  );
}

/** Шапка раздела: eyebrow, заголовок, поясняющая строка. Повторяет `SectionHeader`. */
export function SkeletonHeader() {
  return (
    <div aria-hidden className="space-y-2.5">
      <Skeleton variant="text" className="h-[11px] w-28" />
      <Skeleton variant="text" className="h-[30px] w-56" />
    </div>
  );
}
