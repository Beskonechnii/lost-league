import { listPoolPlayers } from "@/lib/roster-data";
import { can } from "@/lib/account";
import { SectionHeader } from "@/app/_components/ui";
import { PoolSwitch } from "../_components/pool-switch";
import { PlayersExplorer } from "../_components/players-explorer";

export const dynamic = "force-dynamic";

// Общий пул игроков лиги — пара к табу команд (/roster). Сквозной по всем турнирам, фильтр по турниру
// и поиск (клиент). Подсветку «нет account_id» показываем только оператору — это состояние наших
// данных, а не факт об игроке.
export default async function RosterPlayersPage() {
  const [players, canFlag] = await Promise.all([listPoolPlayers(), can("roster.edit")]);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · все игроки" title="Ростер" aside={<>Игроки всех турниров лиги в одном месте</>} />
      <PoolSwitch current="players" />
      <PlayersExplorer players={players} canFlag={canFlag} />
    </div>
  );
}
