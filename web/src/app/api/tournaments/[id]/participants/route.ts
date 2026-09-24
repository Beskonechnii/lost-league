import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { guard } from "@/lib/api-guard";
import type { DraftState } from "@/lib/draft";

// «Взять участников в драфт» (Scope п.5 ТЗ 34, общий для обоих форматов с ТЗ 37): фаза отбора
// заполняется РОВНО записавшимися на турнир, а не отмечается вручную по всему ростеру лиги.
// Работает только пока сессия ещё в фазе roster — начатый отбор (config/draft) руками не
// перетирается заново.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("tournaments.edit");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");

  const settings = await prisma.tournamentDraftSettings.findUnique({
    where: { tournamentId: id },
    include: { draftSession: true },
  });
  if (!settings) return bad("Турнир не найден", 404);
  if (!settings.draftSession) return bad("Сначала откройте драфт («К драфту»)", 400);

  let state: DraftState;
  try {
    state = JSON.parse(settings.draftSession.payload) as DraftState;
  } catch {
    return bad("Битое состояние драфта", 400);
  }
  if (state.phase !== "roster") return bad("Участников можно заполнить только до начала отбора", 400);

  const registrations = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: id },
    select: { playerId: true },
  });
  const participants = registrations.map((r) => r.playerId);

  const next: DraftState = { ...state, participants };
  await prisma.draftSession.update({ where: { id: settings.draftSession.id }, data: { payload: JSON.stringify(next) } });
  return NextResponse.json({ ok: true, count: participants.length });
}
