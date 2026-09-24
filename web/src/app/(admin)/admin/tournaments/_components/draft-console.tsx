import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import type { DraftState } from "@/lib/draft";
import { parseRoleKeys } from "@/lib/roles";
import { ECLIPSE_PARTNER } from "@/lib/partners";
import {
  TOURNAMENT_KIND_SHORT,
  TOURNAMENT_STATUS_LABELS,
  type TournamentKind,
  type TournamentStatus as TournamentStatusKey,
} from "@/lib/tournaments";
import { PartnerMark } from "@/components/pouf/media";
import { PillLink } from "@/components/pouf/tabs";
import { Button } from "@/components/pouf/Button";
import { FORM_MAX_W } from "@/components/pouf/blocks";
import { TournamentStatus } from "@/app/_components/tournament-status";
import { AdminHeader } from "../../../_components/admin-header";
import { Panel } from "../../../_components/panel";
import { changeStatus } from "../actions";
import { RulesPanel } from "./rules-panel";
import { EnterDraftButton } from "./enter-draft-button";
import { ResultGrid } from "./result-grid";
import { ParticipantsPanel } from "./participants-panel";

/**
 * Операторская консоль турнира индивидуального формата (ТЗ 37, DESIGN §4): правила драфта,
 * вход в борд, список записавшихся. Одна на оба формата — mixcup и underbeer водят один движок
 * с одними тумблерами, и второй копии экрана под вторым адресом заводить незачем.
 *
 * Стоит на месте служебной карточки турнира (`/admin/tournaments/<slug>`), а не своим корнем:
 * турнир один — карточка у него одна, и крошки тогда честные. Сезонная карточка (дивизионы,
 * заявки команд) для этих форматов не рисуется вовсе: ни того, ни другого у них не бывает.
 */
export async function DraftConsole({ slug }: { slug: string }) {
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      draftSettings: { include: { draftSession: { select: { id: true, payload: true } } } },
      mixCupTeams: { orderBy: { orderNo: "asc" }, include: { picks: { orderBy: { orderNo: "asc" } } } },
      registrations: {
        orderBy: { createdAt: "asc" },
        include: { player: { select: { id: true, nickname: true, photo: true, verified: true } } },
      },
    },
  });
  if (!tournament) return null;

  const settings = tournament.draftSettings;
  const session = settings?.draftSession ?? null;

  // Фаза живой сессии — единственная правда о том, начался ли уже драфт (тумблеры блокируются
  // ею), и главная о том, что показывать: сброшенный «Пересобрать заново» опять уходит в config,
  // а статус турнира ещё хранит «Сыгран» с прошлого раза — тогда доверяем сессии, а не статусу.
  let phase: DraftState["phase"] | null = null;
  if (session) {
    try {
      phase = (JSON.parse(session.payload) as DraftState).phase;
    } catch {
      phase = null;
    }
  }
  // Сохранённый результат есть только у Mix Cup: у UNDERBEER-турнира драфт остаётся эфемерным.
  const showResult =
    tournament.mixCupTeams.length > 0 && (session ? phase === "done" : tournament.status === "finished");

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader
        crumbs={[{ href: "/admin/tournaments", label: "Турниры" }]}
        eyebrow={TOURNAMENT_KIND_SHORT[tournament.kind as TournamentKind] ?? tournament.kind}
        title={tournament.name}
        aside={
          <div className="flex items-center gap-2">
            {tournament.kind === "mixcup" && <PartnerMark src={ECLIPSE_PARTNER.src} name={ECLIPSE_PARTNER.name} size="md" />}
            <TournamentStatus status={tournament.status} />
          </div>
        }
      />

      <nav className="mt-5 flex flex-wrap gap-2">
        <PillLink href={`/join/${tournament.slug}`}>Страница записи</PillLink>
      </nav>

      <div className="mt-6 space-y-6">
        {/* Тот же переключатель, что на карточке сезонного турнира: приём записи открывает
            статус «Приём заявок», и другого способа открыть его у индивидуального формата нет. */}
        <Panel title="Статус" hint="«Приём заявок» — единственное состояние, в котором игрок может записаться на странице записи.">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TOURNAMENT_STATUS_LABELS) as TournamentStatusKey[]).map((st) => (
              <form key={st} action={changeStatus}>
                <input type="hidden" name="id" value={tournament.id} />
                <input type="hidden" name="slug" value={tournament.slug} />
                <input type="hidden" name="status" value={st} />
                <Button type="submit" size="sm" variant={tournament.status === st ? "solid" : "quiet"}>
                  {TOURNAMENT_STATUS_LABELS[st]}
                </Button>
              </form>
            ))}
          </div>
        </Panel>

        {showResult ? (
          <ResultGrid teams={tournament.mixCupTeams} pool={await draftPool(tournament.id)} />
        ) : (
          <>
            <RulesPanel
              tournamentId={tournament.id}
              stealEnabled={settings?.stealEnabled ?? true}
              lockEnabled={settings?.lockEnabled ?? true}
              // До старта драфта (сессии ещё нет, либо она в roster/config) тумблеры доступны;
              // с фазы draft — заблокированы, но видны (оператор должен видеть, что включено).
              locked={phase === "draft" || phase === "done"}
            />
            <EnterDraftButton
              tournamentId={tournament.id}
              slug={tournament.slug}
              label={session ? "К драфту" : "Начать драфт"}
            />
            <ParticipantsPanel
              tournamentId={tournament.id}
              slug={tournament.slug}
              items={tournament.registrations.map((r) => ({ ...r.player, roles: parseRoleKeys(r.desiredRoles) }))}
            />
          </>
        )}
      </div>
    </main>
  );
}
