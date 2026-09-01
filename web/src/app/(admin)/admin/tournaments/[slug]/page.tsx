import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import {
  divisionTeams,
  tournamentBySlug,
  tournamentUsage,
  TOURNAMENT_STATUS_LABELS,
  type TournamentStatus,
} from "@/lib/tournaments";
import { Button } from "@/components/pouf/Button";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { Field, STATUS_TONE } from "../_components/fields";
import { DeleteTournament } from "../_components/delete-tournament";
import { SaveForm } from "../_components/save-form";
import { addDivision, assignTeam, autoDraw, changeStatus, removeDivision, removeTournament, saveDivision, saveDraw, saveTournament } from "../actions";
import { FORM_MAX_W } from "@/components/pouf/blocks";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? t.name : "Турнир" };
}

// Карточка турнира: описание, статус, дивизионы и состав участников. Здесь же живёт единственный
// способ поставить команду в дивизион — `setTeamDivision` (он же чинит зеркало `Team.group`,
// см. src/lib/tournaments.ts). Руками поле дивизиона у команды больше не правят.

/** Дата для <input type="date">: браузер понимает только YYYY-MM-DD. */
const forInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

const STATUSES = Object.keys(TOURNAMENT_STATUS_LABELS) as TournamentStatus[];

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Турнир");
  if (denied) return denied;

  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  const [rosters, teams, usage] = await Promise.all([
    Promise.all(tournament.divisions.map((d) => divisionTeams(d.id))),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, tag: true } }),
    tournamentUsage(tournament.id),
  ]);
  // Команда может играть только в одном дивизионе турнира, поэтому в выпадающем списке «добавить»
  // показываем лишь тех, кого в этом турнире ещё нет.
  const taken = new Set(rosters.flat().map((e) => e.teamId));
  const free = teams.filter((t) => !taken.has(t.id));

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Link href="/admin/tournaments" className="text-xs text-ink-subtle hover:text-ink">
        ← Все турниры
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">{tournament.name}</h1>
        <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_TONE[tournament.status as TournamentStatus] ?? "border-hairline text-ink-subtle"}`}>
          {TOURNAMENT_STATUS_LABELS[tournament.status as TournamentStatus] ?? tournament.status}
        </span>
      </div>

      <nav className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link href={`/admin/tournaments/${tournament.slug}/import`} className="text-accent-bright hover:underline">
          Импорт составов →
        </Link>
        <Link href={`/admin/tournaments/${tournament.slug}/registrations`} className="text-accent-bright hover:underline">
          Заявки команд →
        </Link>
        <Link href={`/tournaments/${tournament.slug}`} className="text-ink-subtle hover:text-ink">
          Публичная страница →
        </Link>
      </nav>

      <section className="mt-4 rounded-lg border border-hairline bg-surface-1 p-4">
        <h2 className="text-sm font-semibold">Статус</h2>
        <p className="mt-1 text-xs text-ink-subtle">
          «Идёт» — тот турнир, который показывают публичные витрины. Он должен быть один: переведёте
          второй — витрины покажут его.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <form key={s} action={changeStatus}>
              <input type="hidden" name="id" value={tournament.id} />
              <input type="hidden" name="slug" value={tournament.slug} />
              <input type="hidden" name="status" value={s} />
              <Button type="submit" size="sm" variant={tournament.status === s ? "solid" : "quiet"}>
                {TOURNAMENT_STATUS_LABELS[s]}
              </Button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-hairline bg-surface-1 p-4">
        <h2 className="text-sm font-semibold">Описание</h2>
        <SaveForm action={saveTournament} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={tournament.id} />
          <input type="hidden" name="slug" value={tournament.slug} />
          <Field name="name" label="Название" value={tournament.name} required />
          <Field name="short" label="Короткое имя" value={tournament.short} placeholder="S3" />
          <Field name="format" label="Формат" value={tournament.format} />
          <Field name="prize" label="Призовой фонд" value={tournament.prize} />
          <Field name="startAt" label="Старт" type="date" value={forInput(tournament.startAt)} />
          <Field name="endAt" label="Финиш" type="date" value={forInput(tournament.endAt)} />
          <Field name="regOpenAt" label="Заявки с" type="date" value={forInput(tournament.regOpenAt)} />
          <Field name="regCloseAt" label="Заявки до" type="date" value={forInput(tournament.regCloseAt)} />
          <div className="sm:col-span-2">
            <Field name="description" label="Описание и регламент" value={tournament.description} textarea />
          </div>
        </SaveForm>
      </section>

      <section className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold">Дивизионы</h2>
        {tournament.divisions.length === 0 && (
          <p className="rounded-md border border-hairline bg-surface-1 px-3 py-4 text-sm text-ink-subtle">
            Дивизионов нет. Пока их нет, турнир нечем наполнять — команды встают именно в дивизион.
          </p>
        )}

        {tournament.divisions.map((d, i) => {
          const entries = rosters[i];
          return (
            <div key={d.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-xs">{d.short ?? d.slug}</span>
                <span className="text-sm font-semibold">{d.name}</span>
                <span className="text-xs text-ink-subtle">/tournaments/{tournament.slug}/{d.slug} · команд: {entries.length}</span>
              </div>

              <form action={saveDivision} className="mt-3 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <Field name="name" label="Название" value={d.name} required />
                <Field name="slug" label="Слаг" value={d.slug} />
                <Field name="short" label="Коротко" value={d.short} />
                <Field name="label" label="Подпись раздела" value={d.label} placeholder="LOST D1" />
                <Field name="orderNo" label="Порядок" type="number" value={d.orderNo} />
                <div className="flex items-end gap-2">
                  <Button type="submit" size="sm">Сохранить</Button>
                </div>
              </form>

              <div className="mt-3 border-t border-hairline pt-3">
                {entries.length === 0 ? (
                  <p className="text-xs text-ink-subtle">Команд пока нет.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {entries.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Link href={`/roster/teams/${e.team.id}`} className="text-accent-bright hover:underline">
                          {e.team.name}
                        </Link>
                        <span className="text-xs text-ink-subtle">{teamTag(e.team)}</span>
                        {/* Жеребьёвка: группа и посев живут в строке участия, а не у команды —
                            в следующем турнире она может попасть в другую группу. */}
                        <form action={saveDraw} className="flex items-center gap-1">
                          <input type="hidden" name="entryId" value={e.id} />
                          <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                          <input
                            name="group"
                            defaultValue={e.group ?? ""}
                            placeholder="гр."
                            className="h-8 w-12 rounded-md border border-hairline bg-surface-2 px-2 text-center text-xs uppercase"
                          />
                          <input
                            name="seed"
                            type="number"
                            defaultValue={e.seed ?? ""}
                            placeholder="№"
                            className="h-8 w-14 rounded-md border border-hairline bg-surface-2 px-2 text-center text-xs"
                          />
                          <Button type="submit" size="sm" variant="quiet">Сохранить</Button>
                        </form>
                        {/* Снимаем из ЭТОГО турнира: без явного id экшен брал «текущий», и кнопка
                            на карточке нового сезона убирала команду из идущего. */}
                        <form action={assignTeam} className="ml-auto">
                          <input type="hidden" name="teamId" value={e.team.id} />
                          <input type="hidden" name="divisionId" value="" />
                          <input type="hidden" name="tournamentId" value={tournament.id} />
                          <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                          <Button type="submit" size="sm" variant="quiet">Убрать</Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                <form action={autoDraw} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="divisionId" value={d.id} />
                  <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                  <label className="block">
                    <span className="text-xs text-ink-muted">Разбить на группы</span>
                    <input
                      name="groups"
                      type="number"
                      min={1}
                      defaultValue={2}
                      className="mt-1 h-9 w-20 rounded-md border border-hairline bg-surface-2 px-2 text-sm"
                    />
                  </label>
                  <Button type="submit" size="sm" variant="quiet" disabled={entries.length === 0}>
                    Жеребьёвка змейкой
                  </Button>
                  <span className="text-[11px] text-ink-subtle">
                    По среднему MMR основы: сильнейшие расходятся по разным группам.
                  </span>
                </form>

                <form action={assignTeam} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="divisionId" value={d.id} />
                  <input type="hidden" name="tournamentId" value={tournament.id} />
                  <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                  <label className="block">
                    <span className="text-xs text-ink-muted">Добавить команду</span>
                    <select
                      name="teamId"
                      className="mt-1 h-9 rounded-md border border-hairline bg-surface-2 px-2 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {free.length ? "— выберите —" : "свободных команд нет"}
                      </option>
                      {free.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" size="sm" variant="quiet" disabled={free.length === 0}>
                    Добавить
                  </Button>
                </form>
              </div>

              <form action={removeDivision} className="mt-3 border-t border-hairline pt-3">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <Button type="submit" size="sm" variant="quiet" disabled={entries.length > 0}>
                  Удалить дивизион
                </Button>
                {entries.length > 0 && (
                  <span className="ml-2 text-[11px] text-ink-subtle">сначала уберите команды</span>
                )}
              </form>
            </div>
          );
        })}

        <div className="rounded-lg border border-hairline bg-surface-1 p-4">
          <h3 className="text-sm font-semibold">Новый дивизион</h3>
          <form action={addDivision} className="mt-3 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
            <Field name="name" label="Название" required placeholder="Division 1" />
            <Field name="slug" label="Слаг" placeholder="d1" />
            <Field name="short" label="Коротко" placeholder="D1" />
            <Field name="label" label="Подпись раздела" placeholder="LOST D1" />
            <Field name="mmrFrom" label="MMR от" type="number" />
            <Field name="mmrTo" label="MMR до" type="number" />
            <div className="sm:col-span-3">
              <Button type="submit" size="sm">Добавить дивизион</Button>
            </div>
          </form>
        </div>
      </section>

      {/* Опасная зона — внизу и отдельной рамкой: удаление сносит сезон целиком, и нажать его
          по дороге к формам выше не должно быть легко. */}
      <section className="mt-8 rounded-lg border border-red-200 bg-surface-1 p-4">
        <h2 className="text-sm font-semibold text-red-700">Удалить турнир</h2>
        <p className="mt-1 text-xs text-ink-subtle">
          Уедет весь сезон: дивизионы, участие команд, составы этого турнира, сетка встреч с картами
          и начисления TP. Команды и игроки останутся в ростере.
        </p>
        <div className="mt-3">
          <DeleteTournament id={tournament.id} name={tournament.name} usage={usage} action={removeTournament} />
        </div>
      </section>
    </main>
  );
}
