import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import { newDraftState, type DraftState } from "@/lib/draft";
import { AdminHeader } from "../../_components/admin-header";
import { DraftBoard } from "./_components/draft-board";

export const dynamic = "force-dynamic";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) notFound();

  const [session, pool] = await Promise.all([
    prisma.draftSession.findUnique({ where: { id: sessionId } }),
    draftPool(),
  ]);
  if (!session) notFound();

  // payload — истина состояния; при несовместимой версии/битом JSON откатываемся на пустой конфиг
  let state: DraftState;
  try {
    state = JSON.parse(session.payload) as DraftState;
  } catch {
    state = newDraftState();
  }

  return (
    <div className="space-y-6">
      {/* Крошки, а не «← Все драфты»: где ты находишься, стрелка назад не говорит (§C3). */}
      <AdminHeader
        crumbs={[
          { href: "/admin", label: "Служебная часть" },
          { href: "/underbeer", label: "UNDERBEER 2.0" },
        ]}
        eyebrow="Шоу-драфт"
        title={session.title || `Драфт #${session.id}`}
      />
      <DraftBoard sessionId={sessionId} initialTitle={session.title} initialState={state} pool={pool} />
    </div>
  );
}
