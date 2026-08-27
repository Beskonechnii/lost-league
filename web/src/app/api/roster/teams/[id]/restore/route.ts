import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { guard } from "@/lib/api-guard";

// Вернуть команду из архива в общий пул — обратная сторона «первого удаления» (см. DELETE ?mode=archive
// и Team.archivedAt). Под тем же правом `roster.delete`, что и архивация: это управление пулом, а не
// правка профиля. Историю турниров команда не теряла и в архиве — восстановление лишь снимает флаг.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("roster.delete");
  if (denied) return denied;
  const teamId = parseId((await params).id);
  if (!teamId) return bad("id: ожидался числовой id");

  const { count } = await prisma.team.updateMany({ where: { id: teamId }, data: { archivedAt: null } });
  if (!count) return bad("Команда не найдена", 404);
  return NextResponse.json({ ok: true });
}
