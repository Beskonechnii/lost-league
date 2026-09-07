import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { divisionTeams, tournamentBySlug } from "@/lib/tournaments";
import { teamTag } from "@/lib/profiles";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";
import { Alert, EmptyState } from "@/components/pouf/feedback";
import { Stepper } from "@/components/pouf/stepper";
import { DataCell, DataRow, DataTable, RowActions } from "@/components/pouf/data-table";
import { Chip, FORM_MAX_W, StatTile } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../../../_components/permission-gate";
import { AdminHeader } from "../../../../_components/admin-header";
import { Panel } from "../../../../_components/panel";
import { Field } from "../../_components/fields";
import { addDivision, autoDraw, removeDivision, saveDivision, saveDraw } from "../../actions";
import { finishWizard, goToStep, saveDraft } from "../actions";
import { ImportForm } from "../../../roster/import/import-form";
import { isStep, stepIndex, wizardSteps, WIZARD_STEPS, type StepKey } from "../_components/steps";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новый турнир" };

// Мастер создания турнира: Описание → Дивизионы → Импорт составов → Жеребьёвка → Готово.
// Каждый шаг — свой экран со своим смыслом, вместо одной длинной карточки, где непонятно, что уже
// сделано. Черновик заводится на первом шаге и живёт в БД: прогресс не теряется при закрытой вкладке,
// а номер шага виден в адресе. Заявок команд в цепочке нет — это отдельная логика, не создание.
//
// Формы шагов — те же, что в карточке турнира (`../actions.ts`): мастер их раскладывает по экранам,
// а не заводит вторую реализацию. Карточка остаётся местом правки уже заведённого турнира.

/** Дата для <input type="date">: браузер понимает только YYYY-MM-DD. */
const forInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Кнопка перехода на шаг — обычная форма, чтобы «дальше» работало и без JS. */
function StepLink({
  step,
  slug,
  children,
  variant = "quiet",
  disabled = false,
}: {
  step: StepKey;
  slug: string;
  children: React.ReactNode;
  variant?: "solid" | "quiet";
  disabled?: boolean;
}) {
  return (
    <form action={goToStep}>
      <input type="hidden" name="step" value={step} />
      <input type="hidden" name="t" value={slug} />
      <Button type="submit" size="sm" variant={variant} disabled={disabled}>
        {children}
      </Button>
    </form>
  );
}

