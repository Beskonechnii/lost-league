import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentTournament, listTournaments, registrationOpen } from "@/lib/tournaments";
import { buttonClasses } from "@/components/pouf/Button";
import { Eyebrow } from "@/components/pouf/text";
import { Chip, SITE_MAX_W } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { TournamentStatus } from "@/app/_components/tournament-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Турниры" };

// Публичный список турниров лиги, двумя блоками: текущий (тот, что открывается вкладкой в шапке)
// и все остальные. Черновики не показываем: турнир становится виден, когда его открыли на заявки —
// до этого он рабочая заготовка оператора, а не событие лиги.

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

type Row = Awaited<ReturnType<typeof listTournaments>>[number];

/** Промежуток турнира словами: обе даты, одна или ничего — пустых тире в строке быть не должно. */
function period(t: Row) {
  if (t.startAt && t.endAt) return `${date.format(t.startAt)} — ${date.format(t.endAt)}`;
  if (t.startAt) return `с ${date.format(t.startAt)}`;
  if (t.endAt) return `до ${date.format(t.endAt)}`;
  return null;
}

/**
 * Карточка турнира. `current` — текущий сезон лиги: он крупнее и подписан, чтобы было видно, какой
 * именно турнир сейчас показывает сайт (иначе при двух-трёх турнирах непонятно, чьи таблицы
 * открываются с главной). Пометка называет факт о турнире, а не устройство интерфейса: «вкладки
 * в шапке» не существует с Э4b, шапку заменил сайдбар.
 */
function TournamentCard({ t, teams, current = false }: { t: Row; teams: number; current?: boolean }) {
  const dates = period(t);
  const facts = [dates, t.format, t.prize && `призовой ${t.prize}`, teams > 0 && `команд ${teams}`].filter(Boolean);

  return (
    <article className={`rounded-card bg-surface p-5 cushion-card ${current ? "sm:p-6" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <TournamentStatus status={t.status} />
        {current && <Chip accent>Текущий сезон</Chip>}
      </div>

      <h2 className={`mt-3 font-black tracking-tight ${current ? "text-2xl" : "text-lg"}`}>
        <Link href={`/tournaments/${t.slug}`} className="hover:text-[var(--accent-ink)]">
          {t.name}
        </Link>
      </h2>

      {facts.length > 0 && <p className="mt-1.5 text-sm font-bold text-muted">{facts.join(" · ")}</p>}

      {t.divisions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {t.divisions.map((d) => (
            <li key={d.id}>
              <Link
                href={`/tournaments/${t.slug}/${d.slug}`}
                className="inline-flex rounded-chip bg-surface px-3 py-1.5 text-sm font-black text-ink cushion-field transition hover:text-[var(--accent-ink)]"
              >
                {d.label ?? d.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {t.description && (
        <p className={`mt-3 text-sm font-bold leading-[1.55] text-muted ${current ? "line-clamp-4" : "line-clamp-2"}`}>{t.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/tournaments/${t.slug}`} className={buttonClasses({ size: current ? "md" : "sm" })}>
          Открыть турнир
        </Link>
        {registrationOpen(t) && (
          <Link
            href={`/tournaments/${t.slug}/apply`}
            className={buttonClasses({ size: current ? "md" : "sm", variant: "quiet" })}
          >
            Подать заявку командой
          </Link>
        )}
      </div>
    </article>
  );
}

export default async function TournamentsIndex() {
  const [all, current] = await Promise.all([listTournaments(), currentTournament()]);
  const tournaments = all.filter((t) => t.status !== "draft");

  // Команды считаем одним запросом на все турниры: карточек немного, но по запросу на каждую —
  // это ровно тот случай, когда список растёт, а страница тихо тяжелеет.
  const entries = await prisma.tournamentEntry.findMany({ select: { division: { select: { tournamentId: true } } } });
  const teamsOf = new Map<number, number>();
  for (const e of entries) {
    const id = e.division.tournamentId;
    teamsOf.set(id, (teamsOf.get(id) ?? 0) + 1);
  }

  const head = tournaments.find((t) => t.id === current?.id) ?? null;
  const rest = tournaments.filter((t) => t.id !== head?.id);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Eyebrow>Лига</Eyebrow>
      <h1 className="mt-1.5 text-2xl font-black tracking-tight font-pouf">Турниры</h1>

      {tournaments.length === 0 && (
        <div className="mt-6">
          <EmptyState icon="trophy" title="Турниров пока нет">
            Турнир появляется на сайте, когда его открывают на приём заявок — до этого он рабочая
            заготовка организатора.
          </EmptyState>
        </div>
      )}

      {head && (
        <section className="mt-6 font-pouf">
          <Eyebrow className="mb-3">Текущий турнир</Eyebrow>
          <TournamentCard t={head} teams={teamsOf.get(head.id) ?? 0} current />
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-8 font-pouf">
          <Eyebrow className="mb-3">{head ? "Остальные турниры" : "Турниры"}</Eyebrow>
          <div className="grid gap-4 sm:grid-cols-2">
            {rest.map((t) => (
              <TournamentCard key={t.id} t={t} teams={teamsOf.get(t.id) ?? 0} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
