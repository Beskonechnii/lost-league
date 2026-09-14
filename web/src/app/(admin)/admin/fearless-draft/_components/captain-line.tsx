"use client";

import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { PlayerLine } from "@/components/pouf/player-line";
import type { CaptainRef } from "./types";

/**
 * Капитан стороны — переходник к китовой мини-карточке (`pouf/player-line.tsx`), ровно как
 * `DraftPlayerLine` у UNDERBEER. В Кит не едет: строка знает про поле `captain` конкретно
 * этого инструмента, второго потребителя у неё нет.
 *
 * Строка держит ОДНУ высоту с капитаном и без него — обе строки носят и подпись, и аватар
 * 32px. Иначе низ колонок сторон разъезжается, когда капитан отмечен только у одной команды.
 */
export function CaptainLine({ captain, color }: { captain: CaptainRef | null | undefined; color: string }) {
  if (!captain) {
    return (
      <PlayerLine
        // Инициалов нет — брать их не из чего, поэтому нейтральная лунка, а не пустой аватар.
        thumb={<div className="h-8 w-8 shrink-0 rounded-[12px] bg-surface-2 cushion-field" />}
        // `--muted`, а не `--subtle`: это читаемый текст, а не подпись второго плана.
        // Коротко: во внутренних 224px колонки «Капитан не назначен» обрезается многоточием,
        // а обрезанная подпись состояния хуже короткой.
        nickname={<span className="text-muted">Нет капитана</span>}
        sub="отметьте в ростере"
      />
    );
  }
  return (
    <PlayerLine
      thumb={
        <PlayerAvatar
          photo={captain.photo}
          nickname={captain.nickname}
          color={color}
          size={32}
          className="!rounded-[12px]"
        />
      }
      nickname={captain.nickname}
      sub="капитан"
      value={captain.mmr ? captain.mmr.toLocaleString("ru-RU") : null}
    />
  );
}
