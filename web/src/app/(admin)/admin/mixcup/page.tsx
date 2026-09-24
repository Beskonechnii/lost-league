import { prisma } from "@/lib/prisma";
import { TOURNAMENT_STATUS_LABELS, type TournamentStatus } from "@/lib/tournaments";
import { STATUS_TONE } from "@/app/_components/tournament-status";
import { AdminHeader } from "../../_components/admin-header";
import { SessionList } from "../../_components/session-list";
import { NewMixCupButton } from "./_components/new-mixcup-button";

export const dynamic = "force-dynamic";

// Короткий список одного формата: Mix Cup — серия, и оператор заходит сюда, а не ищет её среди
// сезонов в общем списке турниров. Сами события с ТЗ 37 — обычные Tournament (kind: "mixcup"),
// карточка каждого открывается на общей консоли /admin/tournaments/<slug>.

export default async function MixCupHome() {
  const events = await prisma.tournament.findMany({
    where: { kind: "mixcup" },
    orderBy: { id: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <AdminHeader eyebrow="Служебная часть · микс-драфт" title="Mix Cup by Eclipse" aside={<NewMixCupButton />}>
        Турнир поверх того же драфта, что и UNDERBEER: тумблеры «Украсть» и «Закрепить» решают
        правила этого микса, а собранные составы остаются доступны и после эфира.
      </AdminHeader>

      <SessionList
        items={events.map((e) => ({
          id: e.id,
          href: `/admin/tournaments/${e.slug}`,
          title: e.name,
          done: e.status === "finished",
          status: {
            tone: STATUS_TONE[e.status as TournamentStatus] ?? "neutral",
            label: TOURNAMENT_STATUS_LABELS[e.status as TournamentStatus] ?? e.status,
          },
          updated: e.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
        hrefBase="/admin/tournaments"
        apiBase="/api/tournaments"
        emptyIcon="flame"
        emptyTitle="Mix Cup ещё не заводили"
        emptyHint="Нажмите «Новый Mix Cup», чтобы завести первый турнир этого формата."
        removeLabel="Удалить Mix Cup"
      />
    </div>
  );
}
