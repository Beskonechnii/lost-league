import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { chatAccountOfPlayer, currentChatMe, messages, openConversation, peerOf, sendMessage } from "@/lib/chat";

// Лента и отправка. Беседа заводится не при открытии страницы, а первым сообщением: иначе список
// бесед зарастал бы пустыми разговорами от каждого «зашёл посмотреть в профиль и нажал написать».

export const dynamic = "force-dynamic";

/** Добор хвоста: `?conversationId=7&after=123`. Клиент зовёт его после разрыва живого канала. */
export async function GET(req: Request) {
  const me = await currentChatMe();
  if (!me) return bad("Чат — для игроков лиги", 401);

  const url = new URL(req.url);
  const conversationId = parseId(url.searchParams.get("conversationId"));
  if (!conversationId) return bad("Нужен conversationId");
  if (!(await peerOf(conversationId, me.accountId))) return bad("Это не ваша беседа", 403);

  const after = parseId(url.searchParams.get("after")) ?? undefined;
  return NextResponse.json({ messages: await messages(conversationId, me.accountId, { afterId: after }) });
}

export async function POST(req: Request) {
  const me = await currentChatMe();
  if (!me) return bad("Чат — для игроков лиги", 401);

  const body = (await req.json().catch(() => null)) as { conversationId?: number; playerId?: number; text?: string } | null;
  if (!body || typeof body.text !== "string") return bad("Нужен text");

  // Либо пишем в известную беседу, либо начинаем разговор с игроком — тогда её и заводим.
  let conversationId = parseId(body.conversationId ?? null);
  if (!conversationId) {
    const playerId = parseId(body.playerId ?? null);
    if (!playerId) return bad("Нужен conversationId или playerId");
    if (playerId === me.playerId) return bad("Себе не пишут");
    const peer = await chatAccountOfPlayer(playerId);
    if (!peer) return bad("Этот игрок пока не в лиге — написать ему нельзя", 404);
    conversationId = await openConversation(me.accountId, peer.id);
  }

  const result = await sendMessage(conversationId, me, body.text);
  if (!result.ok) return bad(result.error);
  return NextResponse.json({ conversationId, message: result.message });
}
