import Link from "next/link";
import { notFound } from "next/navigation";
import { divisionTeams, registrationOpen, tournamentBySlug } from "@/lib/tournaments";
import { READ_MAX_W, SectionHeader, StatTile } from "@/components/pouf/blocks";
import { Heading } from "@/components/pouf/text";
import { TournamentStatus } from "@/app/_components/tournament-status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? `${t.name} — о турнире` : "Турнир" };
}

// Обзор турнира: статус, сроки, формат, призовой, дивизионы и регламент. Отдельной вкладкой, а не
// корнем турнира: корень (`/tournaments/<slug>`) ведёт в таблицу, потому что за ней сюда и приходят,
// а регламент читают один раз. Хабом с плитками этот экран не является — плитки ведут не «в разделы»,
// а прямо в таблицу нужного дивизиона, то есть на данные (UI-GUIDELINES §9).

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

export default async function TournamentAbout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const rosters = await Promise.all(tournament.divisions.map((d) => divisionTeams(d.id)));
  const teamsTotal = rosters.reduce((n, r) => n + r.length, 0);

  const facts = [
    tournament.startAt && { label: "Старт", value: date.format(tournament.startAt) },
    tournament.endAt && { label: "Финиш", value: date.format(tournament.endAt) },
    tournament.format && { label: "Формат", value: tournament.format },
    tournament.prize && { label: "Призовой", value: tournament.prize, accent: true },
    { label: "Команд", value: String(teamsTotal) },
    { label: "Дивизионов", value: String(tournament.divisions.length) },
  ].filter(Boolean) as { label: string; value: string; accent?: boolean }[];

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Турнир"
        title={tournament.name}
        aside={<TournamentStatus status={tournament.status} />}
      />

      {registrationOpen(tournament) && (
        <Link
          href={`/tournaments/${slug}/apply`}
          className="inline-block rounded-control bg-accent-fill px-6 py-3.5 text-[15px] font-black text-[var(--on-accent)] cushion-control transition hover:-translate-y-0.5"
        >
          Подать заявку командой
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((f) => (
          <StatTile key={f.label} label={f.label} value={f.value} accent={f.accent} />
        ))}
      </div>

      {/* Дивизионы ведут прямо в таблицу — это не «список разделов», а короткий путь к данным для
          того, кто пришёл на турнир впервые и ещё не понял, что дивизион переключается в строке. */}
      {tournament.divisions.length > 0 && (
        <section className="space-y-4">
          <Heading level={2}>Дивизионы</Heading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournament.divisions.map((d, i) => (
              <Link
                key={d.id}
                href={`/tournaments/${slug}/${d.slug}`}
                className="flex items-center gap-4 rounded-card bg-surface-1 p-5 cushion-card transition hover:-translate-y-0.5"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-accent-fill text-lg font-black text-[var(--on-accent)] cushion-control">
                  {d.short}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-black tracking-[-0.3px] text-ink">
                    {d.label ?? d.name}
                  </span>
                  <span className="block text-xs font-extrabold text-muted">
                    {rosters[i].length} команд · таблица и плей-офф
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={`${READ_MAX_W} space-y-3`}>
        <Heading level={2}>Регламент</Heading>
        {tournament.description ? (
          <p className="whitespace-pre-line text-[15px] font-bold leading-[1.6] text-ink-muted">
            {tournament.description}
          </p>
        ) : (
          // Пустое состояние: что это за блок, почему пусто и кто это чинит.
          <p className="rounded-card bg-surface-1 p-6 text-sm font-bold text-muted cushion-field">
            Регламент ещё не заполнен. Его правит организатор в карточке турнира — до тех пор формат
            и правила стоит спрашивать в чате лиги.
          </p>
        )}
      </section>
    </div>
  );
}
