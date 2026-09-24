import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { guard } from "@/lib/api-guard";
import { newDraftState } from "@/lib/draft";

// Открыть живой рабочий стол драфта турнира: тот же DraftSession, что у ad hoc-UNDERBEER (один
// движок, два входа — §DEV ТЗ 33/37). Идемпотентно: повторное «К драфту» просто возвращает уже
// созданную сессию, а не плодит вторую.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("tournaments.edit");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { draftSettings: true } });
  if (!tournament) return bad("Турнир не найден", 404);
  if (tournament.kind === "season") return bad("У сезонного турнира драфта нет", 400);
  if (tournament.draftSettings?.draftSessionId) return NextResponse.json({ id: tournament.draftSettings.draftSessionId });

  const session = await prisma.draftSession.create({
    data: {
      title: tournament.name,
      payload: JSON.stringify(
        newDraftState({
          stealEnabled: tournament.draftSettings?.stealEnabled ?? true,
          lockEnabled: tournament.draftSettings?.lockEnabled ?? true,
        }),
      ),
    },
  });
  await prisma.tournamentDraftSettings.upsert({
    where: { tournamentId: id },
    create: { tournamentId: id, draftSessionId: session.id },
    update: { draftSessionId: session.id },
  });
  return NextResponse.json({ id: session.id }, { status: 201 });
}
