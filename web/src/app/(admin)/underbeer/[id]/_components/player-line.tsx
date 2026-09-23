import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { PlayerLine as KitPlayerLine } from "@/components/pouf/player-line";
import { roleShort } from "@/lib/roles";
import type { PoolPlayer } from "@/lib/draft";

/**
 * Игрок драфта — переходник к китовой мини-карточке (`pouf/player-line.tsx`). Один вид на пул,
 * состав команды и «летящую» карточку: человек, которого капитан тащит мышью, обязан выглядеть
 * одинаково до, во время и после переноса.
 *
 * До Э11 драфт рисовал эту строку своей вёрсткой — аватарка 34px с `!rounded-md`, ник
 * `font-medium`, подпись `text-ink-subtle`, — а в доске заявки стояла её разошедшаяся копия.
 */
export function DraftPlayerLine({
  player,
  note,
  unavailable = false,
  hideValue = false,
}: {
  player: PoolPlayer;
  note?: string | null;
  /** Игрок ушёл из ростера (сохранённый состав Mix Cup, ТЗ 33): позиции и MMR у него больше
   *  нет — подпись говорит об этом прямо, а не показывает пустую позицию. */
  unavailable?: boolean;
  /** Скрыть колонку MMR целиком, не прочерком — для оверлея, когда лига выключила показ MMR
   *  (`mmrShown`, ТЗ 32): прочерк выглядел бы как «у игрока нет MMR», а не «лига его прячет». */
  hideValue?: boolean;
}) {
  return (
    <KitPlayerLine
      thumb={
        <PlayerAvatar
          photo={player.photo}
          nickname={player.nickname}
          color={player.teamColor}
          size={32}
          className="!rounded-[12px]"
        />
      }
      nickname={player.nickname}
      sub={unavailable ? "не в ростере" : [player.realName, roleShort(player.role)].filter(Boolean).join(" · ") || "без позиции"}
      value={unavailable ? null : player.mmr ? player.mmr.toLocaleString("ru-RU") : null}
      hideValue={unavailable || hideValue}
      note={note}
    />
  );
}
