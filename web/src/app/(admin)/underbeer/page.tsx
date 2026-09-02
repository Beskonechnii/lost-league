import { prisma } from "@/lib/prisma";
import { AdminHeader } from "../_components/admin-header";
import { NewDraftButton } from "./_components/new-draft-button";
import { DraftList } from "./_components/draft-list";

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

      <DraftList
        sessions={sessions.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          updated: s.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
      />
    </div>
  );
}
