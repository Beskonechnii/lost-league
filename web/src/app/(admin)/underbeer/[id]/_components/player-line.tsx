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
export function DraftPlayerLine({ player, note }: { player: PoolPlayer; note?: string | null }) {
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
      sub={[player.realName, roleShort(player.role)].filter(Boolean).join(" · ") || "без позиции"}
      value={player.mmr ? player.mmr.toLocaleString("ru-RU") : null}
      note={note}
    />
  );
}
