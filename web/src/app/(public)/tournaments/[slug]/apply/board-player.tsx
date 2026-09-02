import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { PlayerLine as KitPlayerLine } from "@/components/pouf/player-line";
import { roleShort } from "@/lib/roles";
import type { PoolEntry } from "./pool";

/**
 * Игрок пула доски заявки — переходник к китовой мини-карточке (`pouf/player-line.tsx`).
 * Сама строка живёт в Ките с Э11: до этого её вторая копия стояла в драфте UNDERBEER, и копии
 * успели разойтись размером аватарки и весом ника.
 *
 * Здесь остаётся только то, что специфично для заявки: какие поля игрока лиги идут в подпись.
 */
export function PlayerLine({
  player,
  note,
  dense = false,
}: {
  player: PoolEntry;
  note?: string | null;
  /** Строка в слоте состава: на узком экране прячет MMR. Слева от неё стоят кружок капитана и
   *  подпись позиции, справа — «убрать»; без этого на 390px от ника оставалась одна буква,
   *  а MMR игрока выбирают в пуле, а не после того, как поставили в состав. */
  dense?: boolean;
}) {
  return (
    <KitPlayerLine
      thumb={
        <PlayerAvatar
          photo={player.photo}
          nickname={player.nickname}
          color={player.color}
          size={32}
          className="!rounded-[12px]"
        />
      }
      nickname={player.nickname}
      sub={[player.realName, player.teamName, roleShort(player.role)].filter(Boolean).join(" · ") || "без команды"}
      value={player.mmr ? player.mmr.toLocaleString("ru-RU") : null}
      note={note}
      dense={dense}
    />
  );
}
