import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { PlayerLine as KitPlayerLine } from "@/components/pouf/player-line";
import { rolePosition, roleShort } from "@/lib/roles";
import type { PoolPlayer } from "@/lib/draft";

/**
 * Роли в подписи — НОМЕРАМИ позиций, а не короткими подписями: колонка пула на широком мониторе
 * ~150px, и «Софт-саппорт · Хард-саппорт» обрежется на первом же слове. «поз. 1 · 2 · 4»; роль
 * без позиции (замена, тренер) добавляется словом — «поз. 1 · 2 · Тренер». Заголовки колонок уже
 * говорят «Керри (поз. 1)», так что нумерация читается без словаря.
 *
 * В эфире (`words`) — наоборот, словами через слеш: «Керри / Мид». Решение Стаса 24.09.2026 по
 * замечанию `qa` к ТЗ 38 — у зрителя стрима нет ни заголовков колонок, ни словаря позиций, и
 * «поз. 1 · 2» ему не говорит ничего. Место там есть: колонка команды в оверлее широкая.
 */
function rolesSub(roles: string[], words: boolean): string | null {
  if (roles.length === 0) return null;
  if (words) return roles.map((r) => roleShort(r) ?? r).join(" / ");
  const parts = roles.map((r) => rolePosition(r)?.toString() ?? roleShort(r) ?? r);
  const numbered = roles.some((r) => rolePosition(r) != null);
  return numbered ? `поз. ${parts.join(" · ")}` : parts.join(" · "); // «поз. Тренер» — не подпись
}

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
  roleWords = false,
}: {
  player: PoolPlayer;
  note?: string | null;
  /** Игрок ушёл из ростера (сохранённый состав Mix Cup, ТЗ 33): позиции и MMR у него больше
   *  нет — подпись говорит об этом прямо, а не показывает пустую позицию. */
  unavailable?: boolean;
  /** Скрыть колонку MMR целиком, не прочерком — для оверлея, когда лига выключила показ MMR
   *  (`mmrShown`, ТЗ 32): прочерк выглядел бы как «у игрока нет MMR», а не «лига его прячет». */
  hideValue?: boolean;
  /** Роли словами через слеш вместо номеров позиций — для эфирного оверлея (см. `rolesSub`). */
  roleWords?: boolean;
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
      sub={
        unavailable
          ? "не в ростере"
          : [player.realName, rolesSub(player.roles, roleWords)].filter(Boolean).join(" · ") || "без позиции"
      }
      value={unavailable ? null : player.mmr ? player.mmr.toLocaleString("ru-RU") : null}
      hideValue={unavailable || hideValue}
      note={note}
    />
  );
}
