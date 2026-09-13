import { Chip, Meter } from "./blocks";
import { withPlural } from "@/lib/plural";

/* Счётчик мест «занято / всего» — один атом на весь продукт (ТЗ 09, §4 DESIGN).
 *
 * Числа «8 из 12» встречаются на карточке турнира, на карточке дивизиона, в строке хронологии,
 * в форме заявки и в редактировании турнира. Это пять мест, где иначе завелось бы пять вёрсток
 * одной мысли — поэтому атом, а не по месту.
 *
 * Число показываем фактическое и НЕ обрезаем до лимита: «13 из 12» — правда, «12 из 12» на том же
 * месте — вранье. Полоска при этом за 100% не растягивается (`Meter` режет сам).
 *
 * «Мест нет» и «сверх лимита» различает подпись, а не красная заливка: заполненный дивизион —
 * это не ошибка, а нормальное состояние турнира.
 */

export function Capacity({
  taken,
  limit,
  size = "md",
  meter = true,
}: {
  taken: number;
  /** null или не задан — «без ограничения», а не «ноль мест». */
  limit?: number | null;
  size?: "sm" | "md";
  /** Полоску можно погасить там, где на неё нет высоты (строка хронологии). */
  meter?: boolean;
}) {
  const textSize = size === "sm" ? "text-[13px]" : "text-[15px]";

  // Лимита нет — знаменателю взяться неоткуда, и полоска показывала бы долю от неизвестного.
  if (limit == null) {
    return (
      <div className={`font-pouf font-bold tabular-nums text-ink ${textSize}`}>
        {withPlural(taken, "команда", "команды", "команд")}
      </div>
    );
  }

  return (
    <div className="font-pouf">
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 font-bold ${textSize}`}>
        <span className="tabular-nums text-ink">
          {taken} <span className="text-muted">из {limit}</span>
        </span>
        {taken === limit && <Chip>Мест нет</Chip>}
        {taken > limit && <Chip>сверх лимита</Chip>}
      </div>
      {/* Полоску держим короткой: во всю ширину колонки она читается как разделитель страницы,
          а не как показатель рядом с числом. */}
      {meter && <Meter pct={limit > 0 ? (taken / limit) * 100 : 100} className="mt-1.5 max-w-[220px]" />}
    </div>
  );
}
