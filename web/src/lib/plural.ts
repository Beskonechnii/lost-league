// Русская форма слова по числу. Заведена на ТЗ 09: счётчик мест, счётчик турниров в группе серии
// и подпись хронологии печатали «4 турнира» и «1 турниров» одинаково — своей склейки в каждом
// месте не хочется, а Intl.PluralRules возвращает категорию, а не слово.

/** plural(3, "команда", "команды", "команд") → «команды». */
export function plural(n: number, one: string, few: string, many: string): string {
  const rest = Math.abs(n) % 100;
  const last = rest % 10;
  if (rest > 10 && rest < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

/** «4 турнира» — число вместе со словом. */
export const withPlural = (n: number, one: string, few: string, many: string) =>
  `${n} ${plural(n, one, few, many)}`;
