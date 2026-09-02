"use client";

import { PlayerAvatar, TeamLogo } from "@/app/(public)/roster/_components/avatar";
import { Button } from "@/components/pouf/Button";
import { Chip } from "@/components/pouf/blocks";
import { roleShort } from "@/lib/roles";
import type { ReadyTeam } from "./pool";

/**
 * Карточка команды, где вошедший — капитан: знак, название и весь состав с ролями и MMR. Кнопка
 * переносит состав на доску заявки. Игроков вне пула лиги (без account_id) показываем блёкло и с
 * пометкой — в заявку они не уедут, их капитан добавит вручную.
 *
 * Вид — подушка Кита: акцент команды остался мягкой заливкой шапки (это её опознавательный знак),
 * но рамки и делители заменены на форму — приподнятая карточка и вдавленная дорожка состава.
 */
export function ReadyTeamCard({ team, onPick }: { team: ReadyTeam; onPick: () => void }) {
  const accent = team.color ?? undefined;
  return (
    <div className="overflow-hidden rounded-card bg-surface font-pouf cushion-card">
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={accent ? { background: `linear-gradient(100deg, ${accent}26, transparent 70%)` } : undefined}
      >
        <TeamLogo team={{ name: team.name, tag: team.tag, logo: team.logo }} size={44} className="!rounded-[16px]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-black uppercase tracking-[-0.2px] text-ink">{team.name}</div>
          {team.tag && <div className="truncate text-[11px] font-extrabold uppercase tracking-[0.6px] text-muted">{team.tag}</div>}
        </div>
        <Chip>{team.players.length} чел.</Chip>
      </div>

      <ul className="mx-3 space-y-1 rounded-blob bg-surface-2 p-2 cushion-field">
        {team.players.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-2.5 rounded-control bg-surface px-2.5 py-1.5 cushion-row ${p.inPool ? "" : "opacity-50"}`}
          >
            <PlayerAvatar photo={p.photo} nickname={p.nickname} color={team.color} size={28} className="!rounded-[10px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-black tracking-[-0.2px] text-ink">{p.nickname}</span>
                {p.isCaptain && (
                  <span title="Капитан" className="shrink-0 text-[11px] font-black text-[var(--accent-ink)]">
                    C
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] font-bold text-muted">
                {[roleShort(p.role), p.realName].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            {p.inPool ? (
              <span className="shrink-0 text-right text-[11px] font-extrabold tabular-nums text-muted">
                {p.mmr ? p.mmr.toLocaleString("ru-RU") : "—"}
                <span className="block text-[10px] font-bold uppercase tracking-[0.5px] text-muted">MMR</span>
              </span>
            ) : (
              <span className="shrink-0 text-[10px] font-extrabold text-[var(--color-warn-ink)]">нет в пуле</span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
        <Button type="button" size="sm" onClick={onPick}>
          Заявить этот состав
        </Button>
        {team.lost > 0 && (
          <span className="text-right text-[11px] font-extrabold text-[var(--color-warn-ink)]">
            {team.lost} без account_id — добавьте вручную
          </span>
        )}
      </div>
    </div>
  );
}
