import Link from "next/link";
import { currentTournament, listTournaments, TOURNAMENT_STATUS_LABELS, type TournamentStatus } from "@/lib/tournaments";
import { Button } from "@/components/pouf/Button";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { STATUS_TONE } from "./_components/fields";
import { FORM_MAX_W } from "@/components/pouf/blocks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Турниры" };

// Список турниров и форма нового. Турнир — контейнер сезона: описание, даты, дивизионы и участники
// (TOURNAMENTS-PLAN.md). Раньше дивизионы были константой в коде, поэтому «завести сезон» означало
// правку исходников и деплой; теперь это форма.

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", year: "numeric" });
const range = (from: Date | null, to: Date | null) =>
  [from && date.format(from), to && date.format(to)].filter(Boolean).join(" — ") || "даты не заданы";

export default async function TournamentsPage() {
  const denied = await denyUnlessPermission("tournaments.edit", "Турниры");
  if (denied) return denied;

  const [tournaments, current] = await Promise.all([listTournaments(), currentTournament()]);

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Служебная часть</p>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight">Турниры</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Сезон или кубок целиком: описание, сроки, дивизионы и составы. Вкладкой в шапке сайта
        открывается турнир со статусом «Идёт» — если такого нет, последний заведённый.
      </p>

      {tournaments.length === 0 ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
          Турниров пока нет.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {tournaments.map((t) => (
            <li key={t.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_TONE[t.status as TournamentStatus] ?? "border-hairline text-ink-subtle"}`}>
                  {TOURNAMENT_STATUS_LABELS[t.status as TournamentStatus] ?? t.status}
                </span>
                <Link href={`/admin/tournaments/${t.slug}`} className="text-sm font-semibold text-accent-bright hover:underline">
                  {t.name}
                </Link>
                <span className="text-xs text-ink-subtle">/{t.slug}</span>
                {/* Какой турнир открывает вкладка в шапке — видно сразу: при двух-трёх сразу
                    непонятно, чьи таблицы показывает сайт. */}
                {t.id === current?.id && (
                  <span className="rounded-md border border-violet-200 bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                    вкладка в шапке
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-ink-subtle">
                {range(t.startAt, t.endAt)} · дивизионов: {t.divisions.length}
                {t.divisions.length > 0 && ` (${t.divisions.map((d) => d.short ?? d.slug).join(", ")})`}
              </p>
              {t.description && <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{t.description}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* Заведение турнира — мастером, а не формой в подвале списка: сезон это не одно
          описание, а цепочка «описание → дивизионы → составы → жеребьёвка», и делать её по
          порядку надёжнее, чем вспоминать, что ещё не заполнено. */}
      <section className="mt-8 rounded-lg border border-hairline bg-surface-1 p-4">
        <h2 className="text-sm font-semibold">Новый турнир</h2>
        <p className="mt-1 text-xs text-ink-subtle">
          Мастер проведёт по шагам: описание → дивизионы → импорт составов → жеребьёвка. Черновик
          создаётся на первом шаге, вернуться и поправить можно в любой момент.
        </p>
        <Link href="/admin/tournaments/new/describe" className="mt-3 inline-block">
          <Button type="button" size="sm">Завести турнир →</Button>
        </Link>
      </section>

    </main>
  );
}
