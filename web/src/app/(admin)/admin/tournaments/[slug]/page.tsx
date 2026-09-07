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
import { FormInput, FormSelect, Label } from "@/components/pouf/Input";
import { DataCell, DataRow, DataTable, RowActions } from "@/components/pouf/data-table";
import { EmptyState } from "@/components/pouf/feedback";
import { PillLink } from "@/components/pouf/tabs";
import { Chip, FORM_MAX_W } from "@/components/pouf/blocks";
import { TournamentStatus as StatusPillOf } from "@/app/_components/tournament-status";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { AdminHeader } from "../../../_components/admin-header";
import { Panel } from "../../../_components/panel";
import { Field } from "../_components/fields";
import { DeleteTournament } from "../_components/delete-tournament";
import { SaveForm } from "../_components/save-form";
import { addDivision, assignTeam, autoDraw, changeStatus, removeDivision, removeTournament, saveDivision, saveDraw, saveTournament } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? t.name : "Турнир" };
}

// Карточка турнира: описание, статус, дивизионы и состав участников. Здесь же живёт единственный
// способ поставить команду в дивизион — `setTeamDivision` (он же чинит зеркало `Team.group`,
// см. src/lib/tournaments.ts). Руками поле дивизиона у команды больше не правят.
//
// Ссылки «← Все турниры» здесь больше нет: путь называют крошки над заголовком, а соседние
// инструменты турнира — ряд пилюль под ним (UI-GUIDELINES §3 и §9, долг закрыт на Э9).

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
      <AdminHeader
        crumbs={[{ href: "/admin/tournaments", label: "Турниры" }]}
        title={tournament.name}
        aside={<StatusPillOf status={tournament.status} />}
      />

      {/* Соседние экраны турнира — ряд пилюль, а не строка ссылок со стрелками: это тот же
          уровень навигации, что вкладки раздела в продукте (UI-GUIDELINES §2, L3). */}
      <nav className="mt-5 flex flex-wrap gap-2">
        <PillLink href={`/admin/roster/import?tournament=${tournament.slug}`}>Импорт составов</PillLink>
        <PillLink href={`/admin/tournaments/${tournament.slug}/registrations`}>Заявки команд</PillLink>
        <PillLink href={`/tournaments/${tournament.slug}`}>Публичная страница</PillLink>
      </nav>

      <div className="mt-6 space-y-4">
        <Panel
          title="Статус"
          hint="«Идёт» — тот турнир, который показывают публичные витрины. Он должен быть один: переведёте второй — витрины покажут его."
        >
          <div className="flex flex-wrap gap-2">
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
        </Panel>

        <Panel title="Описание">
          <SaveForm action={saveTournament} className="grid gap-4 sm:grid-cols-2">
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
            <Field name="description" label="Описание и регламент" value={tournament.description} textarea span={2} />
          </SaveForm>
        </Panel>

        <h2 className="pt-2 font-pouf text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">
          Дивизионы
        </h2>

        {tournament.divisions.length === 0 && (
          <EmptyState icon="users" title="Дивизионов нет">
            Пока их нет, турнир нечем наполнять: команда встаёт не в турнир, а в дивизион.
          </EmptyState>
        )}

        {tournament.divisions.map((d, i) => {
          const entries = rosters[i];
          return (
            <Panel
              key={d.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <Chip>{d.short ?? d.slug}</Chip>
                  {d.name}
                </span>
              }
              aside={<span className="font-pouf text-xs font-bold tabular-nums text-muted">команд: {entries.length}</span>}
              hint={`/tournaments/${tournament.slug}/${d.slug}`}
            >
              <form action={saveDivision} className="grid gap-4 sm:grid-cols-3">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <Field name="name" label="Название" value={d.name} required />
                <Field name="slug" label="Слаг" value={d.slug} />
                <Field name="short" label="Коротко" value={d.short} />
                <Field name="label" label="Подпись раздела" value={d.label} placeholder="LOST D1" />
                <Field name="orderNo" label="Порядок" type="number" value={d.orderNo} />
                <div className="flex items-end">
                  <Button type="submit" size="sm">Сохранить</Button>
                </div>
              </form>

              <div className="mt-4">
                <DataTable
                  caption={`Состав дивизиона ${d.name}`}
                  columns={[
                    { label: "Команда" },
                    { label: "Тег", hideOnNarrow: true },
                    { label: "Группа", align: "center", width: "96px" },
                    { label: "Посев", align: "center", width: "96px" },
                    { label: "", align: "right", width: "1%" },
                  ]}
                  empty={
                    <EmptyState icon="users" title="Команд пока нет">
                      Добавьте их списком ниже или дождитесь заявок капитанов.
                    </EmptyState>
                  }
                >
                  {entries.map((e) => (
                    // Жеребьёвка: группа и посев живут в строке участия, а не у команды —
                    // в следующем турнире она может попасть в другую группу.
                    <DataRow key={e.id}>
                      <DataCell>
                        <Link href={`/roster/teams/${e.team.id}`} className="hover:text-[var(--accent-ink)]">
                          {e.team.name}
                        </Link>
                      </DataCell>
                      <DataCell muted hideOnNarrow>{teamTag(e.team)}</DataCell>
                      <DataCell align="center">
                        <FormInput
                          form={`draw-${e.id}`}
                          name="group"
                          size="sm"
                          defaultValue={e.group ?? ""}
                          placeholder="гр."
                          aria-label="Группа"
                          className="text-center uppercase"
                        />
                      </DataCell>
                      <DataCell align="center">
                        <FormInput
                          form={`draw-${e.id}`}
                          name="seed"
                          type="number"
                          size="sm"
                          defaultValue={e.seed ?? ""}
                          placeholder="№"
                          aria-label="Посев"
                          className="text-center"
                        />
                      </DataCell>
                      <DataCell align="right" nowrap>
                        <RowActions>
                          {/* Форма стоит здесь, а поля группы и посева — в своих ячейках и
                              привязаны к ней атрибутом `form`: обернуть формой несколько <td>
                              нельзя, разметка таблицы этого не допускает. */}
                          <form id={`draw-${e.id}`} action={saveDraw}>
                            <input type="hidden" name="entryId" value={e.id} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <Button type="submit" size="xs" variant="quiet">Сохранить</Button>
                          </form>
                          {/* Снимаем из ЭТОГО турнира: без явного id экшен брал «текущий», и кнопка
                              на карточке нового сезона убирала команду из идущего. */}
                          <form action={assignTeam}>
                            <input type="hidden" name="teamId" value={e.team.id} />
                            <input type="hidden" name="divisionId" value="" />
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <Button type="submit" size="xs" variant="quiet">Убрать</Button>
                          </form>
                        </RowActions>
                      </DataCell>
                    </DataRow>
                  ))}
                </DataTable>
              </div>

              <form action={autoDraw} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="divisionId" value={d.id} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <div>
                  <Label htmlFor={`groups-${d.id}`}>Разбить на группы</Label>
                  <FormInput
                    id={`groups-${d.id}`}
                    name="groups"
                    type="number"
                    min={1}
                    size="sm"
                    defaultValue={2}
                    className="mt-1.5 w-24"
                  />
                </div>
                <Button type="submit" size="sm" variant="quiet" disabled={entries.length === 0}>
                  Жеребьёвка змейкой
                </Button>
                <span className="font-pouf text-[11px] font-bold text-muted">
                  По среднему MMR основы: сильнейшие расходятся по разным группам.
                </span>
              </form>

              <form action={assignTeam} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="divisionId" value={d.id} />
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <div className="min-w-[14rem] flex-1">
                  <Label htmlFor={`add-${d.id}`}>Добавить команду</Label>
                  <FormSelect id={`add-${d.id}`} name="teamId" size="sm" defaultValue="" className="mt-1.5">
                    <option value="" disabled>
                      {free.length ? "— выберите —" : "свободных команд нет"}
                    </option>
                    {free.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </FormSelect>
                </div>
                <Button type="submit" size="sm" variant="quiet" disabled={free.length === 0}>
                  Добавить
                </Button>
              </form>

              <form action={removeDivision} className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <Button type="submit" size="sm" variant="quiet" disabled={entries.length > 0}>
                  Удалить дивизион
                </Button>
                {entries.length > 0 && (
                  <span className="font-pouf text-[11px] font-bold text-muted">сначала уберите команды</span>
                )}
              </form>
            </Panel>
          );
        })}

        <Panel title="Новый дивизион">
          <form action={addDivision} className="grid gap-4 sm:grid-cols-3">
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
        </Panel>

        {/* Опасная зона — внизу и на своей коже: удаление сносит сезон целиком, и нажать его
            по дороге к формам выше не должно быть легко. Раньше зону обводила сырая красная
            рамка (`border-red-200`) — теперь заливка ошибки из токенов Кита. */}
        <section
          className="mt-4 rounded-card px-(--s4) pb-[calc(var(--s4)+var(--lip)/2)] pt-[calc(var(--s4)-var(--lip)/2)] font-pouf cushion-alert"
          style={{ backgroundImage: "var(--grad-err)" }}
        >
          <h2 className="text-[17px] font-black tracking-[-0.2px] text-[var(--color-err-ink)]">Удалить турнир</h2>
          <p className="mt-1 text-xs font-bold leading-[1.5] text-[var(--color-err-ink)]">
            Уедет весь сезон: дивизионы, участие команд, составы этого турнира, сетка встреч с картами
            и начисления TP. Команды и игроки останутся в ростере.
          </p>
          <div className="mt-4">
            <DeleteTournament id={tournament.id} name={tournament.name} usage={usage} action={removeTournament} />
          </div>
        </section>
      </div>
    </main>
  );
}
