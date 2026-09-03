import Link from "next/link";
import { notFound } from "next/navigation";
import { registrationOpen, teamsInTournament, tournamentBySlug } from "@/lib/tournaments";
import { currentAccount } from "@/lib/account";
import { myApplications, parseDraft } from "@/lib/team-application";
import { botStartLink } from "@/lib/telegram";
import { slugify } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { INVITE_LABEL, isInviteStatus, membersByApplication } from "@/lib/team-invites";
import { Chip, SectionHeader } from "@/components/pouf/blocks";
import { Alert, type AlertTone } from "@/components/pouf/feedback";
import { ApplyBoard } from "./apply-board";
import { applyPool, takenSpots, captainReadyTeams, type PoolEntry } from "./pool";
import { placeByRole } from "./slots";
import type { TeamDraft } from "@/lib/roster-import";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявка команды" };

// Заявка капитана на турнир. Состав собирается мышью из пула игроков лиги (BOT-PLAN.md, Э5) и
// попадает в ту же очередь `TeamApplication`, что и импорт файла, — разница только в `source`.
// Приём открыт, пока турнир в статусе «Приём заявок».

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

/** Состояние заявки словом и тоном Кита: «возвращена» — это не ошибка сайта, а решение модератора. */
const STATUS: Record<string, { label: string; tone: AlertTone }> = {
  pending: { label: "На рассмотрении", tone: "info" },
  approved: { label: "Принята", tone: "ok" },
  rejected: { label: "Возвращена", tone: "warn" },
};

/**
 * Прежняя заявка → слоты доски. Игрока ищем в пуле по account_id, затем по слагу ника — теми же
 * ключами, что и апрув (`findPlayer` в team-application.ts). Кого в пуле нет (заявка из старого
 * квиза бота, где ник вписывали руками), в состав не подставляем — об этом честно пишем капитану.
 */
