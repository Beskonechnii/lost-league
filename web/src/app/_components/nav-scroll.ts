"use client";

import { useEffect, useRef } from "react";

/**
 * Горизонтальные ряды вкладок на телефоне прокручиваются, и активная вкладка при загрузке легко
 * оказывается за краем — человек видит ряд, начинающийся не с того места, где он стоит.
 * Хук возвращает ref, который надо повесить на активный пункт: при появлении он подтягивает его
 * в вид. `block: "nearest"` обязателен — иначе браузер заодно прокручивает страницу к шапке.
 *
 * `inline` по умолчанию `"center"`. Ряду с липким началом (строка турнира: переключатель не
 * уезжает за край) нужен `"nearest"` — он единственный слушает `scroll-padding-left`, а без него
 * активная вкладка встаёт по центру ряда и наполовину прячется под липкий блок.
 */
export function useScrollActiveIntoView<T extends HTMLElement>(inline: ScrollLogicalPosition = "center") {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ inline, block: "nearest" });
  }, [inline]);
  return ref;
}

/**
 * Минимальная тач-цель. 44px — нижняя граница, ниже которой попадание пальцем становится лотереей;
 * на мыши высота не нужна, поэтому ограничение живёт только до `lg`.
 */
export const TOUCH_TARGET = "max-lg:min-h-[44px] max-lg:items-center";
