import { notFound } from "next/navigation";
import { getDivisions, tournamentBySlug } from "@/lib/tournaments";
import { listTeamRosters } from "@/lib/roster-data";
import { SectionHeader } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { TeamCards } from "@/app/(public)/roster/_components/team-cards";
import { DivTabs, parseDiv } from "@/app/(public)/roster/_components/div-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявленные команды" };

// Заявленные команды на этапе приёма заявок — это ровно участники турнира (`TournamentEntry`), тот же
// источник, что у витрины «Ростер» и у жеребьёвки. Единая цепочка: заявка → модерация → апрув создаёт
// участие → команда здесь, в ростере и в жеребьёвке; снятие с турнира удаляет участие → пропадает
// отовсюду разом. Поэтому берём `listTeamRosters`, а не статус заявки: статус — история, а показывать
// нужно тех, кто реально в турнире.
export default async function EntrantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ div?: string }>;
}) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const divisions = await getDivisions(tournament.id);
  const div = parseDiv(divisions, (await searchParams).div);
  const all = await listTeamRosters(divisions.map((d) => d.id));

  const byDiv = (s: string) => {
    const id = divisions.find((d) => d.slug === s)?.id;
    return id === undefined ? [] : all.filter((t) => t.divisionIds.includes(id));
  };
  const teams = div ? byDiv(div) : all;
  const counts = Object.fromEntries([
    ...divisions.map((d) => [d.slug, byDiv(d.slug).length] as const),
    ["all", all.length] as const,
  ]);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow={`${tournament.name} · приём заявок`}
        title="Заявленные команды"
        aside={`${teams.length} команд`}
      />

      {divisions.length > 1 && (
        <div className="flex justify-end">
          <DivTabs divisions={divisions} current={div} base={`/tournaments/${slug}/entrants`} counts={counts} />
        </div>
      )}

      {teams.length === 0 ? (
        <EmptyState icon="users" title="Пока ни одной команды">
          Команда появляется здесь, когда её заявку принимают на модерации. Капитаны подают состав
          на странице заявки.
        </EmptyState>
      ) : (
        <TeamCards teams={teams} />
      )}
    </div>
  );
}