export default async function WizardStep({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const denied = await denyUnlessPermission("tournaments.edit", "Новый турнир");
  if (denied) return denied;

  const { step } = await params;
  if (!isStep(step)) notFound();
  const slug = (await searchParams).t ?? null;

  // Черновик обязателен везде, кроме первого шага: остальным шагам не к чему цепляться.
  const tournament = slug ? await tournamentBySlug(slug) : null;
  if (step !== "describe" && !tournament) redirect("/admin/tournaments/new/describe");

  const rosters = tournament ? await Promise.all(tournament.divisions.map((d) => divisionTeams(d.id))) : [];
  const teamsTotal = rosters.reduce((n, r) => n + r.length, 0);
  const drawn = rosters.flat().filter((e) => e.group).length;

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader
        crumbs={[{ href: "/admin/tournaments", label: "Турниры" }]}
        eyebrow="Новый турнир"
        title={tournament ? tournament.name : "Новый турнир"}
        aside={<Chip>шаг {stepIndex(step) + 1} из {WIZARD_STEPS.length}</Chip>}
      />

      <div className="mt-6">
        <Stepper steps={wizardSteps(tournament?.slug ?? null)} current={stepIndex(step)} />
      </div>

      <div className="space-y-4">
        {/* ── Шаг 1: описание. Он же создаёт черновик ───────────────────────── */}
        {step === "describe" && (
          <Panel
            title="Описание"
            hint="Достаточно названия — остальное можно дописать потом на карточке турнира. Турнир заводится черновиком: публично он не виден, пока вы сами не откроете приём заявок."
          >
            <form action={saveDraft} className="grid gap-4 sm:grid-cols-2">
              {tournament && <input type="hidden" name="id" value={tournament.id} />}
              <input type="hidden" name="current" value={tournament?.slug ?? ""} />
              <Field name="name" label="Название" value={tournament?.name} required placeholder="LOST Season 3" />
              <Field name="slug" label="Слаг" value={tournament?.slug} placeholder="s3" hint="Живёт в адресе: /tournaments/s3" />
              <Field name="short" label="Короткое имя" value={tournament?.short} placeholder="S3" />
              <Field name="format" label="Формат" value={tournament?.format} placeholder="2 дивизиона, группа + плей-офф" />
              <Field name="prize" label="Призовой фонд" value={tournament?.prize} />
              <Field name="startAt" label="Старт" type="date" value={forInput(tournament?.startAt ?? null)} />
              <Field name="endAt" label="Финиш" type="date" value={forInput(tournament?.endAt ?? null)} />
              <Field name="regOpenAt" label="Заявки с" type="date" value={forInput(tournament?.regOpenAt ?? null)} />
              <Field name="regCloseAt" label="Заявки до" type="date" value={forInput(tournament?.regCloseAt ?? null)} />
              <Field name="description" label="Описание и регламент" value={tournament?.description} textarea span={2} />
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">
                  {tournament ? "Сохранить и дальше" : "Создать черновик и дальше"}
                </Button>
              </div>
            </form>
          </Panel>
        )}

        {/* ── Шаг 2: дивизионы ──────────────────────────────────────────────── */}
        {step === "divisions" && tournament && (
          <>
            <Alert tone="info" block>
              Команда встаёт не в турнир, а в дивизион — поэтому без дивизионов дальше идти некуда.
              Один дивизион тоже нормально.
            </Alert>

            {tournament.divisions.map((d, i) => (
              <Panel
                key={d.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <Chip>{d.short ?? d.slug}</Chip>
                    {d.name}
                  </span>
                }
                aside={
                  <span className="font-pouf text-xs font-bold tabular-nums text-muted">
                    команд: {rosters[i].length}
                  </span>
                }
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

                <form action={removeDivision} className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                  <Button type="submit" size="sm" variant="quiet" disabled={rosters[i].length > 0}>
                    Удалить дивизион
                  </Button>
                  {rosters[i].length > 0 && (
                    <span className="font-pouf text-[11px] font-bold text-muted">сначала уберите команды</span>
                  )}
                </form>
              </Panel>
            ))}

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
          </>
        )}

        {/* ── Шаг 3: импорт составов ────────────────────────────────────────── */}
        {step === "import" && tournament && (
          <>
            <Alert tone="info" block>
              Таблица оператора пишется в ростер сразу — подтверждать себе нечего. Шаг можно
              пропустить: составы приедут заявками капитанов.
            </Alert>
            <ImportForm
              tournaments={[{
                slug: tournament.slug,
                name: tournament.name,
                divisions: tournament.divisions.map((d) => ({ id: d.id, name: d.name })),
              }]}
              defaultDivisionId={tournament.divisions[0]?.id ?? null}
            />
          </>
        )}

        {/* ── Шаг 4: жеребьёвка ─────────────────────────────────────────────── */}
        {step === "draw" && tournament && (
          <>
            <Alert tone="info" block>
              Змейка разводит команды по группам по среднему MMR основы: сильнейшие расходятся.
              Группу и посев любой команды потом можно поправить руками здесь же — или позже на
              карточке турнира.
            </Alert>

            {tournament.divisions.length === 0 && (
              <EmptyState icon="users" title="Дивизионов нет">
                Вернитесь на шаг «Дивизионы»: разводить по группам пока нечего.
              </EmptyState>
            )}

            {tournament.divisions.map((d, i) => (
              <Panel
                key={d.id}
                title={d.name}
                aside={
                  <span className="font-pouf text-xs font-bold tabular-nums text-muted">
                    команд: {rosters[i].length}
                  </span>
                }
              >
                <form action={autoDraw} className="flex flex-wrap items-end gap-3">
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
                  <Button type="submit" size="sm" variant="quiet" disabled={rosters[i].length === 0}>
                    Жеребьёвка змейкой
                  </Button>
                </form>

                <div className="mt-4">
                  <DataTable
                    caption={`Жеребьёвка дивизиона ${d.name}`}
                    columns={[
                      { label: "Команда" },
                      { label: "Тег", hideOnNarrow: true },
                      { label: "Группа", align: "center", width: "96px" },
                      { label: "Посев", align: "center", width: "96px" },
                      { label: "", align: "right", width: "1%" },
                    ]}
                    empty={
                      <EmptyState icon="users" title="Команд пока нет">
                        Шаг можно пропустить: составы приедут импортом или заявками капитанов.
                      </EmptyState>
                    }
                  >
                    {rosters[i].map((e) => (
                      <DataRow key={e.id}>
                        <DataCell>{e.team.name}</DataCell>
                        <DataCell muted hideOnNarrow>{teamTag(e.team)}</DataCell>
                        <DataCell align="center">
                          <FormInput
                            form={`wdraw-${e.id}`}
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
                            form={`wdraw-${e.id}`}
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
                            <form id={`wdraw-${e.id}`} action={saveDraw}>
                              <input type="hidden" name="entryId" value={e.id} />
                              <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                              <Button type="submit" size="xs" variant="quiet">Сохранить</Button>
                            </form>
                          </RowActions>
                        </DataCell>
                      </DataRow>
                    ))}
                  </DataTable>
                </div>
              </Panel>
            ))}
          </>
        )}

        {/* ── Шаг 5: готово ─────────────────────────────────────────────────── */}
        {step === "done" && tournament && (
          <>
            <Alert tone="ok" block>
              Турнир заведён черновиком. Публично он не виден, пока вы не переключите статус на
              «Приём заявок» или «Идёт» — это делается на карточке турнира.
            </Alert>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Дивизионов" value={tournament.divisions.length} />
              <StatTile label="Команд заявлено" value={teamsTotal} />
              <StatTile label="Разведено по группам" value={drawn} hint={`из ${teamsTotal}`} />
            </div>

            <Panel title="Куда дальше">
              <nav className="flex flex-wrap gap-3 font-pouf text-sm font-bold">
                <Link href={`/tournaments/${tournament.slug}`} className="text-[var(--accent-ink)] hover:underline">
                  Публичная страница турнира
                </Link>
                <Link href={`/admin/series/${tournament.slug}`} className="text-[var(--accent-ink)] hover:underline">
                  Архив серий турнира
                </Link>
              </nav>
            </Panel>
          </>
        )}
      </div>

      {/* ── Навигация мастера ─────────────────────────────────────────────── */}
      {tournament && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {stepIndex(step) > 0 && (
            <StepLink step={WIZARD_STEPS[stepIndex(step) - 1].key} slug={tournament.slug}>
              Назад
            </StepLink>
          )}

          {step === "done" ? (
            <form action={finishWizard}>
              <input type="hidden" name="t" value={tournament.slug} />
              <Button type="submit" size="sm">Открыть карточку турнира</Button>
            </form>
          ) : (
            step !== "describe" && (
              <StepLink
                step={WIZARD_STEPS[stepIndex(step) + 1].key}
                slug={tournament.slug}
                variant="solid"
                // Дальше не пускаем только там, где следующий шаг осмысленно невозможен: без
                // дивизионов команду ставить некуда. Импорт и жеребьёвку пропустить можно —
                // составы приезжают и заявками капитанов, а развести группы можно позже.
                disabled={step === "divisions" && tournament.divisions.length === 0}
              >
                {(step === "import" && teamsTotal === 0) || (step === "draw" && teamsTotal === 0)
                  ? "Пропустить"
                  : "Дальше"}
              </StepLink>
            )
          )}

          <Link
            href={`/admin/tournaments/${tournament.slug}`}
            className="ml-auto font-pouf text-xs font-bold text-muted hover:text-ink"
          >
            Выйти в карточку турнира
          </Link>
        </div>
      )}
    </main>
  );
}
