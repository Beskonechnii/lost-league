import Link from "next/link";
import { notFound } from "next/navigation";
import {
  divisionTeams,
  registrationOpen,
  tournamentBySlug,
  TOURNAMENT_STATUS_LABELS,
  type TournamentStatus,
} from "@/lib/tournaments";
import { SectionHeader, StatTile } from "@/components/pouf/blocks";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? `${t.name} — о турнире` : "Турнир" };
}

// «О турнире» — то, что осталось от бывшего хаба турнира, когда с него убрали плитки: статус,
// сроки, формат, призовой, регламент и заявка. Отдельной вкладкой, а не корнем турнира: корень
// ведёт в таблицу, потому что за ней сюда и приходят, а регламент читают один раз.

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

/** Цвет плашки статуса — тот же смысл, что в админке, но на витрине. */
const TONE: Record<TournamentStatus, string> = {
  draft: "bg-surface-2 text-ink-subtle",
  registration: "bg-sky-500/20 text-sky-700",
  running: "bg-emerald-500/20 text-emerald-700",
  finished: "bg-amber-500/20 text-amber-700",
};

export default async function TournamentAbout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const rosters = await Promise.all(tournament.divisions.map((d) => divisionTeams(d.id)));
  const status = (tournament.status as TournamentStatus) ?? "draft";
  const teamsTotal = rosters.reduce((n, r) => n + r.length, 0);

  const facts = [
    tournament.startAt && { label: "Старт", value: date.format(tournament.startAt) },
    tournament.endAt && { label: "Финиш", value: date.format(tournament.endAt) },
    tournament.format && { label: "Формат", value: tournament.format },
    tournament.prize && { label: "Призовой", value: tournament.prize },
    { label: "Команд", value: String(teamsTotal) },
    { label: "Дивизионов", value: String(tournament.divisions.length) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Турнир"
        title={tournament.name}
        aside={
          <span className={`rounded-[12px] px-3 py-1 text-xs font-black ${TONE[status]}`}>
            {TOURNAMENT_STATUS_LABELS[status] ?? tournament.status}
          </span>
        }
      />

      {registrationOpen(tournament) && (
        <Link
          href={`/tournaments/${slug}/apply`}
          className="inline-block rounded-[14px] bg-accent-fill px-4 py-[9px] text-[13px] font-black text-[var(--on-accent)] cushion-control"
        >
          Подать заявку командой
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((f) => (
          <StatTile key={f.label} label={f.label} value={f.value} />
        ))}
      </div>

      <section>
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-ink-subtle">Регламент</h2>
        {tournament.description ? (
          <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-ink-muted">{tournament.description}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Регламент ещё не заполнен. Его правит организатор в карточке турнира.
          </p>
        )}
      </section>
    </div>
  );
}
