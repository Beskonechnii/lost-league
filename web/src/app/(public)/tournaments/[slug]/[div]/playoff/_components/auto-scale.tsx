"use client";

import { useEffect, useRef, useState } from "react";

// Сетка нарисована в натуральных пикселях (абсолютное позиционирование), поэтому под ширину
// контейнера её масштабируем `transform: scale` — как Canvas студии: «что нарисовано, то и тянется».
//
// Но не бесконечно вниз. До Э5 масштаб был просто `ширина контейнера / ширина сетки`, и на 375px
// это давало 0.19: карточки встреч превращались в серые полоски, названия команд — в пыль. Экран
// формально был, читать его было нельзя. Теперь есть пол: ниже MIN_SCALE не ужимаем, а отдаём
// сетку в горизонтальную прокрутку ВНУТРИ своего контейнера — ровно как предписано для широкого
// содержимого (UI-GUIDELINES §4, «Плотность»). Так на телефоне сетка листается вбок, а не
// рассматривается в лупу.
//
// Потолок 2 — чтобы на ультравайде не раздувать до нечитаемого.
const MAX_SCALE = 2;
const MIN_SCALE = 0.8;

export function AutoScale({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MIN_SCALE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // clientWidth у контейнера с overflow-x не растёт вслед за содержимым, поэтому обратной связи
    // «шире → пересчёт → ещё шире» не возникает.
    const fit = () => setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, el.clientWidth / width)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      {/* Коробка под масштаб: transform не меняет размеров в потоке, и без неё прокрутка не знала
          бы, насколько содержимое шире окна, а снизу оставалась бы пустота. */}
      <div style={{ width: width * scale, height: height * scale }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}
