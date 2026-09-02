import type { ReactNode } from "react";

/* Мини-карточка игрока строкой — артборд Кита «Оверлеи и структура».
 *
 * До Э11 эта строка была написана дважды: в доске заявки
 * (`tournaments/<slug>/apply/board-player.tsx`, Э7) и в драфте UNDERBEER, — и
 * копии уже разошлись: у одной аватарка 32px в подушке Кита, у другой 34px с
 * `!rounded-md`, у одной ник `font-black`, у другой `font-medium`. Обе рисуют
 * одно и то же: аватар, ник, подпись мелким и число справа.
 *
 * Атом сознательно НЕ знает про сущность «игрок»: аватарка приходит готовым
 * узлом (`thumb`). Иначе Киту пришлось бы тянуть `PlayerAvatar` из
 * `app/(public)/roster`, то есть библиотека начала бы зависеть от страниц.
 *
 * Собственного фона и тени строка не носит: их задаёт то, во что она вложена —
 * приподнятая подушка в пуле, вдавленная лунка в пустом слоте, ничего в
 * «летящей» карточке. Одна строка на все три места специально: человек,
 * которого тащат мышью, обязан выглядеть одинаково до, во время и после
 * переноса, иначе кажется, что перетащился кто-то другой.
 */

export function PlayerLine({
  thumb,
  nickname,
  sub,
  value,
  valueLabel = "MMR",
  note,
  dense = false,
}: {
  thumb: ReactNode;
  nickname: ReactNode;
  /** Вторая строка: имя, команда, позиция — через « · ». */
  sub?: ReactNode;
  /** Число справа. `null`/`undefined` — прочерк, чтобы столбик не «дышал». */
  value?: ReactNode;
  valueLabel?: ReactNode;
  /** Подпись вместо числа: «занят: X», «в составе» — состояние важнее MMR. */
  note?: ReactNode;
  /** Плотный вариант: уже поля и без числа на узком экране (строка в слоте,
   *  где слева стоят кружок капитана и подпись позиции, а справа — «убрать»). */
  dense?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 py-2 font-pouf ${dense ? "px-2" : "px-3"}`}>
      {thumb}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black tracking-[-0.2px] text-ink">{nickname}</div>
        {sub && <div className="truncate text-[11px] font-bold text-muted">{sub}</div>}
      </div>
      {note ? (
        <span className="shrink-0 text-[11px] font-extrabold text-muted">{note}</span>
      ) : (
        <span
          className={`shrink-0 text-right text-[11px] font-extrabold tabular-nums text-muted ${dense ? "max-sm:hidden" : ""}`}
        >
          {value ?? "—"}
          <span className="block text-[10px] font-bold uppercase tracking-[0.5px] text-muted">{valueLabel}</span>
        </span>
      )}
    </div>
  );
}
