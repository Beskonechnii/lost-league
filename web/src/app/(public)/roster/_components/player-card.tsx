import Link from "next/link";
import type { ReactNode } from "react";
import { countryCode, playerPath } from "@/lib/profiles";
import { Chip } from "@/components/pouf/blocks";
import { RankMedal, RankTrend } from "@/components/pouf/rank";
import { OnlineDot } from "@/app/_components/chat-live";
import { PlayerAvatar } from "./avatar";

// Мини-карточка игрока — общий кирпич для витрины, тиммейтов и состава команды. Один вид на все
// места, чтобы страницы ростера читались как единый набор. Оформление — «полиш»: мягкая карточка,
// аватар на цвете команды, чип роли, MMR жирным; при наведении приподнимается.

export function PlayerMiniCard({
  id,
  slug,
  nickname,
  photo,
  accent,
  role,
  mmr,
  rank,
  rankPrev,
  isCaptain = false,
  country,
  size = 52,
  subtitle,
  trailing,
  flagged = false,
}: {
  id: number;
  /** Слаг для канонического адреса страницы игрока; без него ссылка пойдёт по id и получит редирект. */
  slug?: string | null;
  nickname: string;
  photo: string | null;
  accent?: string | null;
  role?: string | null;
  mmr?: number | null;
  /** Ранг Доты (rank_tier) — медалью в мета-строке. Без него медали просто нет. */
  rank?: number | null;
  /** Ранг до последней смены: есть разница — рядом с медалью встаёт стрелка. */
  rankPrev?: number | null;
  isCaptain?: boolean;
  country?: string | null;
  size?: number;
  /** Доп. строка под метой (например «ещё в …» или чек-лист пробелов анкеты). */
  subtitle?: ReactNode;
  /** Правый угол — номер позиции, значок и т.п. */
  trailing?: ReactNode;
  /** Тревожная обводка — операторская подсветка неполных данных. */
  flagged?: boolean;
}) {
  const code = countryCode(country);

  return (
    <Link
      href={playerPath({ id, slug })}
      className={`group flex items-center gap-3 rounded-control p-2.5 font-pouf transition duration-200 hover:-translate-y-0.5 ${
        flagged ? "bg-warn/[0.10] [box-shadow:var(--pouf-field),inset_0_0_0_2px_var(--warn)]" : "bg-surface cushion-row hover:cushion-row-hover"
      }`}
    >
      <PlayerAvatar photo={photo} nickname={nickname} color={accent} size={size} className="rounded-xl" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-black text-ink transition-colors group-hover:text-[var(--accent-ink)]">
            {nickname}
          </span>
          {/* Точка «в сети» рядом с ником — рисуется только у того, кто сейчас на сайте. */}
          <OnlineDot playerId={id} />
          {isCaptain && <span className="shrink-0 text-[11px] font-black text-[var(--accent-ink)]">C</span>}
          {code && <span className="shrink-0 text-[10px] font-bold text-ink-subtle">{code}</span>}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {role && <Chip>{role}</Chip>}
          {mmr ? <span className="text-xs font-bold tabular-nums text-muted">{mmr.toLocaleString("ru")} MMR</span> : null}
          {/* Медаль без подписи: в карточке шириной с колонку сетки на слово места нет, а знак
              читается и так — название висит подсказкой. Стрелка появляется только у тех, у кого
              ранг сменился с прошлой сверки. */}
          <RankMedal tier={rank} size="sm" />
          <RankTrend tier={rank} prev={rankPrev} />
        </div>

        {subtitle}
      </div>

      {trailing}
    </Link>
  );
}
