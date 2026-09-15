import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { createLobby, currentViewer, type LobbyInvite } from "@/lib/lobby";
import { DEFAULT_MAIN_SEC, DEFAULT_RESERVE_SEC, type TeamIdx } from "@/lib/fearless";
import type { LobbyRole } from "@/lib/lobby-room";

// Создание лобби. Право `tools` тут НЕ гейт: комнату заводит и игрок лиги (решение 1) — кто именно
// может, решает `canCreateLobby` внутри.

type Body = {
  title?: string;
  sideATeamId?: number;
  sideBTeamId?: number;
  mainSec?: number;
  reserveSec?: number;
  bestOf?: number;
  seriesId?: number | null;
  invites?: { playerId?: number; side?: number | null; role?: string }[];
};

/** Секунды из формы: положительное целое, иначе дефолт движка. Тайминги — настройка встречи. */
const secs = (raw: unknown, fallback: number): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 3600 ? n : fallback;
};

export async function POST(req: Request) {
  const viewer = await currentViewer();
  if (!viewer) return bad("Нужно войти", 401);

  const body = (await req.json().catch(() => ({}))) as Body;
  const title = body.title?.trim();
  if (!title) return bad("Назовите встречу");

  const a = parseId(body.sideATeamId);
  const b = parseId(body.sideBTeamId);
  if (!a || !b) return bad("Выберите обе стороны");

  const ROLES: LobbyRole[] = ["player", "coach", "caster", "admin"];
  const invites: LobbyInvite[] = (body.invites ?? []).flatMap((i) => {
    const playerId = parseId(i.playerId);
    if (!playerId) return [];
    // Сторона может быть пустой: так зовут вне составов — ОБС и админа комнаты (ТЗ 22в §3).
    const side = i.side === 0 || i.side === 1 ? (i.side as TeamIdx) : null;
    const role = ROLES.includes(i.role as LobbyRole) ? (i.role as LobbyRole) : "player";
    return [{ playerId, side, role }];
  });

  const result = await createLobby({
    title,
    sideATeamId: a,
    sideBTeamId: b,
    mainSec: secs(body.mainSec, DEFAULT_MAIN_SEC),
    reserveSec: secs(body.reserveSec, DEFAULT_RESERVE_SEC),
    bestOf: [1, 2, 3, 5].includes(Number(body.bestOf)) ? Number(body.bestOf) : 3,
    seriesId: parseId(body.seriesId),
    invites,
  });
  if (!result.ok) return bad(result.error, 403);
  return NextResponse.json({ id: result.id }, { status: 201 });
}
