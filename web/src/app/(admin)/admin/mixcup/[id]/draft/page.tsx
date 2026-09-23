import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import { newDraftState, type DraftState } from "@/lib/draft";
import { ECLIPSE_PARTNER } from "@/lib/partners";
import { AdminHeader } from "../../../../_components/admin-header";
import { DraftBoard } from "../../../../underbeer/[id]/_components/draft-board";

export const dynamic = "force-dynamic";

// Сам борд Mix Cup — один движок, два входа (ТЗ 33): рисует ровно тот же DraftBoard, что и
// UNDERBEER, только сессия привязана к событию и в тулбаре стоит знак Eclipse.

export default async function MixCupDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId)) notFound();

  const [event, pool] = await Promise.all([
    prisma.mixCupEvent.findUnique({ where: { id: eventId }, include: { draftSession: true } }),
    draftPool(),
  ]);
  if (!event) notFound();
  // Сессию заводит «К драфту» POST'ом до перехода сюда — если её всё же нет (прямой заход по
  // адресу), возвращаем на экран события, а не рисуем борд без данных.
  if (!event.draftSession) redirect(`/admin/mixcup/${eventId}`);

  let state: DraftState;
  try {
    state = JSON.parse(event.draftSession.payload) as DraftState;
  } catch {
    state = newDraftState({ stealEnabled: event.stealEnabled, lockEnabled: event.lockEnabled });
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        crumbs={[
          { href: "/admin/mixcup", label: "Mix Cup by Eclipse" },
          { href: `/admin/mixcup/${eventId}`, label: event.title || `Mix Cup #${eventId}` },
        ]}
        eyebrow="Микс-драфт"
        title="Борд"
      />
      <DraftBoard
        sessionId={event.draftSession.id}
        initialTitle={event.draftSession.title}
        initialState={state}
        pool={pool}
        partner={ECLIPSE_PARTNER}
      />
    </div>
  );
}
