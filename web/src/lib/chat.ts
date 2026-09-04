import "server-only";
import { prisma } from "./prisma";
import { currentAccount, isActiveAccount, type Account } from "./account";
import { resolveUpload } from "./uploads";
import { pushTo, type ChatEventMessage } from "./presence";
import { MAX_TEXT } from "./chat-limits";
import { actionOf } from "./chat-actions";
import type { ChatAction } from "./chat-events";
import { SYSTEM_NAME } from "./system-chat";

// Личные диалоги игроков: кто имеет право писать, как заводится беседа, чтение и отправка.
// Доставка «вживую» — не здесь: отправка кладёт сообщение в БД и толкает событие в presence.ts,
// а держит соединение SSE-роут. Так страница остаётся рабочей и без живого канала (перезагрузил —
// увидел то же самое из базы), а канал лишь избавляет от ожидания.

export { MAX_TEXT } from "./chat-limits";

const FLOOD_WINDOW_MS = 60_000;
const FLOOD_LIMIT = 30; // сообщений в минуту с аккаунта: живому разговору хватает, скрипту — нет

const g = globalThis as unknown as { lostChatFlood?: Map<number, number[]> };
const flood: Map<number, number[]> = (g.lostChatFlood ??= new Map());

/**
 * Кто я в чате. Писать и читать личку может только игрок лиги: аккаунт одобрен (`active`) и
 * привязан к профилю. Это не формальность — собеседник выбирается из ростера, и человек без
 * профиля в нём просто не существует, отвечать ему было бы некуда.
 */
export type ChatMe = { accountId: number; playerId: number; nickname: string };

export function chatIdentity(account: Account | null): ChatMe | null {
  if (!account?.player || !isActiveAccount(account)) return null;
  return { accountId: account.id, playerId: account.player.id, nickname: account.player.nickname };
}

export async function currentChatMe(): Promise<ChatMe | null> {
  return chatIdentity(await currentAccount());
}

/** Ключ беседы: пара id аккаунтов по возрастанию. Один разговор на двоих, порядок не важен. */
const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * Беседа с этим аккаунтом — найти или завести. Upsert по ключу пары: два одновременных первых
 * сообщения иначе развели бы разговор на две беседы, и половина реплик пропала бы из виду.
 */
export async function openConversation(meAccountId: number, peerAccountId: number): Promise<number> {
  const found = await findConversation(meAccountId, peerAccountId);
  if (found) return found;

  const created = await prisma.conversation.create({
    data: {
      key: pairKey(meAccountId, peerAccountId),
      members: { create: [{ accountId: meAccountId }, { accountId: peerAccountId }] },
    },
    select: { id: true },
  });
  return created.id;
}

/** Беседа с этим аккаунтом, если она уже была. Заводить её на открытие страницы не нужно. */
export async function findConversation(meAccountId: number, peerAccountId: number): Promise<number | null> {
  const row = await prisma.conversation.findUnique({
    where: { key: pairKey(meAccountId, peerAccountId) },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** Аккаунт игрока, если он может участвовать в переписке (одобрен и привязан). */
export async function chatAccountOfPlayer(playerId: number): Promise<{ id: number; email: string | null; status: string } | null> {
  const acc = await prisma.userAccount.findFirst({
    where: { playerId },
    select: { id: true, email: true, status: true },
  });
  return acc && isActiveAccount(acc) ? acc : null;
}

/**
 * Собеседник. Обычно это игрок лиги, но вторым участником может быть и служебный аккаунт
 * «Spirit CTRL» (`system-chat.ts`) — у него нет профиля в ростере, поэтому `playerId` и `slug`
 * пустые, а `system` поднят. Отдельной сущности «системная беседа» нет намеренно: список,
 * непрочитанное, живой канал и отметка о прочтении работают на ней без единой правки.
 */
export type Peer = {
  accountId: number;
  system: boolean;
  playerId: number | null;
  nickname: string;
  slug: string | null;
  photo: string | null;
};

/** Адрес беседы: у игрока — по его id, у лиги — свой постоянный. */
export const chatPath = (peer: Peer): string => (peer.system ? "/chat/system" : `/chat/${peer.playerId}`);

/** Собеседник в беседе: второй участник вместе с его профилем. null — беседа не моя. */
export async function peerOf(conversationId: number, meAccountId: number): Promise<Peer | null> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: {
      accountId: true,
      account: {
        select: { system: true, player: { select: { id: true, nickname: true, slug: true, photo: true } } },
      },
    },
  });
  if (!members.some((m) => m.accountId === meAccountId)) return null;

  const other = members.find((m) => m.accountId !== meAccountId);
  if (!other) return null;

  // Лига — участник без профиля: у неё своё имя и свой знак вместо фото.
  if (other.account.system) {
    return { accountId: other.accountId, system: true, playerId: null, nickname: SYSTEM_NAME, slug: null, photo: null };
  }

  const player = other.account.player;
  if (!player) return null;

  return {
    accountId: other.accountId,
    system: false,
    playerId: player.id,
    nickname: player.nickname,
    slug: player.slug,
    photo: await resolveUpload("players", player.slug, "photo", player.photo),
  };
}

export type ConversationRow = {
  id: number;
  peer: Peer;
  lastText: string | null;
  lastAt: Date;
  lastMine: boolean;
  unread: number;
};

