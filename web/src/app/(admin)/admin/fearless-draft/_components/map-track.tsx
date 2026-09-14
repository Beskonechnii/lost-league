"use client";

import { Icon } from "@/components/pouf/Icon";
import { PillButton, PillTrack } from "@/components/pouf/tabs";

/**
 * Дорожка карт серии — выбор из равных вариантов, тот же язык, что у формата серии на экране
 * настройки (`fearless-setup.tsx`): вдавленная дорожка Кита с пилюлями.
 *
 * Мятная пилюля — всегда та карта, которую экран ПОКАЗЫВАЕТ, а не та, что драфтится: пилюля
 * отвечает на вопрос «где я». Где идёт драфт — несёт значок `live`, поэтому двух разных смыслов
 * у одного выделения на ряду не появляется.
 *
 * Bo5 на 390 в 358px не влезает (пять пилюль ≈ 453px), а `pillClasses` держит `shrink-0` — ряд
 * едет горизонтально ВНУТРИ своего контейнера. Ни переноса в китовый `PillTrack`, ни сокращения
 * подписи до цифры: первое меняет атом ради одного экрана, второе роняет читаемость на 1440.
 */
export function MapTrack({
  bestOf,
  current,
  viewing,
  onView,
}: {
  bestOf: number;
  /** Карта, которая реально драфтится (истина движка). */
  current: number;
  /** Карта, которую показывает экран (локальный просмотр). */
  viewing: number;
  onView: (i: number) => void;
}) {
  return (
    <div className="-mx-1 min-w-0 overflow-x-auto px-1 py-0.5">
      <PillTrack label="Карта серии">
        {Array.from({ length: bestOf }, (_, i) => (
          <PillButton
            key={i}
            active={i === viewing}
            variant="quiet"
            disabled={i > current}
            onClick={() => onView(i)}
            // `PillTrack` раздаёт пилюлям `flex-1` от нулевой основы — без этого «Карта 1»
            // переносится на две строки, и дорожка вместо ряда выглядит забором.
            className="gap-1.5 whitespace-nowrap"
          >
            {i === current ? (
              <Icon name="live" size="sm" label="идёт драфт" />
            ) : i < current ? (
              <Icon name="ok" size="sm" label="сыграна" />
            ) : null}
            Карта {i + 1}
          </PillButton>
        ))}
      </PillTrack>
    </div>
  );
}
