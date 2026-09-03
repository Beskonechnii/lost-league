import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { currentChatMe, markRead } from "@/lib/chat";

// Отметка «прочитал». Отдельным роутом, а не прицепом к чтению ленты: страница открывается и
// сервер-рендером, а он не должен писать в БД (Next волен отрендерить его дважды).

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentChatMe();
  if (!me) return bad("Чат — для игроков лиги", 401);

  const body = (await req.json().catch(() => null)) as { conversationId?: number } | null;
  const conversationId = parseId(body?.conversationId ?? null);
  if (!conversationId) return bad("Нужен conversationId");

  await markRead(conversationId, me.accountId);
  return NextResponse.json({ ok: true });
}
