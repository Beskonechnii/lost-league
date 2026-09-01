import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import { tournamentBySlug } from "@/lib/tournaments";
import { listSeries } from "@/lib/series";
import { leagueMatches } from "@/lib/league-matches";
import { resolveBracket } from "@/lib/playoff";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { pendingForAdminView } from "@/lib/match-request";
import { SeriesAdmin, type SlotOptions } from "../_components/series-admin";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { approveMeetingRequest, declineMeetingRequest, saveMatchesUrl } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? `Архив · ${t.short ?? t.name}` : "Архив серий" };
}

// Техническая часть архива — внутри турнира: заведение встречи, привязка/отцепка карт,
// перечитывание статы. Наверху (/admin/series) остались только блоки турниров: оператор работает
// с одним сезоном за раз и не должен видеть чужие.

/** «29 августа, 20:00» — как это увидят игроки в уведомлении, чтобы оператор сверял то же самое. */
const meetingWhen = (d: Date): string =>
  d.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default async function TournamentSeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("series.edit", "Архив серий");
  if (denied) return denied;

  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  const divisions = tournament.divisions;
  const [teams, series, ...brackets] = await Promise.all([
    // Команды берём через участие в турнире: дивизион команды — это строка `TournamentEntry`,
    // а не поле у неё (см. src/lib/tournaments.ts).
    prisma.tournamentEntry.findMany({
      where: { divisionId: { in: divisions.map((d) => d.id) } },
      include: { team: { select: { id: true, name: true, tag: true } } },
      orderBy: { team: { name: "asc" } },
    }),
    listSeries({ divisionIds: divisions.map((d) => d.id) }),
    ...divisions.map((d) => resolveBracket(d.id)),
  ]);

  // Предложения времени, о которых капитаны уже договорились в боте (BOT-PLAN Э8). Ждут одного
  // нажатия: подтверждение пишет время встрече и рассылает его обеим командам.
  const meetings = await pendingForAdminView(divisions.map((d) => d.id));

  // Матчи лиги — подсказка «какие id вообще есть», чтобы не вводить их из головы. Тянем только
  // когда league_id задан; уже привязанные из списка убираем — оператору нужны недостающие.
  const league = tournament.leagueId ? await leagueMatches(tournament.leagueId) : null;
  const attached = new Set(series.flatMap((s) => s.games.map((g) => g.openDotaMatchId).filter(Boolean)));
  const missing = league?.ok ? league.matches.filter((m) => !attached.has(m.matchId)) : [];

  // Слоты сетки для формы: с уже подставленными командами (когда исход известен) и пометкой
  // «занят». Форма выбирает дивизион на клиенте, поэтому шлём слоты всех дивизионов разом.
  const slots: SlotOptions = {};
  divisions.forEach((d, i) => {
    slots[d.id] = brackets[i].slots.map((s) => ({
      key: s.key,
      label: s.label,
      round: s.round,
      bestOf: s.bestOf,
      aTeamId: s.a.team?.teamId ?? null,
      bTeamId: s.b.team?.teamId ?? null,
      aName: s.a.team?.name ?? s.a.placeholder ?? "—",
      bName: s.b.team?.name ?? s.b.placeholder ?? "—",
      taken: s.seriesSlug != null,
    }));
  });

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Link href="/admin/series" className="text-sm font-bold text-ink-muted hover:text-accent-bright">
        ← Все турниры
      </Link>

      {/* Договорённости капитанов из бота. Наверху страницы, потому что это единственное здесь, что
          ждёт оператора: остальное он открывает сам, когда ему надо. Пусто — блока нет вовсе. */}
      {meetings.length > 0 && (
        <section className="mt-4 rounded-lg border border-hairline bg-surface-1 p-3">
          <h2 className="text-sm font-bold text-ink">Время встреч от капитанов: {meetings.length}</h2>
          <p className="mt-1 text-[11px] text-ink-subtle">
            Капитаны договорились в боте. Подтверждение запишет время встрече и разошлёт его обеим
            командам; отказ уйдёт обоим капитанам с причиной.
          </p>
          <ul className="mt-3 space-y-3">
            {meetings.map(({ row, fromTeamName }) => (
              <li key={row.id} className="rounded-md border border-hairline bg-surface-2 p-3">
                <div className="text-sm font-bold text-ink">
                  {row.series.home.name} — {row.series.away.name}
                  {row.series.divisionRef && (
                    <span className="ml-2 font-normal text-ink-subtle">{row.series.divisionRef.name}</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  Предложено: <b>{meetingWhen(row.proposedStartAt)}</b>
                  {row.series.startAt ? ` (сейчас ${meetingWhen(row.series.startAt)})` : " (времени нет)"}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-subtle">
                  Предложил {row.proposedBy.nickname}
                  {fromTeamName ? ` (${fromTeamName})` : ""} — соперник принял.
                </div>

                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <form action={approveMeetingRequest}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="slug" value={tournament.slug} />
                    <button
                      type="submit"
                      className="rounded-md bg-accent-fill px-3 py-1.5 text-sm font-semibold text-[var(--on-accent)]"
                    >
                      Подтвердить
                    </button>
                  </form>
                  {/* Отказ отдельной формой: причина обязательна, и она уходит капитанам как есть. */}
                  <form action={declineMeetingRequest} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="slug" value={tournament.slug} />
                    <input
                      name="reason"
                      required
                      placeholder="причина отказа"
                      className="w-56 rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-sm text-ink"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-hairline px-3 py-1.5 text-sm font-semibold text-ink-muted"
                    >
                      Отклонить
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Источник id матчей — у турнира, не у встречи: список матчей общий на сезон. Ссылка — куда
          смотреть глазами, league_id — тикет лиги в Dota 2, по нему список тянется программно и
          проверяется, что привязываемая карта из этого турнира (src/lib/league-matches.ts). */}
      <form action={saveMatchesUrl} className="mt-4 rounded-lg border border-hairline bg-surface-1 p-3">
        <input type="hidden" name="slug" value={tournament.slug} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="matchesUrl" className="block text-xs text-ink-subtle">
              Источник id матчей турнира
            </label>
            <input
              id="matchesUrl"
              name="matchesUrl"
              defaultValue={tournament.matchesUrl ?? ""}
              placeholder="https://liquipedia.net/dota2/… или ссылка на Dotabuff"
              className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-sm text-ink"
            />
          </div>
          <div className="w-36">
            <label htmlFor="leagueId" className="block text-xs text-ink-subtle">
              league_id
            </label>
            <input
              id="leagueId"
              name="leagueId"
              inputMode="numeric"
              defaultValue={tournament.leagueId ?? ""}
              placeholder="19700"
              className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-sm text-ink"
            />
          </div>
          <button type="submit" className="rounded-md bg-accent-fill px-3 py-1.5 text-sm font-semibold text-[var(--on-accent)]">
            Сохранить
          </button>
          {tournament.matchesUrl && (
            <a
              href={tournament.matchesUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-hairline px-3 py-1.5 text-sm font-semibold text-accent-bright"
            >
              Открыть →
            </a>
          )}
        </div>
        <p className="mt-2 text-[11px] text-ink-subtle">
          league_id виден в любом матче лиги на OpenDota (поле leagueid). Заполнен — привязка карты
          проверит, что матч из этого турнира, и не даст подцепить чужой по опечатке.
        </p>
      </form>

      {/* Матчи лиги: те, которых в архиве ещё нет. Без ключа Steam список не приходит — тогда
          показываем, чего не хватает, а не молчим. */}
      {league && (
        <section className="mt-3 rounded-lg border border-hairline bg-surface-1 p-3">
          {!league.ok ? (
            <p className="text-xs text-amber-700">{league.error}</p>
          ) : missing.length === 0 ? (
            <p className="text-xs text-ink-subtle">
              Матчи лиги {tournament.leagueId}: все {league.matches.length} уже привязаны к встречам.
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-muted">
                Матчи лиги {tournament.leagueId}, которых нет в архиве: {missing.length}. Скопируйте id
                в «Привязать» у нужной встречи.
              </p>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {missing.map((m) => (
                  <li key={m.matchId} className="flex flex-wrap items-center gap-2 text-xs">
                    <code className="rounded bg-surface-2 px-2 py-0.5 text-ink">{m.matchId}</code>
                    <span className="text-ink-subtle">
                      {m.radiantName ?? "Radiant"} vs {m.direName ?? "Dire"}
                    </span>
                    {m.startedAt && (
                      <span className="text-ink-subtle">{m.startedAt.toLocaleDateString("ru")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="mt-4">
        <SeriesAdmin
          divisions={divisions.map((d) => ({ id: d.id, name: d.name, label: d.label ?? d.name }))}
          statsHref={divisions[0] ? `/tournaments/${tournament.slug}/${divisions[0].slug}/stats` : "/tournaments"}
          teams={teams.map((e) => ({ id: e.team.id, name: e.team.name, tag: teamTag(e.team), divisionId: e.divisionId }))}
          series={series}
          slots={slots}
          tournamentName={tournament.short ?? tournament.name}
        />
      </div>
    </main>
  );
}
