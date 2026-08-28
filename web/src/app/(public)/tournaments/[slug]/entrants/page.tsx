import { notFound } from "next/navigation";
import { getDivisions, tournamentBySlug } from "@/lib/tournaments";
import { listApprovedEntrants } from "@/lib/roster-data";
import { SectionHeader } from "@/app/_components/ui";
import { TeamCards } from "@/app/(public)/roster/_components/team-cards";
import { DivTabs, parseDiv } from "@/app/(public)/roster/_components/div-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявленные команды" };

// Заявленные команды — те, чьи заявки прошли модерацию (approved). Живёт на этапе приёма заявок:
// обычная витрина «Ростер» режет команды по TournamentEntry, а участие в сетке заводят только на
// жеребьёвке — до неё принятые команды видны лишь здесь. Источник и разрез — `listApprovedEntrants`.
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
  const all = await listApprovedEntrants(tournament.id);

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
          Пока ни одна команда не прошла модерацию. Принятые заявки появятся здесь — а капитаны могут
          подать свою команду на вкладке заявки.
        </p>
      ) : (
        <TeamCards teams={teams} />
      )}
    </div>
  );
}
