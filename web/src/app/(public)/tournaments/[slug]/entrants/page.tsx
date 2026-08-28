import { notFound } from "next/navigation";
import { getDivisions, tournamentBySlug } from "@/lib/tournaments";
import { listTeamRosters } from "@/lib/roster-data";
import { SectionHeader } from "@/app/_components/ui";
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
        <p className="rounded-md border border-hairline bg-surface-1 px-3 py-4 text-sm text-ink-muted">
          Пока ни одной команды в турнире. Принятые на модерации команды появятся здесь — а капитаны
          могут подать свою команду на странице заявки.
        </p>
      ) : (
        <TeamCards teams={teams} />
      )}
    </div>
  );
}
