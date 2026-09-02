"use client";

import { useId, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

/* Зона drag-n-drop — артборд Кита из списка служебной части (`RELEASE-PLAN.md` §A).
 *
 * Здесь — файловая зона: «бросьте таблицу сюда или выберите на диске». Её
 * потребитель есть уже сейчас — импорт составов, где до Э9 стоял голый
 * `<input type="file">`: в Light Clay он рисуется системной серой кнопкой,
 * то есть единственным местом на экране, о котором Кит ничего не знает.
 *
 * Вторая зона из того же артборда — «пул слева, слоты справа» (жеребьёвка,
 * драфт) — заводится вместе со своим экраном на Э11: сейчас перетаскивание
 * живёт по месту в драфт-борде и доске заявки, и вынимать из них общий атом,
 * не видя третьего случая, значит угадывать. См. WORKLOG Э9a.
 *
 * Что зона обязана уметь, чтобы не быть картинкой:
 *   · клик по всей площади открывает выбор файла (не только по подписи);
 *   · перетаскивание подсвечивает зону и кладёт файл в тот же <input>, то есть
 *     форма отправляется одинаково независимо от способа;
 *   · с клавиатуры зона достижима — это <label> при настоящем <input type=file>,
 *     а не div с onClick.
 */

export function DropZone({
  name,
  accept,
  label,
  hint,
  icon = "log",
}: {
  name: string;
  /** Список расширений для <input accept> — он же подсказка в подписи. */
  accept?: string;
  label: string;
  hint?: string;
  icon?: IconName;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<string | null>(null);

  // Файл кладём в тот же <input>, что и обычный выбор: DataTransfer.files —
  // готовый FileList, и форма не догадывается, откуда он взялся.
  function drop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const dropped = e.dataTransfer.files;
    if (!dropped?.length || !input.current) return;
    input.current.files = dropped;
    setFile(dropped[0].name);
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-card px-(--s5) py-(--s6) text-center font-pouf transition-[box-shadow,background] ${
          over ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "bg-surface-2 cushion-field"
        }`}
      >
        <span
          className={`grid h-11 w-11 place-items-center rounded-[14px] ${
            over ? "bg-[rgba(255,255,255,0.72)] text-ink" : "bg-surface text-muted cushion-row"
          }`}
        >
          <Icon name={icon} size="md" />
        </span>
        <span className={`text-[13px] font-black ${over ? "" : "text-ink"}`}>
          {file ?? label}
        </span>
        {hint && (
          <span className={`text-[11px] font-bold ${over ? "text-[var(--on-accent-muted)]" : "text-muted"}`}>
            {file ? "нажмите, чтобы выбрать другой" : hint}
          </span>
        )}
      </label>
      {/* Сам input не прячем display:none — скрытый он выпадает из таблицы фокуса,
          и до зоны нельзя было бы дойти с клавиатуры. */}
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
        className="sr-only"
      />
    </div>
  );
}
