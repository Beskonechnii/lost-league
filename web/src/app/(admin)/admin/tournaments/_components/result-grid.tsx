import type { PoolPlayer } from "@/lib/draft";
import { DraftPlayerLine } from "../../../underbeer/[id]/_components/player-line";

type Pick = { id: number; playerId: number | null; nickname: string; isCaptain: boolean; orderNo: number };
type Team = { id: number; name: string; color: string; orderNo: number; picks: Pick[] };

/**
 * Сохранённый состав Mix Cup — читается из durable-строк (MixCupTeam/MixCupPick), а не из
 * payload'а сессии: тот рабочий стол оператора, а это история события (ТЗ 33, DECISIONS
 * 22.09.2026). Раскладка и `DraftPlayerLine` — те же, что у живого борда, но без интерактива:
 * своей карточки TeamColumn не берёт — та рассчитана на текущий ход (canLock/canSteal,
 * currentTurn), а у сохранённого состава хода уже нет ни у кого.
 *
 * Ник — всегда снимок на момент драфта (`pick.nickname`): истина истории, а не текущий ник
 * игрока. Фото/позиция/MMR — из живого ростера, если игрок там ещё есть; иначе строка рисуется
 * недоступной карточкой без ссылки и без позиции/MMR (их у выбывшего тоже нет).
 */
export function ResultGrid({ teams, pool }: { teams: Team[]; pool: PoolPlayer[] }) {
  const byId = new Map(pool.map((p) => [p.id, p]));

  return (
    <section className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {teams.map((team) => (
          <div key={team.id} className="flex flex-col gap-2.5 rounded-card bg-surface p-3 font-pouf cushion-card">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-black tracking-[-0.2px] text-ink">
                {team.name}
              </span>
              <span className="shrink-0 text-xs font-extrabold tabular-nums text-muted">{team.picks.length}</span>
            </div>

            <div className="space-y-1.5">
              {team.picks.map((pick) => {
                const live = pick.playerId != null ? byId.get(pick.playerId) : undefined;
                const player: PoolPlayer = { ...(live ?? {
                  id: pick.playerId ?? -pick.id,
                  realName: null,
                  photo: null,
                  mmr: null,
                  roles: [],
                  teamColor: team.color,
                }), nickname: pick.nickname };
                return (
                  <div key={pick.id} className="flex items-center gap-1 rounded-control bg-surface-2 p-1 cushion-field">
                    <div className="min-w-0 flex-1">
                      <DraftPlayerLine player={player} unavailable={!live} />
                    </div>
                    {pick.isCaptain && (
                      <span className="mr-1 shrink-0 rounded-pill bg-accent-fill px-1.5 py-0.5 text-[9px] font-black text-[var(--on-accent)]">
                        КАП
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
