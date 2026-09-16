import type { Metadata } from "next";
import { listPoolTeams, poolTournaments } from "@/lib/roster-data";
import { can } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { SectionHeader } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";
import { Separator } from "@/components/pouf/separator";
import { PillLink } from "@/components/pouf/tabs";
import { PoolExplorer } from "./_components/pool-explorer";
import { GroupSwitch } from "./_components/pool-switch";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ view?: string; by?: string }> };

/**
 * Заголовок и описание от выборки не зависят: считать «45 команд» ради титула — второй запрос
 * за теми же данными, и число устареет в день приёма следующей заявки. Наружу лига называется
 * SPIRIT/CTRL, «LOST» в метаданные не попадает (DECISIONS, 28.08.2026).
 *
 * Разрез — та же витрина в другой подаче, в индексе ей делать нечего; `follow` остаётся, потому что
 * карточки команд со страницы разреза обходить надо. `og:*` не заводим — без `metadataBase` Next
 * подставит в них localhost (блокер Б3, `docs/tasks/03-seo-bazovyi.md`).
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { view, by } = await searchParams;
  const cut = view === "archive" || by === "tournament";
  return {
    title: "Команды",
    description: "Все команды лиги SPIRIT/CTRL: состав, дивизион и турниры, в которых команда играла.",
    alternates: { canonical: "/roster" },
    robots: { index: !cut, follow: true },
  };
}

// Общий пул команд лиги — раздел «Команды», сквозной по всем турнирам (в отличие от витрины внутри
// турнира). Фильтр по турниру и поиск — в клиенте (PoolExplorer). Разрез «в пуле / архив» — серверный,
// через ?view: это разные выборки (архив — первое из двух удалений, см. Team.archivedAt). Кнопки
// удаления показываем только оператору с правом roster.delete.
export default async function RosterPoolPage({ searchParams }: Props) {
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

  // Все разрезы списка — одной группой, и эта группа уезжает в полосу над данными (первым слотом
  // FilterBar). Отдельным рядом она была ради ушедшего переключателя «Команды · Игроки»; без него
  // над карточками оставалось два ряда управления за один выбор — UI-GUIDELINES §9.
  const cuts = (
    <>
      <GroupSwitch base="/roster" group={params.by} extra={archived ? "view=archive" : ""} />
      {/* Архив виден только оператору: посетителю он ни к чему, у него список один. */}
      {canDelete && (
        <>
          <Separator orientation="vertical" />
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
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Лига · все сезоны"
        title="Команды"
        aside={<>Клубы из каждого турнира лиги, одним списком</>}
      />

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
        cuts={cuts}
      />
    </div>
  );
}
