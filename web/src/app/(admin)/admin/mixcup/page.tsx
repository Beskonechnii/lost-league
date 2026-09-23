import { prisma } from "@/lib/prisma";
import { MIXCUP_STATUS_LABELS, MIXCUP_STATUS_TONE, type MixCupStatus } from "@/lib/mixcup";
import { AdminHeader } from "../../_components/admin-header";
import { SessionList } from "../../_components/session-list";
import { NewMixCupButton } from "./_components/new-mixcup-button";

export const dynamic = "force-dynamic";

export default async function MixCupHome() {
  const events = await prisma.mixCupEvent.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });

  return (
    <div className="space-y-8">
      <AdminHeader eyebrow="Служебная часть · микс-драфт" title="Mix Cup by Eclipse" aside={<NewMixCupButton />}>
        Событие поверх того же драфта, что и UNDERBEER: тумблеры «Украсть» и «Закрепить» решают
        правила этого микса, а собранные составы остаются доступны и после эфира.
      </AdminHeader>

      <SessionList
        items={events.map((e) => ({
          id: e.id,
          title: e.title || `Mix Cup #${e.id}`,
          done: e.status === "done",
          status: { tone: MIXCUP_STATUS_TONE[e.status as MixCupStatus], label: MIXCUP_STATUS_LABELS[e.status as MixCupStatus] ?? e.status },
          updated: e.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
        hrefBase="/admin/mixcup"
        apiBase="/api/mixcup"
        emptyIcon="flame"
        emptyTitle="Mix Cup ещё не заводили"
        emptyHint="Нажмите «Новый Mix Cup», чтобы завести первое событие."
        removeLabel="Удалить Mix Cup"
      />
    </div>
  );
}
