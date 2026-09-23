import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import type { DraftState } from "@/lib/draft";
import { ECLIPSE_PARTNER } from "@/lib/partners";
import { MIXCUP_STATUS_LABELS, MIXCUP_STATUS_TONE, type MixCupStatus } from "@/lib/mixcup";
import { StatusPill } from "@/components/pouf/feedback";
import { PartnerMark } from "@/components/pouf/media";
import { AdminHeader } from "../../../_components/admin-header";
import { RulesPanel } from "./_components/rules-panel";
import { EnterDraftButton } from "./_components/enter-draft-button";
import { ResultGrid } from "./_components/result-grid";
import { ParticipantsPanel } from "./_components/participants-panel";

export const dynamic = "force-dynamic";

export default async function MixCupEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId)) notFound();

  const event = await prisma.mixCupEvent.findUnique({
    where: { id: eventId },
    include: {
      draftSession: { select: { id: true, payload: true } },
      teams: { orderBy: { orderNo: "asc" }, include: { picks: { orderBy: { orderNo: "asc" } } } },
      registrations: {
        orderBy: { createdAt: "asc" },
        include: { player: { select: { id: true, nickname: true, photo: true, verified: true } } },
      },
    },
  });
  if (!event) notFound();

  // Фаза живой сессии — единственная правда о том, начался ли уже драфт (тумблеры блокируются
  // ею), и главная о том, что показывать: сброшенный «Пересобрать заново» опять уходит в config,
  // а event.status ещё хранит «done» с прошлого раза — тогда доверяем сессии, а не статусу.
  let phase: DraftState["phase"] | null = null;
  if (event.draftSession) {
    try {
      phase = (JSON.parse(event.draftSession.payload) as DraftState).phase;
    } catch {
      phase = null;
    }
  }
  const showResult = event.draftSession ? phase === "done" : event.status === "done";

  const status = (event.status in MIXCUP_STATUS_LABELS ? event.status : "open") as MixCupStatus;
  const title = event.title || `Mix Cup #${event.id}`;

  return (
    <div className="space-y-6">
      <AdminHeader
        crumbs={[{ href: "/admin/mixcup", label: "Mix Cup by Eclipse" }]}
        eyebrow="Mix Cup"
        title={title}
        aside={
          <div className="flex items-center gap-2">
            <PartnerMark src={ECLIPSE_PARTNER.src} name={ECLIPSE_PARTNER.name} size="md" />
            <StatusPill tone={MIXCUP_STATUS_TONE[status]}>{MIXCUP_STATUS_LABELS[status]}</StatusPill>
          </div>
        }
      />

      {showResult ? (
        <ResultGrid teams={event.teams} pool={await draftPool()} />
      ) : (
        <>
          <RulesPanel
            eventId={event.id}
            stealEnabled={event.stealEnabled}
            lockEnabled={event.lockEnabled}
            // До старта драфта (сессии ещё нет, либо она в roster/config) тумблеры доступны;
            // с фазы draft — заблокированы, но видны (оператор должен видеть, что было включено).
            locked={phase === "draft" || phase === "done"}
          />
          <EnterDraftButton eventId={event.id} label={event.draftSession ? "К драфту" : "Начать драфт"} />
          <ParticipantsPanel eventId={event.id} items={event.registrations.map((r) => r.player)} />
        </>
      )}
    </div>
  );
}
