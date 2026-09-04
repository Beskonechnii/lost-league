// Только сервер / скрипт: системные сообщения игроку в его же переписке — от лица лиги.
//
// **Зачем.** Решения модерации и приглашения в состав до этого жили только в телеграме и на своих
// страницах: человеку без бота приходилось догадываться зайти в кабинет. Чат в продукте уже есть,
// он открыт у каждого игрока и уже показывает непрочитанное в колонке — правильное место, чтобы
// лига говорила с человеком.
//
// **Собеседник — служебный аккаунт «Spirit CTRL»** (`UserAccount.system`). Не выдуманная сущность
// рядом с беседами, а обычный участник обычной беседы: список бесед, непрочитанное, живой канал и
// отметка о прочтении работают на нём без единой правки. Отличий ровно два: у него нет профиля в
// ростере (и не должно быть — он не игрок), и писать ему нельзя (`chat.ts` → `sendMessage`).
// Это канал, а не собеседник.
//
// **`server-only` — и это не случайность.** Живой канал (`presence.ts`) держит соединения в памяти
// процесса приложения: из процесса бота событие всё равно никуда бы не доехало. Поэтому системные
// сообщения шлёт сторона сайта — она же принимает все решения оператора.

import "server-only";
import { prisma } from "./prisma";
import { actionOf, formatPayload } from "./chat-actions";
import { pushTo } from "./presence";
import type { ChatEventMessage } from "./chat-events";

/** Имя, под которым лига говорит с игроком. Одно на все системные сообщения. */
export const SYSTEM_NAME = "Spirit CTRL";

/**
 * Служебный аккаунт. Ищем по флагу; не помечен ни один — берём аккаунт владельца лиги (`owner`),
 * а из нескольких — самый ранний: это тот самый «админ, который уже заведён», и заводить рядом
 * второй пустой аккаунт незачем. Совсем никого — `null`: значит, лига ещё не настроена, и системные
 * сообщения просто не уходят (телеграм и страницы работают как работали).
 */
export async function systemAccountId(): Promise<number | null> {
  const marked = await prisma.userAccount.findFirst({ where: { system: true }, select: { id: true } });
  if (marked) return marked.id;

  const owner = await prisma.userAccount.findFirst({
    where: { role: { in: ["owner", "admin"] } },
    orderBy: [{ role: "asc" }, { id: "asc" }], // admin < owner по алфавиту, поэтому сортировка вторична
    select: { id: true },
  });
  if (!owner) return null;

  // Пометку ставим один раз и сразу: дальше аккаунт находится по флагу, даже если ролей прибавится.
  await prisma.userAccount.update({ where: { id: owner.id }, data: { system: true, name: SYSTEM_NAME } });
  return owner.id;
}

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Беседа игрока с лигой — найти или завести. Тот же upsert по ключу пары, что и у людей. */
async function systemConversation(systemId: number, accountId: number): Promise<number> {
  const key = pairKey(systemId, accountId);
  const found = await prisma.conversation.findUnique({ where: { key }, select: { id: true } });
  if (found) return found.id;
  const created = await prisma.conversation.create({
    data: { key, members: { create: [{ accountId: systemId }, { accountId }] } },
    select: { id: true },
  });
  return created.id;
}

export type SystemAction = { kind: string; payload: Record<string, unknown> };

/**
 * Написать игроку от лица лиги. `action` — если у сообщения есть выбор (реестр — `chat-actions.ts`).
 *
 * Молчит и не падает, когда писать некому: у человека нет аккаунта, аккаунт не одобрен, служебного
 * аккаунта нет вовсе. Уведомление — не то, ради чего стоит ронять решение оператора; ровно тот же
 * уговор, что в `tg-notify.ts`.
 */
export async function tellPlayer(
  playerId: number,
  text: string,
  action?: SystemAction,
): Promise<void> {
  const account = await prisma.userAccount.findFirst({
    where: { playerId, status: "active" },
    select: { id: true },
  });
  if (!account) return;
  await tellAccount(account.id, text, action);
}

/** То же, но адресом служит аккаунт: решение по анкете приходит раньше, чем у человека есть профиль. */
export async function tellAccount(accountId: number, text: string, action?: SystemAction): Promise<void> {
  try {
    const systemId = await systemAccountId();
    if (!systemId || systemId === accountId) return;

    const conversationId = await systemConversation(systemId, accountId);
    const row = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: systemId,
        text: text.trim(),
        kind: action?.kind ?? null,
        payload: action ? formatPayload(action.payload) : null,
      },
      select: { id: true, text: true, createdAt: true },
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: row.createdAt } });

    // Живой канал: у открытой вкладки сообщение появится само. `peerPlayerId` у лиги нет —
    // беседу на клиенте узнаёт по `conversationId` (см. thread.tsx).
    const message: ChatEventMessage = {
      id: row.id,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      senderAccountId: systemId,
      mine: false,
      // Выбор считаем для получателя тут же: иначе пришедшее вживую приглашение осталось бы
      // текстом без кнопок до перезагрузки страницы.
      action: await actionOf(action?.kind ?? null, action ? formatPayload(action.payload) : null, accountId),
    };
    pushTo(accountId, { type: "message", conversationId, peerPlayerId: null, message });
  } catch (e) {
    console.error("Не удалось написать игроку от лица лиги:", e);
  }
}
