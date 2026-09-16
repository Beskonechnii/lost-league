import type { Metadata } from "next";
import { listPoolPlayers, poolTournaments } from "@/lib/roster-data";
import { can } from "@/lib/account";
import { SectionHeader } from "@/components/pouf/blocks";
import { GroupSwitch } from "../../_components/pool-switch";
import { PlayersExplorer } from "../../_components/players-explorer";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ by?: string }> };

/**
 * Пара к метаданным команд (`../../(pool)/page.tsx`), отличается тремя строками. Голое «Игроки» закреплено
 * за сквозной витриной лиги; витрины внутри турнира получат в титул имя турнира (ТЗ 03).
 * Личного в описании нет: публичны ник, команда, позиция и ранг, операторская подсветка
 * «нет account_id» — факт о наших данных, а не об игроке, и в метаданные не попадает никогда.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { by } = await searchParams;
  return {
    title: "Игроки",
    description: "Все игроки лиги SPIRIT/CTRL: команда, позиция и ранг. Поиск по нику и разрез по турнирам.",
    alternates: { canonical: "/roster/players" },
    robots: { index: by !== "tournament", follow: true },
  };
}

// Общий пул игроков лиги — пара к разделу команд (/roster). Сквозной по всем турнирам, фильтр по
// турниру и поиск (клиент). Подсветку «нет account_id» показываем только оператору — это состояние
// наших данных, а не факт об игроке.
export default async function RosterPlayersPage({ searchParams }: Props) {
  const params = await searchParams;
  const grouped = params.by === "tournament";
  const [players, canFlag, tournaments] = await Promise.all([
    listPoolPlayers(),
    can("roster.edit"),
    poolTournaments(),
  ]);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Лига · все сезоны"
        title="Игроки"
        aside={<>Все, кто выходил за команды лиги</>}
      />
      <PlayersExplorer
        players={players}
        canFlag={canFlag}
        grouped={grouped}
        tournaments={tournaments}
        cuts={<GroupSwitch base="/roster/players" group={params.by} />}
      />
    </div>
  );
}
