import { listPoolPlayers, poolTournaments } from "@/lib/roster-data";
import { can } from "@/lib/account";
import { SectionHeader } from "@/components/pouf/blocks";
import { GroupSwitch, PoolSwitch } from "../_components/pool-switch";
import { PlayersExplorer } from "../_components/players-explorer";

export const dynamic = "force-dynamic";

// Общий пул игроков лиги — пара к табу команд (/roster). Сквозной по всем турнирам, фильтр по турниру
// и поиск (клиент). Подсветку «нет account_id» показываем только оператору — это состояние наших
// данных, а не факт об игроке.
export default async function RosterPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const params = await searchParams;
  const grouped = params.by === "tournament";
  const [players, canFlag, tournaments] = await Promise.all([
    listPoolPlayers(),
    can("roster.edit"),
    poolTournaments(),
  ]);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · все игроки" title="Ростер" aside={<>Игроки всех турниров лиги в одном месте</>} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PoolSwitch current="players" group={params.by} />
        <GroupSwitch base="/roster/players" group={params.by} />
      </div>
      <PlayersExplorer players={players} canFlag={canFlag} grouped={grouped} tournaments={tournaments} />
    </div>
  );
}
