import "server-only";
import { prisma } from "./prisma";
import { pushTo } from "./presence";
import { MAX_TEXT } from "./chat-limits";
import { floodBlock } from "./flood";
import { mayEnter, readRoom, type LobbyViewer } from "./lobby";
import type { LobbyLine } from "./lobby-room";

// Чат комнаты: одна лента на всю комнату — обе стороны, тренеры, ОБС и админ комнаты.
//
// Своими строками (`LobbyMessage`), а не беседой `Conversation` (ТЗ 22в §1): правда о том, кто
// читает и пишет в комнате, — `LobbyMember`, и личка заставила бы дублировать этот список и
// ветвить четыре своих места (`key` как пару аккаунтов, гейт `chatIdentity` с обязательным
// профилем, список бесед и счётчики непрочитанного). Комната живёт часы — переписке лички это
// чужой жизненный цикл.
//
// Второго МЕХАНИЗМА при этом нет: доставка — тот же живой канал (`presence.pushTo`), предел длины
// тот же `MAX_TEXT`, счётчик флуда — общий `flood.ts`. Опроса в комнате не заводится.

/** Права на чат = права на комнату: пускает `mayEnter`, постороннему и анониму — «не найдено». */
async function membersOf(lobbyId: number, viewer: LobbyViewer | null): Promise<number[] | null> {
  const room = await readRoom(lobbyId);
  if (!room || !mayEnter(room, viewer)) return null;
  return room.members.map((m) => m.accountId);
}

const toLine = (r: { id: number; accountId: number; text: string; createdAt: Date }): LobbyLine => ({
  id: r.id,
  accountId: r.accountId,
  text: r.text,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Лента комнаты. Читается из БД, а не собирается из событий: перезагрузка страницы обязана
 * показать тот же разговор в том же порядке. `afterId` — добор хвоста после разрыва канала.
 */
export async function lobbyMessages(lobbyId: number, opts: { afterId?: number; limit?: number } = {}): Promise<LobbyLine[]> {
  const limit = Math.min(opts.limit ?? 200, 300);
  const rows = await prisma.lobbyMessage.findMany({
    where: { lobbyId, ...(opts.afterId ? { id: { gt: opts.afterId } } : {}) },
    orderBy: { id: opts.afterId ? "asc" : "desc" },
    take: limit,
    select: { id: true, accountId: true, text: true, createdAt: true },
  });
  return (opts.afterId ? rows : rows.reverse()).map(toLine);
}

/** Лента, если этому человеку вообще можно её видеть. null — «лобби не найдено» (404). */
export async function readLobbyChat(lobbyId: number, viewer: LobbyViewer | null): Promise<LobbyLine[] | null> {
  const members = await membersOf(lobbyId, viewer);
  return members ? lobbyMessages(lobbyId) : null;
}

export type LobbySendResult = { ok: true; line: LobbyLine } | { ok: false; error: string; status: 400 | 404 };

/** Реплика в комнату: проверки, запись, живое событие ВСЕМ участникам — включая самого автора. */
export async function sendLobbyMessage(lobbyId: number, viewer: LobbyViewer, raw: string): Promise<LobbySendResult> {
  const members = await membersOf(lobbyId, viewer);
  // Не член комнаты — тот же ответ, что у самой комнаты: «404», а не «403». Иначе отказ сообщал
  // бы, что комната с таким номером существует (решение 9).
  if (!members) return { ok: false, error: "Лобби не найдено", status: 404 };

  const text = raw.trim();
  if (!text) return { ok: false, error: "Пустое сообщение", status: 400 };
  // Длинное не обрезаем, а ОТКАЗЫВАЕМ: поле ввода режет само, и молча укороченная реплика в
  // комнате хуже отказа — человек не узнает, что половину его слов никто не прочёл.
  if (text.length > MAX_TEXT) return { ok: false, error: `Слишком длинно: не больше ${MAX_TEXT} символов`, status: 400 };

  const flooded = floodBlock(viewer.accountId);
  if (flooded) return { ok: false, error: flooded, status: 400 };

  const row = await prisma.lobbyMessage.create({
    data: { lobbyId, accountId: viewer.accountId, text },
    select: { id: true, accountId: true, text: true, createdAt: true },
  });
  const line = toLine(row);

  // Автору тоже: он мог писать с телефона, а вкладка на ноутбуке открыта — там реплика должна
  // появиться сама. Дедуп по id лента делает на клиенте.
  for (const accountId of members) pushTo(accountId, { type: "lobby-chat", lobbyId, line });

  return { ok: true, line };
}
