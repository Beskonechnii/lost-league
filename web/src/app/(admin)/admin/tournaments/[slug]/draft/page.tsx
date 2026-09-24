import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import { newDraftState, type DraftState } from "@/lib/draft";
import { ECLIPSE_PARTNER } from "@/lib/partners";
import { TOURNAMENT_KIND_SHORT, type TournamentKind } from "@/lib/tournaments";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../../../_components/permission-gate";
import { AdminHeader } from "../../../../_components/admin-header";
import { DraftBoard } from "../../../../underbeer/[id]/_components/draft-board";

export const dynamic = "force-dynamic";

// Борд турнира индивидуального формата — один движок, два входа (ТЗ 33/37): рисует ровно тот же
// DraftBoard, что и ad hoc-UNDERBEER, только сессия привязана к турниру. Знак Eclipse стоит
// в тулбаре у Mix Cup — это его партнёр, у UNDERBEER организатора со стороны нет.

export default async function TournamentDraftPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Борд драфта");
  if (denied) return denied;

  const { slug } = await params;
  const [tournament, pool] = await Promise.all([
    prisma.tournament.findUnique({ where: { slug }, include: { draftSettings: { include: { draftSession: true } } } }),
    draftPool(),
  ]);
  if (!tournament || tournament.kind === "season") notFound();

  const settings = tournament.draftSettings;
  // Сессию заводит «К драфту» POST'ом до перехода сюда — если её всё же нет (прямой заход по
  // адресу), возвращаем на консоль турнира, а не рисуем борд без данных.
  if (!settings?.draftSession) redirect(`/admin/tournaments/${slug}`);

  let state: DraftState;
  try {
    state = JSON.parse(settings.draftSession.payload) as DraftState;
  } catch {
    state = newDraftState({ stealEnabled: settings.stealEnabled, lockEnabled: settings.lockEnabled });
  }

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 space-y-6 px-4 py-8 md:px-6`}>
      <AdminHeader
        crumbs={[
          { href: "/admin/tournaments", label: "Турниры" },
          { href: `/admin/tournaments/${slug}`, label: tournament.name },
        ]}
        eyebrow={TOURNAMENT_KIND_SHORT[tournament.kind as TournamentKind] ?? tournament.kind}
        title="Борд"
      />
      <DraftBoard
        sessionId={settings.draftSession.id}
        initialTitle={settings.draftSession.title}
        initialState={state}
        pool={pool}
        partner={tournament.kind === "mixcup" ? ECLIPSE_PARTNER : undefined}
      />
    </main>
  );
}
