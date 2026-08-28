import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { guard } from "@/lib/api-guard";
import { restoreTeam, TeamAdminError } from "@/lib/team-admin";

// Вернуть команду из архива в общий пул — обратная сторона «первого удаления» (см. Team.archivedAt).
// Под тем же правом roster.delete, что и архивация: это управление пулом, а не правка профиля.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("roster.delete");
  if (denied) return denied;
  const teamId = parseId((await params).id);
  if (!teamId) return bad("id: ожидался числовой id");

  try {
    await restoreTeam(teamId);
  } catch (e) {
    if (e instanceof TeamAdminError) return bad(e.message, 404);
    throw e;
  }
  return NextResponse.json({ ok: true });
}
