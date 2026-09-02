import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import { tournamentBySlug } from "@/lib/tournaments";
import { listSeries } from "@/lib/series";
import { leagueMatches } from "@/lib/league-matches";
import { resolveBracket } from "@/lib/playoff";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { QueueCard, QueueDecision, QueueNote } from "@/components/pouf/queue-card";
import { pendingForAdminView } from "@/lib/match-request";
import { SeriesAdmin } from "../_components/series-admin";
import type { SlotOptions } from "../_components/types";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { AdminHeader } from "../../../_components/admin-header";
import { Panel } from "../../../_components/panel";
import { approveMeetingRequest, declineMeetingRequest, saveMatchesUrl } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? `Архив · ${t.short ?? t.name}` : "Архив серий" };
}

// Техническая часть архива — внутри турнира: заведение встречи, привязка/отцепка карт,
// перечитывание статы. Наверху (/admin/series) остались только блоки турниров: оператор работает
// с одним сезоном за раз и не должен видеть чужие.
//
// Ссылка «← Все турниры» ушла в крошки (UI-GUIDELINES §3, долг §C3 закрыт на Э9); предложения
// времени от капитанов рисует общая «карточка очереди» Кита — это та же пара решений
// «принять / отклонить с причиной», что в модерации.

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
      <AdminHeader
        crumbs={[{ href: "/admin/series", label: "Архив серий" }]}
        title={tournament.short ?? tournament.name}
      >
        Встречи сезона, их карты и перечитывание статы. Отсюда стата попадает в рейтинги: у встречи
        без карт в статистику не идёт ничего.
      </AdminHeader>

      <div className="mt-6 space-y-4">
        {/* Договорённости капитанов из бота. Наверху страницы, потому что это единственное здесь, что
            ждёт оператора: остальное он открывает сам, когда ему надо. Пусто — блока нет вовсе. */}
        {meetings.length > 0 && (
          <section>
            <h2 className="mb-3 font-pouf text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">
              Время встреч от капитанов: {meetings.length}
            </h2>
            <p className="mb-3 font-pouf text-xs font-bold text-muted">
              Капитаны договорились в боте. Подтверждение запишет время встрече и разошлёт его обеим
              командам; отказ уйдёт обоим капитанам с причиной.
            </p>
            <ul className="space-y-3">
              {meetings.map(({ row, fromTeamName }) => (
                <li key={row.id}>
                  <QueueCard
                    title={`${row.series.home.name} — ${row.series.away.name}`}
                    meta={row.series.divisionRef?.name}
                  >
                    <QueueNote>
                      Предложено: <b className="text-ink">{meetingWhen(row.proposedStartAt)}</b>
                      {row.series.startAt ? ` (сейчас ${meetingWhen(row.series.startAt)})` : " (времени нет)"}
                      <span className="mt-1 block text-[11px] text-muted">
                        Предложил {row.proposedBy.nickname}
                        {fromTeamName ? ` (${fromTeamName})` : ""} — соперник принял.
                      </span>
                    </QueueNote>

                    <QueueDecision>
                      <form action={approveMeetingRequest}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="slug" value={tournament.slug} />
                        <Button type="submit" size="sm">Подтвердить</Button>
                      </form>
                      {/* Отказ отдельной формой: причина обязательна, и она уходит капитанам как есть. */}
                      <form action={declineMeetingRequest} className="flex flex-1 items-end gap-2">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="slug" value={tournament.slug} />
                        <div className="min-w-[12rem] flex-1">
                          <Label htmlFor={`decline-${row.id}`}>Причина отказа</Label>
                          <FormInput
                            id={`decline-${row.id}`}
                            name="reason"
                            size="sm"
                            required
                            placeholder="Почему это время не подходит"
                            className="mt-1.5"
                          />
                        </div>
                        <Button type="submit" size="sm" variant="quiet">Отклонить</Button>
                      </form>
                    </QueueDecision>
                  </QueueCard>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Источник id матчей — у турнира, не у встречи: список матчей общий на сезон. Ссылка — куда
            смотреть глазами, league_id — тикет лиги в Dota 2, по нему список тянется программно и
            проверяется, что привязываемая карта из этого турнира (src/lib/league-matches.ts). */}
        <Panel
          title="Источник id матчей"
          hint="league_id виден в любом матче лиги на OpenDota (поле leagueid). Заполнен — привязка карты проверит, что матч из этого турнира, и не даст подцепить чужой по опечатке."
        >
          <form action={saveMatchesUrl} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="slug" value={tournament.slug} />
            <div className="min-w-[16rem] flex-1">
              <Label htmlFor="matchesUrl">Ссылка на список матчей</Label>
              <FormInput
                id="matchesUrl"
                name="matchesUrl"
                size="sm"
                defaultValue={tournament.matchesUrl ?? ""}
                placeholder="https://liquipedia.net/dota2/… или ссылка на Dotabuff"
                className="mt-1.5"
              />
            </div>
            <div className="w-36">
              <Label htmlFor="leagueId">league_id</Label>
              <FormInput
                id="leagueId"
                name="leagueId"
                size="sm"
                inputMode="numeric"
                defaultValue={tournament.leagueId ?? ""}
                placeholder="19700"
                className="mt-1.5"
              />
            </div>
            <Button type="submit" size="sm">Сохранить</Button>
            {tournament.matchesUrl && (
              <a href={tournament.matchesUrl} target="_blank" rel="noreferrer">
                <Button type="button" size="sm" variant="quiet">Открыть список</Button>
              </a>
            )}
          </form>
        </Panel>

        {/* Матчи лиги: те, которых в архиве ещё нет. Без ключа Steam список не приходит — тогда
            показываем, чего не хватает, а не молчим. */}
        {league && (
          <Panel title={`Матчи лиги ${tournament.leagueId}`}>
            {!league.ok ? (
              <Alert tone="warn" block>{league.error}</Alert>
            ) : missing.length === 0 ? (
              <Alert tone="ok" block>
                Все {league.matches.length} матчей лиги уже привязаны к встречам.
              </Alert>
            ) : (
              <>
                <p className="font-pouf text-xs font-bold text-muted">
                  Ещё не в архиве: {missing.length}. Скопируйте id в «Привязать» у нужной встречи.
                </p>
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {missing.map((m) => (
                    <li key={m.matchId} className="flex flex-wrap items-center gap-2 font-pouf text-xs font-bold text-muted">
                      <code className="rounded-[8px] bg-surface-2 px-2 py-0.5 tabular-nums text-ink cushion-field">
                        {m.matchId}
                      </code>
                      <span>
                        {m.radiantName ?? "Radiant"} vs {m.direName ?? "Dire"}
                      </span>
                      {m.startedAt && <span>{m.startedAt.toLocaleDateString("ru")}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        )}

        <SeriesAdmin
          divisions={divisions.map((d) => ({ id: d.id, name: d.name, label: d.label ?? d.name }))}
          statsHref={divisions[0] ? `/tournaments/${tournament.slug}/${divisions[0].slug}/stats` : "/tournaments"}
          teams={teams.map((e) => ({ id: e.team.id, name: e.team.name, tag: teamTag(e.team), divisionId: e.divisionId }))}
          series={series}
          slots={slots}
        />
      </div>
    </main>
  );
}
