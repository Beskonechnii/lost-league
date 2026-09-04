"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { IMAGE_NORMS, mimeOf, ratioOf, type ImageNorm, type ImageSlot } from "@/lib/image-norms";

/* Подгонка картинки под норму слота — окно, которое открывается сразу после выбора файла.
 *
 * Зачем оно вообще. Норма (src/lib/image-norms.ts) говорит, какой формы должен быть файл, но
 * сама привести к ней картинку не может: где именно резать кадр 3:2 под квадрат — знает только
 * человек. Поэтому: рамка целевого формата, картинку в ней таскают и масштабируют, на выходе
 * canvas рисует ровно width×height нормы. Наверх уходит уже готовый File — сервер (/api/roster/upload)
 * ничего не знает про подгонку и остаётся тупым хранилищем.
 *
 * Почему в браузере, а не на сервере: файл и так проходит через клиент, обрезка в canvas не тянет
 * ни одной зависимости (sharp в прямых зависимостях проекта нет), а оператор видит результат до
 * загрузки, а не после.
 *
 * Вся геометрия считается в пикселях ИТОГОВОГО файла, а превью выражает её процентами от рамки.
 * Так превью не нужно мерить: одна и та же тройка (s, ox, oy) описывает и то, что на экране,
 * и то, что нарисует canvas.
 */

type Geometry = { s: number; ox: number; oy: number };

export function ImageFit({
  slot,
  file,
  onCancel,
  onReady,
}: {
  slot: ImageSlot;
  file: File;
  onCancel: () => void;
  /** Готовый кадр в норме слота — его остаётся только отправить на сервер. */
  onReady: (fitted: File) => void;
}) {
  const norm = IMAGE_NORMS[slot];
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; k: number } | null>(null);

  const bases = useMemo(() => (img ? basesOf(norm, img) : null), [img, norm]);

  // blob-адрес живёт ровно столько же, сколько эффект, который его создал: в dev React монтирует
  // эффекты дважды, и адрес, созданный вне эффекта, оказался бы отозван сразу после первого прохода —
  // рамка стояла бы пустой. Картинку грузим сами: без naturalWidth не посчитать посадку. Первый кадр
  // ставим здесь же, в onload, по умолчанию слота: эмблему вписываем, портрет заполняем.
  useEffect(() => {
    const blobUrl = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImg(el);
      setGeo(center(norm, basesOf(norm, el)[norm.fit], el));
      setUrl(blobUrl);
    };
    el.src = blobUrl;
    return () => URL.revokeObjectURL(blobUrl);
  }, [file, norm]);

  /**
   * Кадр не выпускаем за пределы разумного по каждой оси: картинка крупнее рамки не отъезжает
   * так, чтобы в рамке появилась дырка, а мельче рамки — не уходит за её край. Оба случая — это
   * один отрезок допустимых смещений [min(0, box−size), max(0, box−size)], просто с разных сторон.
   */
  function clamp(g: Geometry, source: HTMLImageElement): Geometry {
    const fix = (v: number, size: number, box: number) =>
      Math.min(Math.max(0, box - size), Math.max(Math.min(0, box - size), v));
    return {
      s: g.s,
      ox: fix(g.ox, source.naturalWidth * g.s, norm.width),
      oy: fix(g.oy, source.naturalHeight * g.s, norm.height),
    };
  }

  function move(next: Geometry) {
    if (img) setGeo(clamp(next, img));
  }

  /** Масштабирование держит центр рамки на месте — иначе кадр уезжает при каждом движении ползунка. */
  function zoomTo(s: number) {
    if (!geo || !img) return;
    const k = s / geo.s;
    move({ s, ox: norm.width / 2 - (norm.width / 2 - geo.ox) * k, oy: norm.height / 2 - (norm.height / 2 - geo.oy) * k });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!geo || !frame.current) return;
    // Курсор в экранных пикселях, геометрия — в пикселях файла; коэффициент берём из ширины рамки.
    const k = norm.width / frame.current.getBoundingClientRect().width;
    drag.current = { x: e.clientX, y: e.clientY, ox: geo.ox, oy: geo.oy, k };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !geo) return;
    move({ s: geo.s, ox: d.ox + (e.clientX - d.x) * d.k, oy: d.oy + (e.clientY - d.y) * d.k });
  }

  async function done() {
    if (!img || !geo) return;
    const canvas = document.createElement("canvas");
    canvas.width = norm.width;
    canvas.height = norm.height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, geo.ox, geo.oy, img.naturalWidth * geo.s, img.naturalHeight * geo.s);
    const mime = mimeOf(norm);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, 0.92));
    if (blob) onReady(new File([blob], `fit.${norm.format}`, { type: mime }));
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 font-pouf" role="dialog" aria-modal>
      <div className="w-full max-w-[560px] rounded-card bg-surface p-5 cushion-card">
        <h2 className="text-[15px] font-black text-ink">Подгонка под слот</h2>
        <p className="mt-1 text-xs font-bold text-muted">{norm.hint}. Тяните кадр мышью, масштаб — ползунком.</p>

        {/* Рамка = итоговый файл один в один: что видно здесь, то и запишет canvas. */}
        <div
          ref={frame}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          className="relative mt-4 w-full cursor-grab touch-none overflow-hidden rounded-control bg-bg [background-image:repeating-conic-gradient(var(--surface-2)_0_25%,transparent_0_50%)] [background-size:18px_18px] cushion-field active:cursor-grabbing"
          style={{ aspectRatio: ratioOf(norm) }}
        >
          {url && img && geo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                left: pct(geo.ox, norm.width),
                top: pct(geo.oy, norm.height),
                width: pct(img.naturalWidth * geo.s, norm.width),
                height: pct(img.naturalHeight * geo.s, norm.height),
              }}
            />
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={0.4}
            max={4}
            step={0.01}
            value={bases && geo ? geo.s / bases[norm.fit] : 1}
            onChange={(e) => bases && zoomTo(bases[norm.fit] * Number(e.target.value))}
            className="h-1.5 flex-1 accent-[var(--accent-ink)]"
            aria-label="Масштаб"
          />
          <button
            type="button"
            className="text-xs font-black text-muted underline"
            onClick={() => img && bases && setGeo(clamp(center(norm, bases.contain, img), img))}
          >
            вписать
          </button>
          <button
            type="button"
            className="text-xs font-black text-muted underline"
            onClick={() => img && bases && setGeo(clamp(center(norm, bases.cover, img), img))}
          >
            заполнить
          </button>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" variant="quiet" size="sm" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="button" size="sm" disabled={!geo} onClick={() => void done()}>
            Готово
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Опорные масштабы: «вписать целиком» (с полями нормы) и «заполнить рамку без дырок». */
function basesOf(norm: ImageNorm, source: HTMLImageElement) {
  const pad = (norm.padding ?? 0) * Math.min(norm.width, norm.height);
  return {
    contain: Math.min((norm.width - 2 * pad) / source.naturalWidth, (norm.height - 2 * pad) / source.naturalHeight),
    cover: Math.max(norm.width / source.naturalWidth, norm.height / source.naturalHeight),
  };
}

/** Кадр этого масштаба по центру рамки. */
function center(norm: ImageNorm, s: number, source: HTMLImageElement): Geometry {
  return { s, ox: (norm.width - source.naturalWidth * s) / 2, oy: (norm.height - source.naturalHeight * s) / 2 };
}