function toSlots(draft: TeamDraft, pool: PoolEntry[]) {
  const byAccount = new Map(pool.map((p) => [p.accountId, p]));
  const bySlug = new Map(pool.map((p) => [slugify(p.nickname), p]));
  const rows: { id: number; role: string | null; isCaptain: boolean }[] = [];
  let lost = 0;

  for (const row of draft.players) {
    const found = (row.accountId ? byAccount.get(row.accountId) : null) ?? bySlug.get(slugify(row.nickname)) ?? null;
    if (!found) {
      lost++;
      continue;
    }
    rows.push({ id: found.id, role: row.role, isCaptain: row.isCaptain });
  }
  return { ...placeByRole(rows), lost };
}

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const me = await currentAccount();
  const all = me ? await myApplications(me.id, tournament.id) : [];
  const open = registrationOpen(tournament);

  // «Принята» — только если команда реально в турнире (есть участие). Одобренная заявка без участия
  // осиротела: команду сняли или сетку пересобрали. Такую заявку для подачи не показываем — иначе
  // висело бы «состав уже в турнире» у команды, которой в турнире нет. Капитан заявляется заново,
  // а повторная отправка переиспользует ту же строку (`submitTeamApplication`), не плодя очередь.
  const inTournament = await teamsInTournament(
    tournament.id,
    all.map((a) => a.teamId).filter((id): id is number => id != null),
  );
  const mine = all.filter(
    (a) =>
      a.status === "pending" ||
      a.status === "rejected" ||
      (a.status === "approved" && a.teamId != null && inTournament.has(a.teamId)),
  );

  // Своя заявка открывается на правку, а не заводит вторую строку в очереди: повторная подача —
  // это досыл правок, а не новая команда. Принятая тоже правится (замена, ушедший игрок) — тогда
  // она вернётся на модерацию той же строкой (`submitTeamApplication`).
  const editable =
    mine.find((a) => a.status === "pending" || a.status === "rejected") ??
    mine.find((a) => a.status === "approved") ??
    null;
  const editableDraft = editable ? parseDraft(editable.payload) : null;

  const needBoard = !!me && open;
  const [pool, taken, inviteUrl] = needBoard
    ? await Promise.all([
        applyPool(),
        takenSpots(tournament.divisions.map((d) => d.id)),
        botStartLink("invite"),
      ])
    : [[], [], null];

  // Кто из состава уже ответил. Капитану это нужнее всех: именно он идёт тормошить тех,
  // кто молчит, — а до этого «позвал» и «согласился» были для него одним и тем же.
  const answers = await membersByApplication(mine.map((a) => a.id));

  const restored = editableDraft ? toSlots(editableDraft, pool) : null;
  // Готовые составы капитана — только когда своей заявки на этот турнир ещё нет: правку прежней
  // заявки не подменяем чужой командой, а на чистой доске это быстрый путь «заявиться командой».
  const readyTeams = needBoard && me!.playerId && !editable ? await captainReadyTeams(me!.playerId, pool) : [];

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Заявка команды"
        title={tournament.name}
        aside={tournament.regCloseAt ? `Заявки до ${date.format(tournament.regCloseAt)}` : null}
      />

      {/* Свои заявки на этот турнир — карточками Кита. Статус несёт текст, а не только цвет:
          плашка «на рассмотрении» рядом с составом отвечает на вопрос «а я вообще подал?». */}
      {mine.length > 0 && (
        <ul className="space-y-3">
          {mine.map((a) => {
            const draft = parseDraft(a.payload);
            const status = STATUS[a.status] ?? STATUS.pending;
            return (
              <li key={a.id} className="space-y-2.5 rounded-card bg-surface p-4 cushion-card sm:p-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[17px] font-black tracking-[-0.3px] text-ink">{draft?.name ?? "Заявка"}</span>
                  <Alert tone={status.tone} mini>
                    {status.label}
                  </Alert>
                  {a.division && <Chip>{a.division.name}</Chip>}
                </div>
                {draft && (
                  <ul className="space-y-0.5">
                    {draft.players.map((p, i) => {
                      const answer = (answers.get(a.id) ?? []).find((m) => m.nickname === p.nickname.trim());
                      const state = answer && isInviteStatus(answer.status) ? answer.status : "invited";
                      return (
                        <li key={i} className="text-xs font-bold leading-[1.5] text-muted">
                          <span className="text-ink">{p.nickname}</span> · {roleLabel(p.role) ?? "роль не указана"}
                          {" · "}
                          <span
                            className={
                              state === "accepted"
                                ? "text-[var(--color-ok-ink)]"
                                : state === "declined"
                                  ? "text-[var(--color-warn-ink)]"
                                  : ""
                            }
                          >
                            {state === "invited" ? "ждём ответа" : INVITE_LABEL[state]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {a.notes && (
                  <Alert tone="warn" block>
                    Причина возврата: {a.notes}
                  </Alert>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!me ? (
        <Alert tone="info" block>
          Заявку подаёт капитан из своего аккаунта.{" "}
          <Link href="/me" className="underline">
            Войти в кабинет
          </Link>
          {" — "}или получить одноразовый код в телеграм-боте: «Личный профиль» → «Войти на сайт».
        </Alert>
      ) : !open ? (
        <Alert tone="info" icon="clock" block>
          Приём заявок на этот турнир сейчас закрыт.
        </Alert>
      ) : (
        <div className="space-y-4">
          {/* Свой статус в лиге подаче не мешает (решение 23.08.2026): капитан новой команды часто
              сам ещё не в ростере, а заявка всё равно проходит модерацию. */}
          {me.status !== "active" && (
            <Alert tone="info" block>
              Ваша личная анкета ещё на модерации — на заявку команды это не влияет, её рассмотрят
              отдельно.
            </Alert>
          )}
          {editable && (
            <Alert tone={editable.status === "rejected" ? "warn" : "info"} block>
              {editable.status === "rejected"
                ? "Заявка возвращена — поправьте состав и отправьте снова, новая строка в очереди не появится."
                : editable.status === "approved"
                  ? "Заявка принята, состав уже в турнире. Правки уйдут на повторную модерацию той же заявкой — второй в очереди не появится."
                  : "Заявка уже подана и ждёт решения. Правки сохранятся в неё же."}
              {restored && restored.lost > 0 &&
                ` Из прежнего состава не нашлось в лиге: ${restored.lost} — этих игроков нужно поставить заново.`}
            </Alert>
          )}
          <ApplyBoard
            tournamentId={tournament.id}
            tournamentSlug={tournament.slug}
            divisions={tournament.divisions.map((d) => ({ id: d.id, name: d.name }))}
            pool={pool}
            taken={taken}
            inviteUrl={inviteUrl}
            readyTeams={readyTeams}
            initial={
              editableDraft && restored
                ? {
                    name: editableDraft.name,
                    tag: editableDraft.tag ?? "",
                    divisionId: editable!.divisionId,
                    slots: restored.slots,
                    captainId: restored.captainId,
                  }
                : null
            }
          />
        </div>
      )}
    </div>
  );
}
