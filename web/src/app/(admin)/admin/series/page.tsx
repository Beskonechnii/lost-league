import Link from "next/link";
import { tournamentArchive } from "@/lib/series";
import { TOURNAMENT_STATUS_LABELS, type TournamentStatus } from "@/lib/tournaments";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../_components/permission-gate";

export const dynamic = "force-dynamic";

export const metadata = { title: "Архив серий" };

// Вход в архив: блоки турниров, а не все встречи разом. Техническая часть — заведение встречи,
// привязка и перечитывание карт — живёт на уровень глубже, в /admin/series/<турнир>: 90% времени
// оператору нужен один сезон, а страница читалась как приборная панель всех сезонов сразу.

const TONE: Record<string, string> = {
  draft: "bg-surface-2 text-ink-subtle",
  registration: "bg-sky-500/20 text-sky-700",
  running: "bg-emerald-500/20 text-emerald-700",
  finished: "bg-amber-500/20 text-amber-700",
};

export default async function SeriesArchiveHome() {
  const denied = await denyUnlessPermission("series.edit", "Архив серий");
  if (denied) return denied;

  const tournaments = await tournamentArchive();

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Служебная часть</p>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight">Архив серий</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Выберите турнир — встречи, карты и перечитывание статы внутри. Отсюда стата попадает в
        рейтинги: у встречи без карт в статистику не идёт ничего.
      </p>

      {tournaments.length === 0 ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
          Турниров ещё нет — заведите первый в «Турнирах».
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/series/${t.slug}`}
                className="block rounded-lg border border-hairline bg-surface-1 p-4 transition hover:border-accent/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{t.short ?? t.name}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs ${TONE[t.status] ?? TONE.draft}`}>
                    {TOURNAMENT_STATUS_LABELS[t.status as TournamentStatus] ?? t.status}
                  </span>
                  {/* Незаполненные встречи — то, ради чего сюда и заходят: без карт нет статы. */}
                  {t.empty > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {t.empty} без карт
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-ink-subtle">
                  {t.divisions.length > 0 ? t.divisions.map((d) => d.short ?? d.name).join(" · ") : "дивизионов нет"}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-ink-muted">
                  <span>
                    <span className="font-semibold text-ink">{t.series}</span> встреч
                  </span>
                  <span>
                    <span className="font-semibold text-ink">{t.games}</span> карт привязано
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
