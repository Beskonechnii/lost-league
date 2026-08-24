import Link from "next/link";
import { notFound } from "next/navigation";
import { tournamentBySlug } from "@/lib/tournaments";
import { applicationProblems, listApplications, parseDraft, type Problem } from "@/lib/team-application";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { denyUnlessPermission } from "../../../../_components/permission-gate";
import { ReviewForms } from "./review-forms";
import { enrich, remove, setDivision } from "./actions";
import { rankLabel } from "@/lib/dota-rank";
import { FORM_MAX_W } from "@/app/_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявки команд" };

// Очередь заявок команд турнира — то, что прислали **снаружи**: капитан с сайта, позже бот.
// Импорт таблицы сюда не попадает: его делает сам оператор, и подтверждать себе нечего — он пишет
// в ростер сразу (см. import/actions.ts).
//
// Показываем не «заявка пришла», а что именно попадёт в ростер: состав целиком и замечания,
// посчитанные по текущей базе. Красное замечание закрывает апрув, жёлтое — на усмотрение оператора.

const dateTime = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

const TONE: Record<Problem["level"], string> = {
  block: "border-rose-900 bg-rose-950/40 text-rose-300",
  warn: "border-amber-900 bg-amber-950/40 text-amber-300",
  info: "border-hairline bg-surface-2 text-ink-subtle",
};

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Ждёт решения", tone: "border-sky-900 bg-sky-950/40 text-sky-300" },
  approved: { label: "Одобрена", tone: "border-emerald-900 bg-emerald-950/40 text-emerald-300" },
  rejected: { label: "Возвращена", tone: "border-amber-900 bg-amber-950/40 text-amber-300" },
};

export default async function TeamRegistrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Заявки команд");
  if (denied) return denied;

  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  const applications = await listApplications(tournament.id);
  // Замечания считаем только для тех, по кому ещё нужно решение: у одобренных они уже неактуальны,
  // а лишний десяток запросов к базе на каждую строку архива ни к чему.
  const problems = await Promise.all(
    applications.map(async (a) => {
      if (a.status !== "pending") return [] as Problem[];
      const draft = parseDraft(a.payload);
      return draft ? applicationProblems(draft, a.divisionId) : [];
    }),
  );

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Link href={`/admin/tournaments/${tournament.slug}`} className="text-xs text-ink-subtle hover:text-ink">
        ← {tournament.name}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Заявки команд</h1>

      </div>
      <p className="mt-1.5 text-sm text-ink-muted">
        Заявки капитанов с сайта. Одобрение заводит команду, игроков и состав и ставит команду в
        выбранный дивизион — до него в ростере не появляется ничего. Составы, которые вы заводите
        сами, идут мимо очереди: импортом таблицы.
      </p>

      {applications.length === 0 ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
          Заявок с сайта пока нет.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {applications.map((a, i) => {
            const draft = parseDraft(a.payload);
            const status = STATUS[a.status] ?? { label: a.status, tone: "border-hairline text-ink-subtle" };
            const blocked = problems[i].some((p) => p.level === "block") || !a.divisionId;

            return (
              <li key={a.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`rounded-md border px-2 py-0.5 text-xs ${status.tone}`}>{status.label}</span>
                  <span className="text-sm font-semibold">{draft?.name ?? "заявка не читается"}</span>
                  {draft?.tag && <span className="text-xs text-ink-subtle">{draft.tag}</span>}
                  <span className="text-xs text-ink-subtle">
                    /{draft?.slug} · {a.source} · {dateTime.format(a.submittedAt)}
                  </span>
                  {a.team && (
                    <Link href={`/roster/teams/${a.team.id}`} className="text-xs text-accent-bright hover:underline">
                      в ростере →
                    </Link>
                  )}
                </div>

                {draft && (
                  <ul className="mt-2 space-y-0.5">
                    {draft.players.map((p, j) => (
                      <li key={j} className="text-xs text-ink-muted">
                        <span className="text-ink">{p.nickname}</span>
                        {p.realName && <span className="text-ink-subtle"> · {p.realName}</span>}
                        <span className="text-ink-subtle"> · {roleLabel(p.role) ?? "роль не разобрана"}</span>
                        {p.mmr ? <span className="text-ink-subtle"> · {p.mmr} MMR (заявленный)</span> : null}
                        {p.accountId ? <span className="text-ink-subtle"> · id {p.accountId}</span> : null}
                        {rankLabel(p.rank) ? <span className="text-ink-subtle"> · {rankLabel(p.rank)}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}

                {a.status === "pending" && (
                  <>
                    <form action={setDivision} className="mt-3 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                      <label className="block">
                        <span className="text-xs text-ink-muted">Дивизион</span>
                        <select
                          name="divisionId"
                          defaultValue={a.divisionId ?? ""}
                          className="mt-1 h-9 rounded-md border border-hairline bg-surface-2 px-2 text-sm"
                        >
                          <option value="">— не выбран —</option>
                          {tournament.divisions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" size="sm" variant="outline">Сохранить дивизион</Button>
                    </form>

                    <form action={enrich} className="mt-2">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                      <Button type="submit" size="sm" variant="ghost">Подтянуть данные из Steam и OpenDota</Button>
                    </form>

                    {problems[i].length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {problems[i].map((p, j) => (
                          <li key={j} className={`rounded-md border px-2 py-1 text-xs ${TONE[p.level]}`}>{p.text}</li>
                        ))}
                      </ul>
                    )}
                    {!a.divisionId && (
                      <p className="mt-2 text-xs text-rose-300">Дивизион не выбран — команде некуда встать.</p>
                    )}

                    <div className="mt-3">
                      <ReviewForms id={a.id} tournamentSlug={tournament.slug} blocked={blocked} />
                    </div>
                  </>
                )}

                {a.notes && <p className="mt-2 text-xs text-amber-300">Причина возврата: {a.notes}</p>}

                <form action={remove} className="mt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                  <Button type="submit" size="sm" variant="ghost">Удалить заявку</Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
