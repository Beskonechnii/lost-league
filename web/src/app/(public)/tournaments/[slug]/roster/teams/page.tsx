import { listTeamRosters } from "@/lib/roster-data";
import { can } from "@/lib/account";
import { CreateForm } from "@/app/_components/roster-editors";
import { SectionHeader } from "@/app/_components/ui";
import { notFound } from "next/navigation";
import { TeamCards } from "@/app/(public)/roster/_components/team-cards";
import { DivTabs, parseDiv } from "@/app/(public)/roster/_components/div-tabs";
import { RosterSwitch } from "@/app/(public)/roster/_components/roster-switch";
import { getDivisions, tournamentBySlug } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

// Витрина команд турнира. Публичная; форма создания и счётчик пробелов в данных показываются
// только вошедшему оператору — посетителю они не нужны, а сама запись всё равно закрыта правом.
export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ div?: string }>;
}) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  const divisions = await getDivisions(tournament.id);
  const div = parseDiv(divisions, (await searchParams).div);
  const authed = await can("roster.edit");

  // Команды берём по участию в дивизионах ЭТОГО турнира, а не по всей лиге: иначе новый сезон
  // показывал бы команды прошлого. Вкладка дивизиона сужает список дальше — тоже по `divisionId`:
  // фильтр по строке-зеркалу `Team.group` в новом турнире давал пустой дивизион (зеркало хранит
  // имя дивизиона прошлого сезона), и команды были видны только на вкладке «Все».
  const ids = divisions.filter((d) => !div || d.slug === div).map((d) => d.id);
  const teams = await listTeamRosters(ids);
  const noId = teams.reduce((sum, t) => sum + t.noAccountIdCount, 0);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow={`${tournament.name} · ростер`}
        title="Команды"
        aside={
          <>
            {teams.length} команд
            {authed && noId > 0 && <span className="ml-2 text-amber-400">{noId} без account_id</span>}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RosterSwitch slug={slug} current="teams" />
        <DivTabs divisions={divisions} current={div} base={`/tournaments/${slug}/roster/teams`} />
      </div>

      {authed && (
        <CreateForm
          url="/api/roster/teams"
          submitLabel="Добавить команду"
          fields={[
            { key: "name", label: "Название", placeholder: "MOLOKO" },
            { key: "tag", label: "Тег", placeholder: "MLK" },
            { key: "group", label: "Дивизион", placeholder: "Division 1" },
          ]}
        />
      )}

      <TeamCards teams={teams} divisions={divisions} />
    </div>
  );
}
