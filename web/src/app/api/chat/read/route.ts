import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { currentLiveMe, markRead } from "@/lib/chat";

// Отметка «прочитал». Отдельным роутом, а не прицепом к чтению ленты: страница открывается и
// сервер-рендером, а он не должен писать в БД (Next волен отрендерить его дважды).

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // `currentLiveMe`, а не `currentChatMe`: отметку о прочтении ставит и оператор без карточки
  // игрока, и заявитель — служебный канал открыт любому вошедшему (`chat.ts`). Чужую беседу
  // это не откроет: `markRead` молчит, если человек в ней не участник.
  const me = await currentLiveMe();
  if (!me) return bad("Чат — для вошедших", 401);

  const body = (await req.json().catch(() => null)) as { conversationId?: number } | null;
  const conversationId = parseId(body?.conversationId ?? null);
  if (!conversationId) return bad("Нужен conversationId");

  await markRead(conversationId, me.accountId);
  return NextResponse.json({ ok: true });
}
