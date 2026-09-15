import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { currentViewer } from "@/lib/lobby";
import { readLobbyChat, sendLobbyMessage } from "@/lib/lobby-chat";

// Чат комнаты: лента (GET) и реплика (POST). Права те же, что у самой комнаты, — решает членство
// в `LobbyMember`, а не право `tools`. Постороннему и анониму 404, как и у /api/lobby/[id]:
// «403» сообщало бы, что комната существует.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const lines = await readLobbyChat(id, await currentViewer());
  if (!lines) return bad("Лобби не найдено", 404);
  return NextResponse.json(lines);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const viewer = await currentViewer();
  if (!viewer) return bad("Лобби не найдено", 404);

  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  const result = await sendLobbyMessage(id, viewer, typeof body.text === "string" ? body.text : "");
  if (!result.ok) return bad(result.error, result.status);
  return NextResponse.json(result.line, { status: 201 });
}
