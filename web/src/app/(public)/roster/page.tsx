import { listPoolTeams, poolTournaments } from "@/lib/roster-data";
import { can } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { SectionHeader } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";
import { PillLink } from "@/components/pouf/tabs";
import { PoolExplorer } from "./_components/pool-explorer";
import { GroupSwitch, PoolSwitch } from "./_components/pool-switch";

export const dynamic = "force-dynamic";

// Общий пул команд лиги — таб «Ростер», сквозной по всем турнирам (в отличие от витрины внутри
// турнира). Фильтр по турниру и поиск — в клиенте (PoolExplorer). Разрез «в пуле / архив» — серверный,
// через ?view: это разные выборки (архив — первое из двух удалений, см. Team.archivedAt). Кнопки
// удаления показываем только оператору с правом roster.delete.
export default async function RosterPoolPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; by?: string }>;
}) {
  const params = await searchParams;
  const archived = params.view === "archive";
  const grouped = params.by === "tournament";
  const [teams, canDelete, archivedCount, pooledCount, tournaments] = await Promise.all([
    listPoolTeams({ archived }),
    can("roster.delete"),
    prisma.team.count({ where: { archivedAt: { not: null } } }),
    prisma.team.count({ where: { archivedAt: null } }),
    poolTournaments(),
  ]);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Лига · все команды"
        title="Ростер"
        aside={<>Команды всех турниров лиги в одном месте</>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PoolSwitch current="teams" group={params.by} />
        {/* Второй разрез — вид того же списка, поэтому стоит в одной строке с первым, а не над ним. */}
        <GroupSwitch base="/roster" group={params.by} extra={archived ? "view=archive" : ""} />
      </div>

      {/* Разрез пул/архив виден оператору всегда; посетителю архив ни к чему — показываем только пул. */}
      {canDelete ? (
        <div className="flex flex-wrap items-center gap-2">
          <PillLink href={grouped ? "/roster?by=tournament" : "/roster"} active={!archived} size="md" count={pooledCount}>
            В пуле
          </PillLink>
          <PillLink
            href={grouped ? "/roster?view=archive&by=tournament" : "/roster?view=archive"}
            active={archived}
            size="md"
            count={archivedCount}
          >
            Архив
          </PillLink>
        </div>
      ) : null}

      {canDelete && archived && (
        <Alert tone="info" block>
          Команды в архиве убраны из общего пула, но остаются в таблицах и матчах своих турниров.
          «Вернуть в пул» отменяет это; «Удалить полностью» сносит команду со всей историей безвозвратно.
        </Alert>
      )}

      <PoolExplorer
        teams={teams}
        manage={canDelete ? { archived } : undefined}
        grouped={grouped}
        tournaments={tournaments}
      />
    </div>
  );
}
