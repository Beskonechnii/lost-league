import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { divisionTeams, tournamentBySlug } from "@/lib/tournaments";
import { teamTag } from "@/lib/profiles";
import { Button } from "@/components/ui/button";
import { denyUnlessPermission } from "../../../../_components/permission-gate";
import { Field } from "../../_components/fields";
import { addDivision, autoDraw, removeDivision, saveDivision, saveDraw } from "../../actions";
import { finishWizard, goToStep, saveDraft } from "../actions";
import { ImportForm } from "../../[slug]/import/import-form";
import { Steps, isStep, stepIndex, WIZARD_STEPS, type StepKey } from "../_components/steps";
import { FORM_MAX_W } from "@/app/_components/ui";

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
  variant = "outline",
  disabled = false,
}: {
  step: StepKey;
  slug: string;
  children: React.ReactNode;
  variant?: "default" | "outline";
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
      <Link href="/admin/tournaments" className="text-xs text-ink-subtle hover:text-ink">
        ← Все турниры
      </Link>

      <h1 className="mt-2 text-xl font-bold tracking-tight">
        {tournament ? tournament.name : "Новый турнир"}
        <span className="ml-2 text-sm font-normal text-ink-subtle">
          шаг {stepIndex(step) + 1} из {WIZARD_STEPS.length}
        </span>
      </h1>

      <div className="mt-4">
        <Steps current={step} slug={tournament?.slug ?? null} />
      </div>

      {/* ── Шаг 1: описание. Он же создаёт черновик ───────────────────────── */}
      {step === "describe" && (
        <section className="mt-5 rounded-lg border border-hairline bg-surface-1 p-4">
          <h2 className="text-sm font-semibold">Описание</h2>
          <p className="mt-1 text-xs text-ink-subtle">
            Достаточно названия — остальное можно дописать потом на карточке турнира. Турнир
            заводится черновиком: публично он не виден, пока вы сами не откроете приём заявок.
          </p>

          <form action={saveDraft} className="mt-3 grid gap-3 sm:grid-cols-2">
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
            <div className="sm:col-span-2">
              <Field name="description" label="Описание и регламент" value={tournament?.description} textarea />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                {tournament ? "Сохранить и дальше →" : "Создать черновик и дальше →"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* ── Шаг 2: дивизионы ──────────────────────────────────────────────── */}
      {step === "divisions" && tournament && (
        <section className="mt-5 space-y-3">
          <div className="rounded-lg border border-hairline bg-surface-1 p-4">
            <h2 className="text-sm font-semibold">Дивизионы</h2>
            <p className="mt-1 text-xs text-ink-subtle">
              Команда встаёт не в турнир, а в дивизион — поэтому без дивизионов дальше идти некуда.
              Один дивизион тоже нормально.
            </p>
          </div>

          {tournament.divisions.map((d, i) => (
            <div key={d.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-xs">{d.short ?? d.slug}</span>
                <span className="text-sm font-semibold">{d.name}</span>
                <span className="text-xs text-ink-subtle">
                  /tournaments/{tournament.slug}/{d.slug} · команд: {rosters[i].length}
                </span>
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

              <form action={removeDivision} className="mt-3 border-t border-hairline pt-3">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <Button type="submit" size="sm" variant="ghost" disabled={rosters[i].length > 0}>
                  Удалить дивизион
                </Button>
                {rosters[i].length > 0 && <span className="ml-2 text-[11px] text-ink-subtle">сначала уберите команды</span>}
              </form>
            </div>
          ))}

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
      )}

      {/* ── Шаг 3: импорт составов ────────────────────────────────────────── */}
      {step === "import" && tournament && (
        <section className="mt-5 space-y-3">
          <div className="rounded-lg border border-hairline bg-surface-1 p-4">
            <h2 className="text-sm font-semibold">Импорт составов</h2>
            <p className="mt-1 text-xs text-ink-subtle">
              Таблица оператора пишется в ростер сразу — подтверждать себе нечего. Шаг можно
              пропустить: составы приедут заявками капитанов.
            </p>
          </div>

          <div className="rounded-lg border border-hairline bg-surface-1 p-4">
            <ImportForm
              tournamentSlug={tournament.slug}
              divisions={tournament.divisions.map((d) => ({ id: d.id, name: d.name, short: d.short ?? d.slug }))}
            />
          </div>
        </section>
      )}

      {/* ── Шаг 4: жеребьёвка ─────────────────────────────────────────────── */}
      {step === "draw" && tournament && (
        <section className="mt-5 space-y-3">
          <div className="rounded-lg border border-hairline bg-surface-1 p-4">
            <h2 className="text-sm font-semibold">Жеребьёвка</h2>
            <p className="mt-1 text-xs text-ink-subtle">
              Змейка разводит команды по группам по среднему MMR основы: сильнейшие расходятся.
              Группу и посев любой команды потом можно поправить руками здесь же. Команд ещё нет —
              шаг можно пропустить и развести группы позже на карточке турнира.
            </p>
          </div>

          {tournament.divisions.length === 0 && (
            <p className="rounded-md border border-hairline bg-surface-1 px-3 py-4 text-sm text-ink-subtle">
              Дивизионов нет — вернитесь на шаг «Дивизионы».
            </p>
          )}

          {tournament.divisions.map((d, i) => (
            <div key={d.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{d.name}</span>
                <span className="text-xs text-ink-subtle">команд: {rosters[i].length}</span>
              </div>

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
                <Button type="submit" size="sm" variant="outline" disabled={rosters[i].length === 0}>
                  Жеребьёвка змейкой
                </Button>
              </form>

              {rosters[i].length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                  {rosters[i].map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-0 truncate">{e.team.name}</span>
                      <span className="text-xs text-ink-subtle">{teamTag(e.team)}</span>
                      <form action={saveDraw} className="ml-auto flex items-center gap-1">
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
                        <Button type="submit" size="sm" variant="ghost">Сохранить</Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Шаг 5: готово ─────────────────────────────────────────────────── */}
      {step === "done" && tournament && (
        <section className="mt-5 space-y-3">
          <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 p-4">
            <h2 className="text-sm font-semibold text-emerald-300">Турнир готов</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Заведён черновиком. Он не виден публично, пока вы не переключите статус на «Приём
              заявок» или «Идёт» — это делается на карточке турнира.
            </p>
          </div>

          <ul className="rounded-lg border border-hairline bg-surface-1 p-4 text-sm">
            <li className="flex justify-between border-b border-hairline/60 py-1.5">
              <span className="text-ink-muted">Дивизионов</span>
              <span className="font-semibold tabular-nums">{tournament.divisions.length}</span>
            </li>
            <li className="flex justify-between border-b border-hairline/60 py-1.5">
              <span className="text-ink-muted">Команд заявлено</span>
              <span className="font-semibold tabular-nums">{teamsTotal}</span>
            </li>
            <li className="flex justify-between py-1.5">
              <span className="text-ink-muted">Разведено по группам</span>
              <span className="font-semibold tabular-nums">
                {drawn} из {teamsTotal}
              </span>
            </li>
          </ul>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/tournaments/${tournament.slug}`} className="text-accent-bright hover:underline">
              Публичная страница турнира →
            </Link>
            <Link href={`/admin/series/${tournament.slug}`} className="text-accent-bright hover:underline">
              Архив серий турнира →
            </Link>
          </div>
        </section>
      )}

      {/* ── Навигация мастера ─────────────────────────────────────────────── */}
      {tournament && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {stepIndex(step) > 0 && (
            <StepLink step={WIZARD_STEPS[stepIndex(step) - 1].key} slug={tournament.slug}>
              ← Назад
            </StepLink>
          )}

          {step === "done" ? (
            <form action={finishWizard}>
              <input type="hidden" name="t" value={tournament.slug} />
              <Button type="submit" size="sm">Открыть карточку турнира →</Button>
            </form>
          ) : (
            step !== "describe" && (
              <StepLink
                step={WIZARD_STEPS[stepIndex(step) + 1].key}
                slug={tournament.slug}
                variant="default"
                // Дальше не пускаем только там, где следующий шаг осмысленно невозможен: без
                // дивизионов команду ставить некуда. Импорт и жеребьёвку пропустить можно —
                // составы приезжают и заявками капитанов, а развести группы можно позже.
                disabled={step === "divisions" && tournament.divisions.length === 0}
              >
                {(step === "import" && teamsTotal === 0) || (step === "draw" && teamsTotal === 0)
                  ? "Пропустить →"
                  : "Дальше →"}
              </StepLink>
            )
          )}

          <Link
            href={`/admin/tournaments/${tournament.slug}`}
            className="ml-auto text-xs text-ink-subtle hover:text-ink"
          >
            Выйти в карточку турнира
          </Link>
        </div>
      )}
    </main>
  );
}
