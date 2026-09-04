import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { currentChatMe } from "@/lib/chat";
import { applyAction, actionOf } from "@/lib/chat-actions";
import { prisma } from "@/lib/prisma";

// Нажали кнопку в системном сообщении. Отдельным роутом, а не server-action: лента живёт на
// клиенте и обновляет ровно одну строку — ей нужен ответ данными, а не перерисовка страницы.
//
// В ответ возвращаем ту же строку с уже пересчитанным состоянием выбора. Пересчитываем, а не
// сочиняем «теперь принято»: состояние читается из самой сущности (`chat-actions.ts`), и клиент
// получает ровно то, что увидит при следующей загрузке страницы.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentChatMe();
  if (!me) return bad("Чат — для игроков лиги", 401);

  const body = (await req.json().catch(() => null)) as { messageId?: number; choice?: string } | null;
  const messageId = parseId(body?.messageId ?? null);
  if (!messageId || typeof body?.choice !== "string") return bad("Нужны messageId и choice");

  const error = await applyAction(messageId, me.accountId, body.choice);
  if (error) return bad(error);

  const row = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, text: true, createdAt: true, senderId: true, kind: true, payload: true },
  });
  if (!row) return bad("Сообщение не найдено", 404);

  return NextResponse.json({
    message: {
      id: row.id,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      mine: row.senderId === me.accountId,
      action: await actionOf(row.kind, row.payload, me.accountId),
    },
  });
}
