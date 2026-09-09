import Link from "next/link";
import { notFound } from "next/navigation";
import { tournamentBySlug } from "@/lib/tournaments";
import { applicationProblems, listApplications, parseAnswers, parseDraft, type Problem } from "@/lib/team-application";
import { roleLabel } from "@/lib/roles";
import { INVITE_LABEL, isInviteStatus, membersByApplication } from "@/lib/team-invites";
import { Button } from "@/components/pouf/Button";
import { FormSelect, Label } from "@/components/pouf/Input";
import { Alert, EmptyState, StatusPill, type AlertTone } from "@/components/pouf/feedback";
import { QueueCard, QueueNote } from "@/components/pouf/queue-card";
import { Chip, FORM_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../../../_components/permission-gate";
import { AdminHeader } from "../../../../_components/admin-header";
import { ReviewForms } from "./review-forms";
import { enrich, remove, setDivision } from "./actions";
import { rankLabel } from "@/lib/dota-rank";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявки команд" };

// Очередь заявок команд турнира — то, что прислали **снаружи**: капитан с сайта, позже бот.
// Импорт таблицы сюда не попадает: его делает сам оператор, и подтверждать себе нечего — он пишет
// в ростер сразу (см. import/actions.ts).
//
// Показываем не «заявка пришла», а что именно попадёт в ростер: состав целиком и замечания,
// посчитанные по текущей базе. Красное замечание закрывает апрув, жёлтое — на усмотрение оператора.

const dateTime = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Уровень замечания — тон алерта Кита. Раньше здесь была своя таблица сырых оттенков. */
const PROBLEM_TONE: Record<Problem["level"], AlertTone> = {
  block: "err",
  warn: "warn",
  info: "info",
};

/** Состояние заявки — статус-пилюля Кита: это свойство заявки, а не событие. */
const STATUS: Record<string, { label: string; tone: AlertTone | "neutral" }> = {
  pending: { label: "Ждёт решения", tone: "info" },
  approved: { label: "Одобрена", tone: "ok" },
  rejected: { label: "Возвращена", tone: "warn" },
};

export default async function TeamRegistrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Заявки команд");
  if (denied) return denied;

  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  const applications = await listApplications(tournament.id);
  // Ответы позванных — одним запросом на всю очередь, а не по строке на карточку. Считаем их до
  // замечаний: отказ игрока — одно из замечаний (`applicationProblems`).
  const members = await membersByApplication(applications.map((a) => a.id));
  // Замечания считаем только для тех, по кому ещё нужно решение: у одобренных они уже неактуальны,
  // а лишний десяток запросов к базе на каждую строку архива ни к чему.
  const problems = await Promise.all(
    applications.map(async (a) => {
      if (a.status !== "pending") return [] as Problem[];
      const draft = parseDraft(a.payload);
      return draft ? applicationProblems(draft, a.divisionId, members.get(a.id) ?? []) : [];
    }),
  );
  const waiting = applications.filter((a) => a.status === "pending").length;

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader
        crumbs={[
          { href: "/admin/tournaments", label: "Турниры" },
          { href: `/admin/tournaments/${tournament.slug}`, label: tournament.name },
        ]}
        title="Заявки команд"
        aside={waiting > 0 ? <Chip accent>ждут решения: {waiting}</Chip> : undefined}
      >
        Заявки капитанов с сайта. Одобрение заводит команду, игроков и состав и ставит команду в
        выбранный дивизион — до него в ростере не появляется ничего. Составы, которые вы заводите
        сами, идут мимо очереди: импортом таблицы.
      </AdminHeader>

      <div className="mt-6">
        {applications.length === 0 ? (
          <EmptyState icon="mail" title="Заявок с сайта пока нет">
            Они появятся, когда у турнира открыт приём и капитан отправит состав со страницы заявки.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {applications.map((a, i) => {
              const draft = parseDraft(a.payload);
              const answers = parseAnswers(a.payload);
              const status = STATUS[a.status] ?? { label: a.status, tone: "neutral" as const };
              const blocked = problems[i].some((p) => p.level === "block") || !a.divisionId;

              return (
                <li key={a.id}>
                  <QueueCard
                    tags={
                      <>
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        {draft?.tag && <Chip>{draft.tag}</Chip>}
                      </>
                    }
                    title={draft?.name ?? "заявка не читается"}
                    meta={`${a.source} · ${dateTime.format(a.submittedAt)}`}
                  >
                    {draft && (
                      <QueueNote>
                        <ul className="space-y-0.5">
                          {draft.players.map((p, j) => {
                            // Ответ игрока — вторая ступень апрува: решение оператора он не
                            // блокирует, но отказ в составе видно до, а не после одобрения.
                            const answer = (members.get(a.id) ?? []).find(
                              (m) => m.nickname === p.nickname.trim(),
                            );
                            const status = answer && isInviteStatus(answer.status) ? answer.status : null;
                            return (
                            <li key={j} className="text-xs">
                              <span className="font-black text-ink">{p.nickname}</span>
                              {p.realName && <span> · {[p.realName, p.realSurname].filter(Boolean).join(" ")}</span>}
                              <span> · {roleLabel(p.role) ?? "роль не разобрана"}</span>
                              {p.mmr ? <span> · {p.mmr} MMR (заявленный)</span> : null}
                              {p.accountId ? <span> · id {p.accountId}</span> : null}
                              {rankLabel(p.rank) ? <span> · {rankLabel(p.rank)}</span> : null}
                              {status && status !== "invited" && (
                                <span className={status === "accepted" ? " text-[var(--color-ok-ink)]" : " text-[var(--color-warn-ink)]"}>
                                  {" · "}
                                  {INVITE_LABEL[status]}
                                </span>
                              )}
                              {status === "invited" && <span className="text-muted"> · ждём ответа</span>}
                            </li>
                            );
                          })}
                        </ul>
                        <p className="mt-2 text-[11px] text-muted">
                          /{draft.slug}
                          {a.team && (
                            <>
                              {" · "}
                              <Link href={`/roster/teams/${a.team.id}`} className="text-[var(--accent-ink)] hover:underline">
                                уже в ростере
                              </Link>
                            </>
                          )}
                        </p>
                      </QueueNote>
                    )}

                    {answers.length > 0 && (
                      // Ответы на свои вопросы оператора (квиз бота) — их нет ни у импорта, ни у формы
                      // с сайта, поэтому блок появляется только когда есть что показать.
                      <QueueNote>
                        <dl className="space-y-1.5">
                          {answers.map((ans, j) => (
                            <div key={j}>
                              <dt className="text-[11px] text-muted">{ans.question}</dt>
                              <dd className="text-[13px] text-ink">{ans.answer}</dd>
                            </div>
                          ))}
                        </dl>
                      </QueueNote>
                    )}

                    {a.status === "pending" && (
                      <>
                        {problems[i].length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {problems[i].map((p, j) => (
                              <Alert key={j} tone={PROBLEM_TONE[p.level]} block>
                                {p.text}
                              </Alert>
                            ))}
                          </div>
                        )}
                        {!a.divisionId && (
                          <Alert tone="err" block>
                            Дивизион не выбран — команде некуда встать.
                          </Alert>
                        )}

                        <div className="flex flex-wrap items-end gap-3">
                          <form action={setDivision} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <div className="w-[13rem]">
                              <Label htmlFor={`div-${a.id}`}>Дивизион</Label>
                              <FormSelect
                                id={`div-${a.id}`}
                                name="divisionId"
                                size="sm"
                                defaultValue={a.divisionId ?? ""}
                                className="mt-1.5"
                              >
                                <option value="">— не выбран —</option>
                                {tournament.divisions.map((d) => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </FormSelect>
                            </div>
                            <Button type="submit" size="sm" variant="quiet">Сохранить дивизион</Button>
                          </form>

                          <form action={enrich}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <Button type="submit" size="sm" variant="quiet">
                              Подтянуть данные из Steam и OpenDota
                            </Button>
                          </form>
                        </div>

                        <ReviewForms id={a.id} tournamentSlug={tournament.slug} blocked={blocked} />
                      </>
                    )}

                    {a.notes && <Alert tone="warn" block>Причина возврата: {a.notes}</Alert>}

                    <form action={remove}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                      <Button type="submit" size="xs" variant="quiet">Удалить заявку</Button>
                    </form>
                  </QueueCard>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
