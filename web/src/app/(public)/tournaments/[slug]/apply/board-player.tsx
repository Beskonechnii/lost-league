import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { roleShort } from "@/lib/roles";
import type { PoolEntry } from "./pool";

/**
 * Строка игрока — общий вид для пула, слота состава и оверлея перетаскивания. Одна на три места
 * специально: человек, которого капитан тащит мышью, обязан выглядеть одинаково до, во время и
 * после переноса — иначе кажется, что перетащился кто-то другой.
 *
 * Вид — Кит, мини-карточка игрока: аватар в подушке, ник жирным, подпись на `--muted`, число
 * справа табличными цифрами. Собственного фона и тени строка не носит: их задаёт то, во что она
 * вложена (приподнятая подушка в пуле, вдавленная лунка в пустом слоте).
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
    <div className={`flex items-center gap-2.5 py-2 font-pouf ${dense ? "px-2" : "px-3"}`}>
      <PlayerAvatar photo={player.photo} nickname={player.nickname} color={player.color} size={32} className="!rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black tracking-[-0.2px] text-ink">{player.nickname}</div>
        <div className="truncate text-[11px] font-bold text-muted">
          {[player.realName, player.teamName, roleShort(player.role)].filter(Boolean).join(" · ") || "без команды"}
        </div>
      </div>
      {note ? (
        <span className="shrink-0 text-[11px] font-extrabold text-muted">{note}</span>
      ) : (
        <span className={`shrink-0 text-right text-[11px] font-extrabold tabular-nums text-muted ${dense ? "max-sm:hidden" : ""}`}>
          {player.mmr ? player.mmr.toLocaleString("ru-RU") : "—"}
          <span className="block text-[10px] font-bold uppercase tracking-[0.5px] text-muted">MMR</span>
        </span>
      )}
    </div>
  );
}
