import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { guard } from "@/lib/api-guard";
import type { DraftState } from "@/lib/draft";

// «Взять участников в драфт» (Scope п.5 ТЗ 34): фаза отбора заполняется РОВНО записавшимися на
// Mix Cup, а не отмечается вручную по всему ростеру лиги. Работает только пока сессия ещё в фазе
// roster — начатый отбор (config/draft) руками не перетирается заново.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("mixcup");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");

  const event = await prisma.mixCupEvent.findUnique({ where: { id }, include: { draftSession: true } });
  if (!event) return bad("Событие не найдено", 404);
  if (!event.draftSession) return bad("Сначала откройте драфт («К драфту»)", 400);

  let state: DraftState;
  try {
    state = JSON.parse(event.draftSession.payload) as DraftState;
  } catch {
    return bad("Битое состояние драфта", 400);
  }
  if (state.phase !== "roster") return bad("Участников можно заполнить только до начала отбора", 400);

  const registrations = await prisma.mixCupRegistration.findMany({ where: { eventId: id }, select: { playerId: true } });
  const participants = registrations.map((r) => r.playerId);

  const next: DraftState = { ...state, participants };
  await prisma.draftSession.update({ where: { id: event.draftSession.id }, data: { payload: JSON.stringify(next) } });
  return NextResponse.json({ ok: true, count: participants.length });
}