/** Список бесед сверху вниз по свежести — то, что рисуется колонкой слева на /chat. */
export async function listConversations(meAccountId: number): Promise<ConversationRow[]> {
  const mine = await prisma.conversationMember.findMany({
    where: { accountId: meAccountId },
    select: {
      conversationId: true,
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          messages: { orderBy: { id: "desc" }, take: 1, select: { text: true, senderId: true } },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
  });

  const rows: ConversationRow[] = [];
  for (const m of mine) {
    const peer = await peerOf(m.conversationId, meAccountId);
    if (!peer) continue; // собеседник удалил аккаунт или отвязал профиль — беседу не показываем
    const last = m.conversation.messages[0];
    rows.push({
      id: m.conversationId,
      peer,
      lastText: last?.text ?? null,
      lastAt: m.conversation.lastMessageAt,
      lastMine: last?.senderId === meAccountId,
      unread: await unreadIn(m.conversationId, meAccountId, m.lastReadAt),
    });
  }
  return rows;
}

function unreadIn(conversationId: number, meAccountId: number, lastReadAt: Date | null): Promise<number> {
  return prisma.chatMessage.count({
    where: {
      conversationId,
      senderId: { not: meAccountId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}

/** Сколько непрочитанного всего — счётчик у пункта «Сообщения» в колонке навигации. */
export async function unreadTotal(meAccountId: number): Promise<number> {
  const mine = await prisma.conversationMember.findMany({
    where: { accountId: meAccountId },
    select: { conversationId: true, lastReadAt: true },
  });
  let total = 0;
  for (const m of mine) total += await unreadIn(m.conversationId, meAccountId, m.lastReadAt);
  return total;
}

export type ChatLine = {
  id: number;
  text: string;
  createdAt: Date;
  mine: boolean;
  /** Выбор, если сообщение системное: кнопки либо уже сделанный ответ (`chat-actions.ts`). */
  action?: ChatAction | null;
};

/**
 * Лента беседы. `afterId` — добор хвоста (клиент так восстанавливается после разрыва канала),
 * без него отдаётся последняя страница: разговор читают с конца.
 */
export async function messages(
  conversationId: number,
  meAccountId: number,
  opts: { afterId?: number; limit?: number } = {},
): Promise<ChatLine[]> {
  const limit = Math.min(opts.limit ?? 100, 200);
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, ...(opts.afterId ? { id: { gt: opts.afterId } } : {}) },
    orderBy: { id: opts.afterId ? "asc" : "desc" },
    take: limit,
    select: { id: true, text: true, createdAt: true, senderId: true, kind: true, payload: true },
  });
  const ordered = opts.afterId ? rows : rows.reverse();
  return Promise.all(
    ordered.map(async (r) => ({
      id: r.id,
      text: r.text,
      createdAt: r.createdAt,
      mine: r.senderId === meAccountId,
      // Состояние выбора читается из сущности при каждом рендере: в сообщении его нет (см.
      // chat-actions.ts), поэтому «принял» видно и тогда, когда ответили из бота или со страницы.
      action: await actionOf(r.kind, r.payload, meAccountId),
    })),
  );
}

export type SendResult = { ok: true; message: ChatLine } | { ok: false; error: string };

/** Отправка: проверки, запись, живое событие обоим участникам. */
export async function sendMessage(conversationId: number, me: ChatMe, raw: string): Promise<SendResult> {
  const text = raw.trim().slice(0, MAX_TEXT);
  if (!text) return { ok: false, error: "Пустое сообщение" };

  const peer = await peerOf(conversationId, me.accountId);
  if (!peer) return { ok: false, error: "Это не ваша беседа" };
  // Лига — канал, а не собеседник: отвечать ей некому, и «сообщение улетело в никуда» хуже отказа.
  if (peer.system) return { ok: false, error: `${peer.nickname} — служебный канал, писать сюда нельзя` };

  const now = Date.now();
  const recent = (flood.get(me.accountId) ?? []).filter((t) => now - t < FLOOD_WINDOW_MS);
  if (recent.length >= FLOOD_LIMIT) {
    flood.set(me.accountId, recent);
    return { ok: false, error: "Слишком часто — подождите минуту" };
  }
  recent.push(now);
  flood.set(me.accountId, recent);

  const row = await prisma.chatMessage.create({
    data: { conversationId, senderId: me.accountId, text },
    select: { id: true, text: true, createdAt: true },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: row.createdAt },
  });

  // Своя вкладка тоже слушает канал: отправил с телефона — на открытом ноутбуке сообщение
  // появилось само, без перезагрузки.
  const payload = (mine: boolean): ChatEventMessage => ({
    id: row.id,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    senderAccountId: me.accountId,
    mine,
  });
  pushTo(me.accountId, { type: "message", conversationId, peerPlayerId: peer.playerId, message: payload(true) });
  pushTo(peer.accountId, { type: "message", conversationId, peerPlayerId: me.playerId, message: payload(false) });

  return { ok: true, message: { id: row.id, text: row.text, createdAt: row.createdAt, mine: true } };
}

/** Отметка «прочитал до сих пор». Идемпотентна: назад отметку не двигаем. */
export async function markRead(conversationId: number, meAccountId: number): Promise<void> {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_accountId: { conversationId, accountId: meAccountId } },
    select: { id: true, lastReadAt: true },
  });
  if (!member) return;
  const at = new Date();
  if (member.lastReadAt && member.lastReadAt >= at) return;
  await prisma.conversationMember.update({ where: { id: member.id }, data: { lastReadAt: at } });
  pushTo(meAccountId, { type: "read", conversationId, at: at.toISOString() });
}
