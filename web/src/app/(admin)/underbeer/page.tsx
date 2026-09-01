import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/pouf/text";
import { NewDraftButton } from "./_components/new-draft-button";
import { DraftList } from "./_components/draft-list";

export const dynamic = "force-dynamic";

export default async function UnderbeerHome() {
  const [players, sessions] = await Promise.all([
    prisma.player.count(),
    prisma.draftSession.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="space-y-10 font-pouf">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="mb-2">Служебная часть · шоу-драфт</Eyebrow>
          <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">UNDERBEER 2.0</h1>
          <p className="mt-1.5 max-w-2xl text-sm font-bold text-muted">
            Сборка шоу-команд из живого ростера ({players} игрок(ов)). Назначь капитанов, задай размер состава —
            и капитаны по очереди драфтят игроков. У каждой команды по разу есть «Закрепить» и «Украсть».
          </p>
        </div>
        <NewDraftButton />
      </div>

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
