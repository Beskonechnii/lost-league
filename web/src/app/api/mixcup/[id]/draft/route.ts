import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { guard } from "@/lib/api-guard";
import { newDraftState } from "@/lib/draft";

// Открыть живой рабочий стол драфта события: тот же DraftSession, что у UNDERBEER (один движок,
// два входа — §DEV ТЗ 33). Идемпотентно: повторное «К драфту» просто возвращает уже созданную
// сессию, а не плодит вторую.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("mixcup");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");

  const event = await prisma.mixCupEvent.findUnique({ where: { id } });
  if (!event) return bad("Событие не найдено", 404);
  if (event.draftSessionId) return NextResponse.json({ id: event.draftSessionId });

  const session = await prisma.draftSession.create({
    data: {
      title: event.title,
      payload: JSON.stringify(newDraftState({ stealEnabled: event.stealEnabled, lockEnabled: event.lockEnabled })),
    },
  });
  await prisma.mixCupEvent.update({ where: { id }, data: { draftSessionId: session.id } });
  return NextResponse.json({ id: session.id }, { status: 201 });
}
