import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/account";
import { openInvites } from "@/lib/team-invites";
import { parseDraft } from "@/lib/team-application";
import { roleLabel } from "@/lib/roles";
import { AUTH_MAX_W, Chip } from "@/components/pouf/blocks";
import { Eyebrow } from "@/components/pouf/text";
import { EmptyState, StatusPill } from "@/components/pouf/feedback";
import { QueueCard, QueueNote } from "@/components/pouf/queue-card";
import { Breadcrumbs } from "@/app/_components/breadcrumbs";
import { InviteActions } from "./invite-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Приглашения" };

// Вторая ступень апрува заявки команды — со стороны игрока. Капитан вписал человека в состав,
// заявка ушла организатору, а здесь человек отвечает: иду или нет (решение 04.09.2026).
// Ответ ничего не блокирует — он виден оператору в очереди рядом с составом.
//
// Приватная страница: доступна вошедшему игроку с привязанным профилем. Остальных уводим в
// кабинет — приглашение адресовано игроку лиги, а не аккаунту.

const dateTime = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

export default async function InvitesPage() {
  const account = await currentAccount();
  if (!account?.player) redirect("/me");

  const invites = await openInvites(account.player.id);

  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div className={`mx-auto w-full ${AUTH_MAX_W}`}>
        <Breadcrumbs items={[{ href: "/me", label: "Кабинет" }]} />

        <Eyebrow>Кабинет</Eyebrow>
        <h1 className="mt-2 text-[28px] font-black leading-[1.2] tracking-[-0.5px] text-ink">Приглашения</h1>
        <p className="mb-6 mt-1.5 text-sm font-bold text-muted">
          Составы, в которые вас вписал капитан. Ваш ответ видит организатор — он же решает по заявке.
        </p>

        {invites.length === 0 ? (
          <EmptyState icon="mail" title="Приглашений нет">
            Они появятся, когда капитан впишет вас в состав команды на турнир.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {invites.map((invite) => {
              const draft = parseDraft(invite.application.payload);
              // Роль берём из самого состава: капитан её и назначил, и человеку важно видеть,
              // на какую позицию его зовут.
              const mine = draft?.players.find((p) => p.nickname.trim() === invite.nickname);

              return (
                <li key={invite.id}>
                  <QueueCard
                    tags={
                      <>
                        <StatusPill>ждёт ответа</StatusPill>
                        {invite.application.division && <Chip>{invite.application.division.name}</Chip>}
                      </>
                    }
                    title={draft?.name ?? "команда не читается"}
                    meta={dateTime.format(invite.invitedAt)}
                  >
                    <QueueNote>
                      <p className="text-[13px] text-ink">
                        Турнир: <span className="font-black">{invite.application.tournament.name}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Вы в составе как {invite.nickname}
                        {mine?.role ? ` · ${roleLabel(mine.role) ?? mine.role}` : ""}
                        {mine?.isCaptain ? " · капитан" : ""}
                      </p>
                      {draft && (
                        <p className="mt-2 text-[11px] text-muted">
                          Состав: {draft.players.map((p) => p.nickname).join(", ")}
                        </p>
                      )}
                    </QueueNote>

                    <InviteActions memberId={invite.id} />
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
