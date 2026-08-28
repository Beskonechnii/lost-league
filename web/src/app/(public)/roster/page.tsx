import Link from "next/link";
import { listPoolTeams } from "@/lib/roster-data";
import { can } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { SectionHeader } from "@/app/_components/ui";
import { CreateForm } from "@/app/_components/roster-editors";
import { PoolExplorer } from "./_components/pool-explorer";
import { PoolSwitch } from "./_components/pool-switch";

export const dynamic = "force-dynamic";

// Общий пул команд лиги — таб «Ростер», сквозной по всем турнирам (в отличие от витрины внутри
// турнира). Фильтр по турниру и поиск — в клиенте (PoolExplorer). Разрез «в пуле / архив» — серверный,
// через ?view: это разные выборки (архив — первое из двух удалений, см. Team.archivedAt). Кнопки
// удаления показываем только оператору с правом roster.delete.
export default async function RosterPoolPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const archived = (await searchParams).view === "archive";
  const [teams, canDelete, canEdit, archivedCount, pooledCount] = await Promise.all([
    listPoolTeams({ archived }),
    can("roster.delete"),
    can("roster.edit"),
    prisma.team.count({ where: { archivedAt: { not: null } } }),
    prisma.team.count({ where: { archivedAt: null } }),
  ]);

  const tab = (active: boolean) =>
    `inline-flex shrink-0 rounded-[14px] px-4 py-[9px] text-[13px] font-black transition ${
      active ? "bg-purple text-[var(--on-accent)] cushion-control" : "bg-surface text-ink-muted cushion-field hover:text-ink"
    }`;

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Лига · все команды"
        title="Ростер"
        aside={<>Команды всех турниров лиги в одном месте</>}
      />

      <PoolSwitch current="teams" />

      {/* Разрез пул/архив виден оператору всегда; посетителю архив ни к чему — показываем только пул. */}
      {canDelete ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/roster" className={tab(!archived)}>
            В пуле <span className="ml-1 opacity-60 tabular-nums">{pooledCount}</span>
          </Link>
          <Link href="/roster?view=archive" className={tab(archived)}>
            Архив <span className="ml-1 opacity-60 tabular-nums">{archivedCount}</span>
          </Link>
        </div>
      ) : null}

      {canDelete && archived && (
        <p className="rounded-card bg-surface px-4 py-3 text-xs text-ink-subtle cushion-card">
          Команды в архиве убраны из общего пула, но остаются в таблицах и матчах своих турниров.
          «Вернуть в пул» отменяет это; «Удалить полностью» сносит команду со всей историей безвозвратно.
        </p>
      )}

      {/* Создание команды живёт здесь, в пуле лиги, а не в витрине турнира: команда — сущность лиги,
          в турнир она попадает заявкой или импортом. Только в пуле (не в архиве) и только оператору. */}
      {canEdit && !archived && (
        <CreateForm
          url="/api/roster/teams"
          submitLabel="Добавить команду"
          reloadOnSuccess
          fields={[
            { key: "name", label: "Название", placeholder: "MOLOKO" },
            { key: "tag", label: "Тег", placeholder: "MLK" },
          ]}
        />
      )}

      <PoolExplorer teams={teams} manage={canDelete ? { archived } : undefined} />
    </div>
  );
}
