import { prisma } from "@/lib/prisma";
import { AdminHeader } from "../_components/admin-header";
import { SessionList } from "../_components/session-list";
import { NewDraftButton } from "./_components/new-draft-button";

export const dynamic = "force-dynamic";

export default async function UnderbeerHome() {
  const [players, sessions] = await Promise.all([
    prisma.player.count(),
    prisma.draftSession.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="space-y-8">
      <AdminHeader eyebrow="Служебная часть · шоу-драфт" title="UNDERBEER 2.0" aside={<NewDraftButton />}>
        Сборка шоу-команд из живого ростера ({players} игрок(ов)). Назначьте капитанов, задайте размер
        состава — и капитаны по очереди драфтят игроков. У каждой команды по разу есть «Закрепить» и
        «Украсть».
      </AdminHeader>

      <SessionList
        items={sessions.map((s) => ({
          id: s.id,
          title: s.title || `Драфт #${s.id}`,
          done: s.status === "done",
          updated: s.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
        hrefBase="/underbeer"
        apiBase="/api/underbeer"
        doneLabel="Собран"
        emptyIcon="users"
        emptyTitle="Драфтов пока нет"
        emptyHint="Нажмите «Новый драфт», чтобы собрать шоу-команды из живого ростера."
      />
    </div>
  );
}
